import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { ModalController } from '@ionic/angular';
import { Subscription, firstValueFrom, of, switchMap } from 'rxjs';
import { StoredStatCard } from '../models/weird-card.model';
import { MembershipService, UsageInfo } from '../services/membership.service';
import { EmojiService } from '../services/emoji.service';
import { PlanModalComponent, planModalOptions } from '../shared/plan-modal/plan-modal.component';

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
export class HomePage implements OnInit, OnDestroy, AfterViewInit {
  recentCards: StoredStatCard[] = [];
  suggestions = SUGGESTIONS;
  suggestionIcons = SUGGESTION_ICONS;

  // "Explore by topic" tiles — tapping one jumps to Explore for that category.
  readonly categories: Array<{ label: string; icon: string }> = [
    { label: 'Animals',    icon: 'paw' },
    { label: 'Countries',  icon: 'globe' },
    { label: 'Food',       icon: 'fast-food' },
    { label: 'Money',      icon: 'cash' },
    { label: 'Internet',   icon: 'wifi' },
    { label: 'Human Body', icon: 'fitness' },
    { label: 'Sports',     icon: 'football' },
    { label: 'History',    icon: 'library' },
  ];

  /** The single spotlight card ("Today's Weird Pick") and a few for Trending —
   *  both drawn from the curated Home feed, so no extra queries. */
  get featuredCard(): StoredStatCard | null { return this.recentCards[0] ?? null; }
  get trendingCards(): StoredStatCard[] { return this.recentCards.slice(1, 5); }

  /** "Today's weird stories" deck — the leading curated cards, rendered as the
   *  REAL premium share card (app-story-card), so what's in the carousel is
   *  exactly what opens and gets shared. Capped at 5 so the stack stays legible.
   *
   *  Held as a FIELD (not a getter over the live list): Swiper owns the
   *  <swiper-slide> elements once initialized, so letting *ngFor reorder or
   *  remove them in place throws inside ViewContainerRef.move. syncDeck()
   *  instead tears the whole container down and rebuilds it. */
  storyCards: StoredStatCard[] = [];
  private deckKey = '';

  /** Point the deck at a new card set, rebuilding the Swiper container when the
   *  set actually changed (identity by id list — a same-set re-emit is a no-op,
   *  so the deck never flickers on unrelated Firestore updates). */
  private syncDeck(cards: StoredStatCard[]): void {
    // Newest-curated first (homeAddedAt is stamped when an admin flags a card
    // for Home). The surrounding feed is shuffled per time-window, which kept
    // pushing freshly-curated stories out of the 5-card deck — the deck should
    // always lead with what was just added.
    const when = (c: StoredStatCard) =>
      Date.parse((c as any).homeAddedAt || c.updatedAt || c.createdAt || '') || 0;
    const next = cards.slice().sort((a, b) => when(b) - when(a)).slice(0, 5);
    const key = next.map(c => c.id).join('|');
    if (key === this.deckKey) return;
    this.deckKey = key;
    // Unmount (Swiper's disconnectedCallback destroys the instance), then mount
    // a fresh container next tick and initialize it.
    this.storyCards = [];
    setTimeout(() => {
      this.storyCards = next;
      setTimeout(() => this.initStoriesSwiper(), 0);
    }, 0);
  }

  trackById(_: number, c: StoredStatCard): string { return c.id ?? ''; }

  /** The three hand-designed story cards, in deck order, matched to the real
   *  curated cards behind them — so tapping one opens the actual shareable
   *  card (share link, PNG, OG image) instead of being a dead prototype. */
  private readonly storyMatch = [/mosquito/i, /old age|age-related/i, /freshwater|drinkable/i];

  /**
   * A tap anywhere on the deck. A peeking BACK card slides to the front; only
   * the FRONT card (or its "See the full story" button, whose click bubbles
   * here) opens the detail page.
   *
   * NOTE: do NOT guard on `swiper.animating` — with the `creative` effect that
   * flag stays true after the transition ends, which silently blocked every
   * open. Swiper's own `preventClicks` already swallows the click that ends a
   * drag, so a swipe never navigates.
   */
  onStoryTap(slide: number, story: number): void {
    const swiper = this.storiesSwiper?.nativeElement?.swiper;
    if (!swiper) { this.openStory(story); return; }
    if (swiper.activeIndex === slide) this.openStory(story);
    else swiper.slideTo(slide);
  }

  openStory(i: number): void {
    const re = this.storyMatch[i];
    const card = this.recentCards.find(c => re.test(c.data?.title || ''))
      ?? this.recentCards.find(c => re.test(c.data?.insight || ''));
    if (card) this.open(card);
    else this.goExplore();
  }

  // Placeholder share counts for the "Most shared today" row — real share
  // tracking isn't wired up yet, so these are illustrative for now.
  readonly mockShares = ['12K', '9.8K', '7.6K', '6.1K'];

  goExplore(topic?: string): void {
    this.router.navigate(['/explore'], topic ? { state: { topic } } : {});
  }
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

  // "Today's weird stories" coverflow carousel (Swiper web component).
  @ViewChild('storiesSwiper') storiesSwiper?: ElementRef<any>;

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

  // Configure Swiper via element PROPERTIES (object params don't bind reliably as
  // attributes), then initialize — the coverflow effect centers the active card
  // and tucks the neighbours behind it, scaled down, exactly like the reference.
  ngAfterViewInit(): void {
    // The <swiper-container> web component may not be upgraded the instant this
    // hook fires, so defer a tick before configuring + initializing it.
    setTimeout(() => this.initStoriesSwiper(), 0);
  }

  private initStoriesSwiper(): void {
    const el: any = this.storiesSwiper?.nativeElement ?? document.querySelector('.stories-swiper');
    // Guard PER ELEMENT, not per component: the deck lives under an *ngIf, so
    // if the curated list ever empties and refills, Angular destroys and
    // recreates <swiper-container init="false">. A component-level latch would
    // skip initialize() on the new element, leaving an empty shadow root — the
    // section renders as a blank gap until a full reload.
    if (!el || el.swiper?.initialized || typeof el.initialize !== 'function') return;
    Object.assign(el, {
      slidesPerView: 1,       // all cards occupy one centred slot; the effect stacks them
      initialSlide: 0,        // open on the FEATURED card (storyCards[0]), in front
      grabCursor: true,
      // NOTE: promoting a clicked back card is handled in onStoryTap(), NOT via
      // Swiper's slideToClickedSlide — that option updates activeIndex before
      // Angular's click handler runs, so the handler can't tell "promote this
      // back card" from "open the front card" and would navigate on both.
      watchSlidesProgress: true,
      observer: true,         // recompute the stack when the swiper becomes visible/sized
      observeParents: true,
      // Stacked "deck": the active card sits in FRONT; the card before it tucks
      // behind to the back-left, and the card after it further back on the right.
      // Scrolling animates cards smoothly between these stacked positions.
      effect: 'creative',
      creativeEffect: {
        limitProgress: 2,
        perspective: true,
        // Both back cards peek clearly — one to the left, one to the right —
        // brought forward (small negative Z) so a good slice of each shows. No
        // Z-rotation: the back cards stay flat/horizontal, not tilted.
        prev: { translate: ['-23%', 0, -60], rotate: [0, 0, 0], scale: 0.88, opacity: 0.82 },
        next: { translate: ['23%', 0, -80], rotate: [0, 0, 0], scale: 0.86, opacity: 0.74 },
      },
      pagination: { clickable: true },
      // Let the pagination dots sit BELOW the cards (Swiper's shadow-DOM .swiper
      // clips overflow by default, which would hide dots placed under the cards).
      injectStyles: ['.swiper { overflow: visible; }'],
    });
    el.initialize();
    // The creative/stack transforms only compute on an update() — the initial
    // initialize() leaves the slides flat. Nudge updates as layout settles
    // (twice, to catch Ionic's page-transition timing).
    setTimeout(() => el.swiper?.update(), 60);
    setTimeout(() => el.swiper?.update(), 350);
  }

  // Re-apply the stack transforms whenever the Home view (re)enters — the swiper
  // may have been laid out while off-screen, leaving the effect uncomputed.
  ionViewDidEnter(): void {
    setTimeout(() => this.storiesSwiper?.nativeElement?.swiper?.update(), 50);
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

    // Home feed: admin-curated cards flagged showOnHome (toggled from a card's
    // options menu, or the admin panel). Single-equality query — served by the
    // automatic single-field index, no composite needed. Order is shuffled on a
    // rotating window so repeat visitors see a fresh arrangement.
    this.cardSub = this.afs
      .collection<StoredStatCard>('stats', ref =>
        ref.where('showOnHome', '==', true).limit(60)
      )
      .valueChanges({ idField: 'id' })
      .subscribe({
        next: docs => {
          const valid = docs.filter(d => d.data?.title && d.data?.cardType);
          this.recentCards = this.shuffleForWindow(valid);
          this.isLoading = false;
          // The stories deck is *ngIf'd on this data, so its <swiper-container>
          // only exists AFTER the cards land — syncDeck mounts and initializes
          // it (and rebuilds it if the curated set later changes).
          this.syncDeck(this.recentCards);
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
        ...planModalOptions('onboard'),
      });
      await modal.present();
      await modal.onWillDismiss();
      this.refreshUsage();
    }

    // Check generation limit
    const canGenerate = await this.membership.canGenerate();
    if (!canGenerate) {
      const modal = await this.modalCtrl.create({
        ...planModalOptions('limit'),
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
      ...planModalOptions('upgrade'),
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
