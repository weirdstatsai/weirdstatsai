import { Component, OnDestroy, OnInit, NgZone } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { ModalController, ToastController } from '@ionic/angular';
import { Subscription, firstValueFrom, of, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';
import { APP_CONFIG } from '../config/app-config';
import { StoredStatCard } from '../models/weird-card.model';
import { AuthService } from '../services/auth.service';
import { MembershipService } from '../services/membership.service';
import { ProjectService } from '../services/project.service';
import { Project } from '../models/project.model';
import { PlanModalComponent, planModalOptions } from '../shared/plan-modal/plan-modal.component';

@Component({
  selector: 'app-project-generate',
  templateUrl: './project-generate.page.html',
  styleUrls: ['./project-generate.page.scss'],
})
export class ProjectGeneratePage implements OnInit, OnDestroy {
  project?: Project;
  projectId = '';
  prompt = '';
  isGenerating = false;
  statusMsg = '';
  errorMsg = '';
  cards: StoredStatCard[] = [];
  isLoadingCards = true;

  private uid = '';
  private statsSub?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private afs: AngularFirestore,
    private authService: AuthService,
    private membership: MembershipService,
    private projectService: ProjectService,
    private modalCtrl: ModalController,
    private toastCtrl: ToastController,
    private ngZone: NgZone,
  ) {}

  ngOnInit(): void {
    this.projectId = this.route.snapshot.paramMap.get('id') ?? '';
    this.statsSub = this.authService.user$.pipe(
      switchMap(user => {
        this.uid = user?.uid ?? '';
        if (user) {
          this.projectService.get(user.uid, this.projectId).then(p => (this.project = p));
          return this.projectService.projectStats$(user.uid, this.projectId);
        }
        return of([] as StoredStatCard[]);
      }),
    ).subscribe({
      next: cards => { this.cards = cards; this.isLoadingCards = false; },
      error: () => { this.cards = []; this.isLoadingCards = false; },
    });
  }

  ngOnDestroy(): void { this.statsSub?.unsubscribe(); }

  goBack(): void {
    this.router.navigate(['/project', this.projectId]);
  }

  open(card: StoredStatCard): void {
    this.router.navigate(['/card'], {
      state: { card, fromSaved: true, returnUrl: `/project/${this.projectId}/generate` },
    });
  }

  async generate(): Promise<void> {
    const prompt = this.prompt.trim();
    if (!prompt || this.isGenerating) return;

    if (!this.uid) { this.toast('Sign in to add stats.'); return; }
    // No project context → refuse, so a card is never created without a
    // projectId (which would land it in Saved instead of this project).
    if (!this.projectId) { this.toast('Missing project — reopen from your project.'); return; }

    // Project cap — same limit the bulk import respects.
    if (this.cards.length >= APP_CONFIG.limits.maxStatsPerProject) {
      this.toast(`This project is full (${APP_CONFIG.limits.maxStatsPerProject} stats max)`);
      return;
    }

    // Same free-plan gating as the home Generate flow.
    const canGenerate = await this.membership.canGenerate();
    if (!canGenerate) {
      const modal = await this.modalCtrl.create({
        ...planModalOptions('limit'),
      });
      await modal.present();
      await modal.onWillDismiss();
      return;
    }

    this.isGenerating = true;
    this.statusMsg = 'Starting…';
    this.errorMsg = '';

    try {
      const res = await fetch(`${environment.apiUrl}/api/generate/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, uid: this.uid }),
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
          this.ngZone.run(() => {
            if (event.type === 'status') {
              this.statusMsg = event.message;
            } else if (event.type === 'card') {
              this.saveProjectCard(prompt, event.data);
            } else if (event.type === 'error') {
              this.errorMsg = event.message;
              this.isGenerating = false;
              this.statusMsg = '';
            }
          });
        }
      }
    } catch {
      this.ngZone.run(() => {
        this.errorMsg = 'Generation failed. Please try again.';
        this.isGenerating = false;
        this.statusMsg = '';
      });
    }
  }

  /**
   * Persist a freshly generated card into this project. Stored in Firestore
   * (not device-local drafts) as `private` so it survives devices but never
   * appears on Explore/Home; `projectId` keeps it out of profile Saved.
   */
  private async saveProjectCard(prompt: string, data: StoredStatCard['data'] & { id?: string; createdAt?: string }): Promise<void> {
    const id = data.id || this.afs.createId();
    const doc: StoredStatCard = {
      id,
      status: 'completed',
      publishStatus: 'private',
      createdBy: this.uid,
      createdAt: data.createdAt ?? new Date().toISOString(),
      prompt,
      promptHash: '',
      projectId: this.projectId,
      data,
    };
    try {
      await this.afs.collection('stats').doc(id).set(doc);
      this.prompt = '';
      this.toast('Stat added to project!');
    } catch {
      this.errorMsg = 'Could not save the stat. Please try again.';
    } finally {
      this.isGenerating = false;
      this.statusMsg = '';
    }
  }

  // Same span rules as the home/profile feeds.
  isFullWidth(card: StoredStatCard): boolean {
    const t = card.data?.cardType;
    return t === 'map' || t === 'fact' || t === 'ranking' || t === 'table';
  }

  private async toast(msg: string): Promise<void> {
    const t = await this.toastCtrl.create({ message: msg, duration: 1800, position: 'bottom' });
    await t.present();
  }
}
