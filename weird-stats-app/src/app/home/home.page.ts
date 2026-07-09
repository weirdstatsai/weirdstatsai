import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { ModalController } from '@ionic/angular';
import { Subscription, firstValueFrom, of, switchMap } from 'rxjs';
import { StoredStatCard } from '../models/weird-card.model';
import { MembershipService, UsageInfo } from '../services/membership.service';
import { EmojiService } from '../services/emoji.service';
import { PlanModalComponent } from '../shared/plan-modal/plan-modal.component';

const SUGGESTIONS = [
  'Which country drinks the most coffee?',
  'What are the deadliest animals on Earth?',
  'How much does the average person sleep by country?',
  'Which sport has the most injuries?',
];

const SUGGESTION_ICONS = ['cafe-outline', 'bug-outline', 'bed-outline', 'football-outline'];

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnInit, OnDestroy {
  recentCards: StoredStatCard[] = [];
  suggestions = SUGGESTIONS;
  suggestionIcons = SUGGESTION_ICONS;
  query = '';
  userName = '';
  userEmoji = '';
  isLoading = true;

  // "Reset holder" — usage chip below Generate showing cards left + countdown.
  usage: UsageInfo | null = null;
  usageCountdown = '';

  private cardSub?: Subscription;
  private authSub?: Subscription;
  private emojiSub?: Subscription;
  private usageTimer?: ReturnType<typeof setInterval>;

  constructor(
    private router: Router,
    private afs: AngularFirestore,
    private afAuth: AngularFireAuth,
    private modalCtrl: ModalController,
    private membership: MembershipService,
    private emojiService: EmojiService,
  ) {}

  ionViewWillEnter(): void {
    const state = history.state as { prefillQuery?: string } | undefined;
    if (state?.prefillQuery) {
      this.query = state.prefillQuery;
    }
    // Picks up usage after a generation made on a previous visit to this tab.
    this.refreshUsage();
  }

  ngOnInit(): void {
    this.authSub = this.afAuth.authState.subscribe(user => {
      if (user) {
        this.userName = user.displayName
          ? user.displayName.split(' ')[0]
          : (user.email?.split('@')[0] ?? '');
        this.refreshUsage();
      } else {
        this.userName = '';
        this.usage = null;
        this.usageCountdown = '';
      }
    });

    // Avatar emoji follows the account (Firestore-synced).
    this.emojiSub = this.afAuth.authState.pipe(
      switchMap(user => user ? this.emojiService.emoji$(user.uid) : of('')),
    ).subscribe(emoji => { this.userEmoji = emoji; });

    // Recompute the countdown text from the cached resetAt every minute —
    // no extra Firestore reads, just a local clock tick.
    this.usageTimer = setInterval(() => this.tickCountdown(), 60_000);

    // Home feed: admin-curated cards only (pushed from the admin panel). Public
    // user-shared cards live on Explore now. Order is shuffled on a rotating
    // window so repeat visitors see a fresh arrangement.
    this.cardSub = this.afs
      .collection<StoredStatCard>('stats', ref =>
        ref.where('homeFeatured', '==', true).limit(60)
      )
      .valueChanges({ idField: 'id' })
      .subscribe({
        next: docs => {
          const valid = docs.filter(d => d.data?.title && d.data?.cardType);
          this.recentCards = this.shuffleForWindow(valid);
          this.isLoading = false;
        },
        error: () => { this.isLoading = false; },
      });
  }

  ngOnDestroy(): void {
    this.cardSub?.unsubscribe();
    this.authSub?.unsubscribe();
    this.emojiSub?.unsubscribe();
    if (this.usageTimer) clearInterval(this.usageTimer);
  }

  private async refreshUsage(): Promise<void> {
    const user = await firstValueFrom(this.afAuth.authState);
    if (!user) { this.usage = null; this.usageCountdown = ''; return; }
    this.usage = await this.membership.getUsage();
    this.tickCountdown();
  }

  private tickCountdown(): void {
    if (!this.usage?.resetAt) { this.usageCountdown = ''; return; }
    const ms = this.usage.resetAt.getTime() - Date.now();
    if (ms <= 0) { this.refreshUsage(); return; } // window elapsed — refetch the fresh quota
    const totalMin = Math.ceil(ms / 60_000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    this.usageCountdown = h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  async goGenerate(prompt?: string): Promise<void> {
    const p = (prompt ?? this.query).trim();
    if (!p) return;

    // Must be logged in
    const user = await firstValueFrom(this.afAuth.authState);
    if (!user) {
      const modal = await this.modalCtrl.create({ component: (await import('../login/login.component')).LoginComponent, cssClass: 'login-modal' });
      await modal.present();
      return;
    }

    // Show plan modal on first use
    const hasChosen = await this.membership.hasChosenPlan();
    if (!hasChosen) {
      const modal = await this.modalCtrl.create({
        component: PlanModalComponent,
        componentProps: { mode: 'onboard' },
        breakpoints: [0, 1], initialBreakpoint: 1,
        handle: false,
      });
      await modal.present();
      await modal.onWillDismiss();
      this.refreshUsage();
    }

    // Check generation limit
    const canGenerate = await this.membership.canGenerate();
    if (!canGenerate) {
      const modal = await this.modalCtrl.create({
        component: PlanModalComponent,
        componentProps: { mode: 'limit' },
        breakpoints: [0, 1], initialBreakpoint: 1,
        handle: false,
      });
      await modal.present();
      await modal.onWillDismiss();
      this.refreshUsage(); // picks up an in-modal Premium upgrade immediately
      return;
    }

    this.query = '';
    this.router.navigate(['/card'], { state: { prompt: p } });
  }

  async openUpgrade(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: PlanModalComponent,
      componentProps: { mode: 'upgrade' },
      breakpoints: [0, 1], initialBreakpoint: 1,
      handle: false,
    });
    await modal.present();
    await modal.onWillDismiss();
    this.refreshUsage();
  }

  open(card: StoredStatCard): void {
    // View-only: no edit panel, no alternatives
    this.router.navigate(['/card'], { state: { card, viewOnly: true } });
  }

  /**
   * Deterministic shuffle keyed to a rotating time window (default 3h), so
   * everyone sees the same order within a window and it reshuffles each window
   * — keeps the curated Home feed feeling fresh without jarring mid-session
   * reordering. Seeded PRNG (mulberry32) so it's stable, not random per render.
   */
  private shuffleForWindow(cards: StoredStatCard[], windowMs = 3 * 60 * 60 * 1000): StoredStatCard[] {
    let seed = Math.floor(Date.now() / windowMs) >>> 0;
    const rng = () => {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const out = cards.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  // Map and fact cards need horizontal room to read — span both grid columns.
  // All other cards stay strict 2-up; grid-auto-flow: dense fills any hole a
  // full-width row break would leave by pulling the next tile up.
  isFullWidth(card: StoredStatCard): boolean {
    const t = card.data?.cardType;
    return t === 'map' || t === 'fact' || t === 'ranking' || t === 'table';
  }
}
