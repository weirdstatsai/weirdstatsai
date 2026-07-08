import { Component, NgZone, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { ToastController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { APP_CONFIG } from '../config/app-config';
import { StoredStatCard } from '../models/weird-card.model';
import { AuthService } from '../services/auth.service';
import { MembershipService } from '../services/membership.service';
import { ProjectService } from '../services/project.service';

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB — matches the backend cap
const SUPPORTED_EXTS = ['pdf', 'docx', 'xlsx', 'csv', 'tsv', 'txt', 'md'];
const PROJECT_CAP = APP_CONFIG.limits.maxStatsPerProject;

@Component({
  selector: 'app-project-import',
  templateUrl: './project-import.page.html',
  styleUrls: ['./project-import.page.scss'],
})
export class ProjectImportPage implements OnInit {
  projectId = '';
  file?: File;
  analyzing = false;
  statusMsg = '';
  errorMsg = '';
  totalPlanned = 0;
  cards: StoredStatCard[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private toastCtrl: ToastController,
    private afs: AngularFirestore,
    private authService: AuthService,
    private membership: MembershipService,
    private projectService: ProjectService,
    private ngZone: NgZone,
  ) {}

  ngOnInit(): void {
    this.projectId = this.route.snapshot.paramMap.get('id') ?? '';
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const chosen = input.files?.[0];
    input.value = ''; // allow re-picking the same file later
    if (!chosen) return;

    const ext = chosen.name.toLowerCase().split('.').pop() ?? '';
    if (!SUPPORTED_EXTS.includes(ext)) {
      await this.toast('Use a PDF, Word, Excel, CSV, or text file', 'danger');
      return;
    }
    if (chosen.size > MAX_FILE_BYTES) {
      await this.toast('File must be under 15 MB', 'danger');
      return;
    }
    this.file = chosen;
  }

  get sizeLabel(): string {
    if (!this.file) return '';
    const mb = this.file.size / 1024 / 1024;
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(this.file.size / 1024)} KB`;
  }

  clearFile(): void {
    this.file = undefined;
  }

  async generate(): Promise<void> {
    if (!this.file || this.analyzing) return;

    const user = await firstValueFrom(this.authService.user$);
    if (!user) { await this.toast('Sign in to import a PDF', 'danger'); return; }
    // No project context → refuse, so imported cards always carry a projectId.
    if (!this.projectId) { await this.toast('Missing project — reopen from your project.', 'danger'); return; }
    const canGenerate = await this.membership.canGenerate();
    if (!canGenerate) { await this.toast('Daily card limit reached — upgrade to import', 'warning'); return; }

    // Project cap: never generate more cards than the project has room for.
    const existing = await firstValueFrom(this.projectService.projectStats$(user.uid, this.projectId));
    const remaining = PROJECT_CAP - existing.length;
    if (remaining <= 0) {
      await this.toast(`This project is full (${PROJECT_CAP} stats max)`, 'warning');
      return;
    }

    this.analyzing = true;
    this.statusMsg = 'Uploading document…';
    this.errorMsg = '';
    this.cards = [];
    this.totalPlanned = 0;

    try {
      const form = new FormData();
      form.append('file', this.file, this.file.name);
      // The agent extracts at most this many findings — the project's free space.
      form.append('max_findings', String(remaining));
      const res = await fetch(`${environment.apiUrl}/api/projects/import/stream`, {
        method: 'POST',
        body: form,
      });
      if (!res.ok || !res.body) throw new Error('Stream failed');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const event = JSON.parse(line.slice(6));
          await this.ngZone.run(() => this.handleEvent(event, user.uid));
        }
      }

      this.ngZone.run(() => this.finish());
    } catch {
      this.ngZone.run(() => {
        this.errorMsg = 'Import failed. Please try again.';
        this.analyzing = false;
        this.statusMsg = '';
      });
    }
  }

  private async handleEvent(event: any, uid: string): Promise<void> {
    if (event.type === 'status') {
      this.statusMsg = event.message;
    } else if (event.type === 'plan') {
      this.totalPlanned = event.total ?? 0;
      this.statusMsg = `Found ${this.totalPlanned} stats in the document…`;
    } else if (event.type === 'card') {
      await this.saveProjectCard(event.data, uid);
    } else if (event.type === 'error') {
      this.errorMsg = event.message;
      this.analyzing = false;
      this.statusMsg = '';
    }
    // 'skipped' and 'done' need no UI handling beyond the running counters.
  }

  /** Same persistence shape as "Add a stat": private + projectId, plus the
   *  source file name so the project grid can group cards per import. */
  private async saveProjectCard(data: any, uid: string): Promise<void> {
    const id = data.id || this.afs.createId();
    const doc: StoredStatCard = {
      id,
      status: 'completed',
      publishStatus: 'private',
      createdBy: uid,
      createdAt: data.createdAt ?? new Date().toISOString(),
      prompt: data.prompt ?? '',
      promptHash: '',
      projectId: this.projectId,
      importFile: this.file?.name ?? 'document',
      data,
    };
    try {
      await this.afs.collection('stats').doc(id).set(doc);
      this.membership.recordGeneration();
      this.cards = [...this.cards, doc];
    } catch {
      // Card generated but could not be saved — surface softly, keep importing.
      this.toast('One card could not be saved', 'warning');
    }
  }

  private async finish(): Promise<void> {
    this.analyzing = false;
    this.statusMsg = '';
    if (this.errorMsg) return;
    if (this.cards.length > 0) {
      await this.toast(`${this.cards.length} ${this.cards.length === 1 ? 'stat' : 'stats'} added to your project`, 'success');
      this.close();
    } else {
      this.errorMsg = 'No cards could be generated from this document.';
    }
  }

  close(): void {
    this.router.navigate(['/project', this.projectId]);
  }

  private async toast(message: string, color: string): Promise<void> {
    const t = await this.toastCtrl.create({ message, duration: 1700, color });
    await t.present();
  }
}
