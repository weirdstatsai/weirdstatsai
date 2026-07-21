import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { AdminService } from '../services/admin.service';
import { AuthService } from '../services/auth.service';
import { StoredStatCard } from '../models/weird-card.model';

type CardFilter = 'all' | 'explore' | 'home' | 'public' | 'private';

/**
 * Admin "All cards" — browse every user's generated cards and curate the Explore
 * (and Home) feeds. Sending a card to Explore is the ONLY way anything reaches
 * Explore now that users can't publish there. Cursor-paginated; search + filter
 * run client-side over the pages already loaded.
 */
@Component({
  selector: 'app-admin-cards',
  templateUrl: './admin-cards.page.html',
  styleUrls: ['./admin-cards.page.scss'],
})
export class AdminCardsPage implements OnInit {
  cards: StoredStatCard[] = [];
  isLoading = true;
  loadingMore = false;
  hasMore = true;
  query = '';
  filter: CardFilter = 'all';

  private cursor: unknown = null;
  private readonly pageSize = 60;

  constructor(
    private router: Router,
    private admin: AdminService,
    private auth: AuthService,
    private toastCtrl: ToastController,
  ) {}

  async ngOnInit(): Promise<void> {
    const user = await firstValueFrom(this.auth.user$);
    if (!user || !(await this.admin.isAdmin(user.uid))) { this.router.navigate(['/home']); return; }
    const { cards, last } = await this.admin.getAllCards(this.pageSize);
    this.cards = cards;
    this.cursor = last;
    this.hasMore = cards.length === this.pageSize;
    this.isLoading = false;
  }

  async loadMore(): Promise<void> {
    if (this.loadingMore || !this.hasMore) return;
    this.loadingMore = true;
    try {
      const { cards, last } = await this.admin.getAllCards(this.pageSize, this.cursor);
      this.cards = [...this.cards, ...cards];
      this.cursor = last;
      this.hasMore = cards.length === this.pageSize;
    } finally {
      this.loadingMore = false;
    }
  }

  /** Search + filter over the loaded pages (client-side). */
  visibleCards(): StoredStatCard[] {
    const q = this.query.trim().toLowerCase();
    return this.cards.filter(c => {
      if (this.filter === 'explore' && !c.showOnExplore) return false;
      if (this.filter === 'home' && !c.showOnHome) return false;
      if (this.filter === 'public' && c.publishStatus !== 'published') return false;
      if (this.filter === 'private' && (c.publishStatus ?? 'draft') !== 'private') return false;
      if (!q) return true;
      const hay = `${c.data?.title ?? ''} ${c.prompt ?? ''} ${c.data?.uiMeta?.category ?? ''} ${c.createdByName ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }

  setFilter(f: CardFilter): void { this.filter = f; }

  async toggleExplore(c: StoredStatCard, ev: Event): Promise<void> {
    ev.stopPropagation();
    const next = !c.showOnExplore;
    try {
      await this.admin.setFeedFlag(c.id, 'showOnExplore', next);
      c.showOnExplore = next;
      if (next) c.publishStatus = 'published';
      this.toast(next ? 'Sent to Explore' : 'Removed from Explore');
    } catch { this.toast('Could not update card'); }
  }

  async toggleHome(c: StoredStatCard, ev: Event): Promise<void> {
    ev.stopPropagation();
    const next = !c.showOnHome;
    try {
      await this.admin.setFeedFlag(c.id, 'showOnHome', next);
      c.showOnHome = next;
      if (next) c.publishStatus = 'published';
      this.toast(next ? 'Sent to Home' : 'Removed from Home');
    } catch { this.toast('Could not update card'); }
  }

  openCard(c: StoredStatCard): void {
    // Same shape the admin per-user browse uses (card-detail reads state.card as
    // a StoredStatCard). isAdminView reveals the admin actions incl. feed toggles.
    this.router.navigate(['/card'], {
      state: { card: c, viewOnly: false, isAdminView: true, returnUrl: '/admin-cards' },
    });
  }

  back(): void { this.router.navigate(['/admin']); }

  private async toast(msg: string): Promise<void> {
    const t = await this.toastCtrl.create({ message: msg, duration: 1600 });
    await t.present();
  }
}
