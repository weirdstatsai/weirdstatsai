import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ModalController, ToastController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ProjectService } from '../services/project.service';
import { Project } from '../models/project.model';
import { ProjectAddSheetComponent } from '../shared/project-add-sheet/project-add-sheet.component';

@Component({
  selector: 'app-project-detail',
  templateUrl: './project-detail.page.html',
  styleUrls: ['./project-detail.page.scss'],
})
export class ProjectDetailPage implements OnInit, OnDestroy {
  project?: Project;
  loading = true;
  statCount = 0;
  private projectId = '';
  private sub?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private projectService: ProjectService,
    private modalCtrl: ModalController,
    private toastCtrl: ToastController,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.projectId = this.route.snapshot.paramMap.get('id') ?? '';
    this.sub = this.authService.user$.subscribe(async user => {
      if (!user) return;
      this.project = await this.projectService.get(user.uid, this.projectId);
      this.loading = false;
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  /** Monogram initials derived from the project name (e.g. "telangana stats" → "TS"). */
  get initials(): string {
    const name = (this.project?.project_name ?? '').trim();
    if (!name) return '·';
    const words = name.split(/\s+/).filter(Boolean);
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  /** "Jul 2026" style created label, or '' if unknown. */
  get createdLabel(): string {
    const iso = this.project?.createdAt;
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  }

  goBack(): void {
    this.router.navigate(['/tabs/profile']);
  }

  async openCreate(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: ProjectAddSheetComponent,
      cssClass: 'add-sheet-modal',
    });
    await modal.present();
    const { data } = await modal.onWillDismiss();
    if (data === 'add') this.addSingle();
    else if (data === 'bulk') this.addBulk();
  }

  private async addSingle(): Promise<void> {
    const t = await this.toastCtrl.create({ message: 'Single-stat add is coming soon', duration: 1600, color: 'primary' });
    await t.present();
  }

  private addBulk(): void {
    this.router.navigate(['/project', this.projectId, 'import']);
  }
}
