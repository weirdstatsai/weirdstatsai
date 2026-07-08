import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ModalController } from '@ionic/angular';
import { Subscription, of, switchMap } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ProjectService } from '../services/project.service';
import { Project } from '../models/project.model';
import { StoredStatCard } from '../models/weird-card.model';
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
  cards: StoredStatCard[] = [];
  /** Cards grouped by source — one section per imported document, plus one
   *  for individually added stats. Newest group first. */
  groups: Array<{ label: string; icon: string; cards: StoredStatCard[] }> = [];
  private projectId = '';
  private sub?: Subscription;
  private statsSub?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private projectService: ProjectService,
    private modalCtrl: ModalController,
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

    // Live stream of the stats generated inside this project.
    this.statsSub = this.authService.user$.pipe(
      switchMap(user => user
        ? this.projectService.projectStats$(user.uid, this.projectId)
        : of([] as StoredStatCard[])),
    ).subscribe(cards => {
      this.cards = cards;
      this.statCount = cards.length;
      this.groups = this.buildGroups(cards);
      this.cdr.detectChanges();
    });
  }

  /** Split the (already newest-first) cards into per-source sections. */
  private buildGroups(cards: StoredStatCard[]): Array<{ label: string; icon: string; cards: StoredStatCard[] }> {
    const byKey = new Map<string, StoredStatCard[]>();
    for (const c of cards) {
      const key = c.importFile ?? '__added__';
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key)!.push(c);
    }
    // Map iteration preserves first-seen order — since cards arrive newest
    // first, groups are ordered by their most recent card.
    return [...byKey.entries()].map(([key, list]) => ({
      label: key === '__added__' ? 'Added stats' : key,
      icon: key === '__added__' ? 'sparkles-outline' : 'document-text-outline',
      cards: list,
    }));
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); this.statsSub?.unsubscribe(); }

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

  private addSingle(): void {
    this.router.navigate(['/project', this.projectId, 'generate']);
  }

  private addBulk(): void {
    this.router.navigate(['/project', this.projectId, 'import']);
  }

  open(card: StoredStatCard): void {
    this.router.navigate(['/card'], {
      state: { card, fromSaved: true, returnUrl: `/project/${this.projectId}` },
    });
  }

  // Same span rules as the home/profile feeds.
  isFullWidth(card: StoredStatCard): boolean {
    const t = card.data?.cardType;
    return t === 'map' || t === 'fact' || t === 'ranking' || t === 'table';
  }
}
