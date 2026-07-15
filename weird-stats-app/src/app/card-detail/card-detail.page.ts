import { Component, OnInit, NgZone, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { HttpClient } from '@angular/common/http';
import { ActionSheetController, AlertController, ToastController, LoadingController, NavController, ModalController } from '@ionic/angular';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const domtoimage = require('dom-to-image-more');
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { WeirdCard, StoredStatCard, ACCENT_COLORS } from '../models/weird-card.model';
import { cardHasData } from '../shared/card-data.util';
import { AuthService } from '../services/auth.service';
import { RankStyle } from '../shared/cards/card-ranking/card-ranking.component';
import { TableStyle } from '../shared/cards/card-table/card-table.component';
import { KpiStyle, kpiAltStylesFor } from '../shared/cards/card-kpi/card-kpi.component';
import { VersusStyle } from '../shared/cards/card-versus/card-versus.component';
import { MapStyle, hasMappableRows } from '../shared/cards/card-map/card-map.component';
import { MembershipService } from '../services/membership.service';
import { AdminService } from '../services/admin.service';
import { DraftService } from '../services/draft.service';
import { SeoService } from '../services/seo.service';
import { AnalyticsService } from '../services/analytics.service';
import { EmojiService } from '../services/emoji.service';
import { PublishModalComponent } from '../shared/publish-modal/publish-modal.component';
import { PlanModalComponent } from '../shared/plan-modal/plan-modal.component';
import firebase from 'firebase/compat/app';

@Component({
  selector: 'app-card-detail',
  templateUrl: './card-detail.page.html',
  styleUrls: ['./card-detail.page.scss'],
})
export class CardDetailPage implements OnInit {
  card?: WeirdCard;
  storedCard?: StoredStatCard;
  isLoading = false;
  statusMsg = '';
  // Card type revealed by the backend mid-generation, before the card is ready —
  // drives the shape-specific loading skeleton. Empty until the classifier reports.
  skeletonType = '';
  errorMsg = '';

  // ── Frame-first loading state machine ─────────────────────────────────────
  // The loading UI renders the real card's full-width frame from the start and
  // never resizes; the real card cross-fades in on top (grid-stacked). Three
  // guards keep it honest:
  //  showLoadingUi — 300ms gate: cached/instant results never flash loading UI.
  //  frameVisible  — the frame stays mounted ~0.5s after the card lands so the
  //                  cross-fade has both layers; then it unmounts.
  //  frameLeaving  — drives the frame's fade-out class during that overlap.
  showLoadingUi = false;
  frameVisible = false;
  frameLeaving = false;
  private loadingGateTimer?: ReturnType<typeof setTimeout>;

  // ── Narrated generation steps ─────────────────────────────────────────────
  // The backend reports 3 coarse phases (step 1 research → 2 build → 3 save).
  // We narrate them as a livelier list of captions so the wait feels like real
  // work in progress. A ticker auto-advances the highlight within the phase the
  // backend is actually in, and never runs ahead of it (holds at a phase's last
  // caption until the backend moves on) so it stays honest.
  readonly genSteps: Array<{ icon: string; label: string; phase: number }> = [
    { icon: 'bulb-outline',       label: 'Understanding your question', phase: 1 },
    { icon: 'search-outline',     label: 'Researching & gathering the facts', phase: 1 },
    { icon: 'globe-outline',      label: 'Scanning trusted sources', phase: 1 },
    { icon: 'analytics-outline',  label: 'Crunching the numbers', phase: 2 },
    { icon: 'color-wand-outline', label: 'Designing your stat card', phase: 2 },
    { icon: 'sparkles-outline',   label: 'Adding the finishing touches', phase: 3 },
  ];
  genStepIndex = 0;
  private backendStep = 0;
  private genTicker?: ReturnType<typeof setInterval>;

  /** Begin narrating the steps; auto-advance within the current backend phase. */
  private startGenSteps(): void {
    this.genStepIndex = 0;
    this.backendStep = 0;
    clearInterval(this.genTicker);
    this.genTicker = setInterval(() => {
      // Furthest caption the phase the backend is currently in allows.
      const cap = this.genSteps.reduce(
        (acc, s, i) => (s.phase <= this.backendStep ? i : acc), 0);
      if (this.genStepIndex < cap) {
        this.ngZone.run(() => this.genStepIndex++);
      }
    }, 1400);
  }

  private stopGenSteps(): void {
    clearInterval(this.genTicker);
    this.genTicker = undefined;
  }

  /** Caption for the currently-highlighted generation step (empty once done). */
  get genStepLabel(): string {
    const s = this.genSteps[this.genStepIndex];
    return s ? s.label : '';
  }

  /** Arm the 300ms gate: only show loading UI if we're still waiting by then. */
  private beginLoadingUi(): void {
    clearTimeout(this.loadingGateTimer);
    this.showLoadingUi = false;
    this.loadingGateTimer = setTimeout(() => {
      if (this.isLoading) { this.showLoadingUi = true; this.frameVisible = true; }
    }, 300);
  }

  /** Data has arrived: fade the frame out while the real card fades in.
   *  Interruptible by design — the card mounts immediately; only the frame's
   *  exit is animated. If the gate never fired (cached path), no frame exists
   *  and this is just isLoading=false. */
  private revealCard(): void {
    clearTimeout(this.loadingGateTimer);
    this.showLoadingUi = false;
    this.isLoading = false;
    if (this.frameVisible) {
      this.frameLeaving = true;
      setTimeout(() => { this.frameVisible = false; this.frameLeaving = false; }, 520);
    }
    this.genStepIndex = this.genSteps.length;   // all steps done
    this.stopGenSteps();
  }

  /** Error/abort: tear the loading UI down instantly (no choreography). */
  private resetLoadingUi(): void {
    clearTimeout(this.loadingGateTimer);
    this.showLoadingUi = false;
    this.frameVisible = false;
    this.frameLeaving = false;
    this.stopGenSteps();
  }
  viewOnly = false;
  // Logged-out visitor on a shared /card/:id link — drives the sign-in bar
  // and the "make your own" acquisition CTA.
  isGuest = false;
  // The signed-in viewer is the card's creator (they opened their own link).
  isOwner = false;
  // A guest just generated this card — held locally, prompt them to sign in.
  guestUnsaved = false;
  isSaved = false;
  isAdminView = false;
  returnUrl = '';
  // True right after a fresh generation — the card is auto-saved as a draft,
  // so Back/exit should land on the Drafts tab.
  fromGenerate = false;

  // Inline share (view-only): watermark capture frame + premium flag
  @ViewChild('shareArea') shareArea?: ElementRef<HTMLElement>;
  // Offscreen 1200x630 frame captured as the social-preview (OG) image
  @ViewChild('ogArea') ogArea?: ElementRef<HTMLElement>;
  isPremium = false;

  /** Card gradient used as the OG frame backdrop (blends with the card). */
  get ogGradient(): string {
    const from = this.card?.uiMeta?.gradientFrom || '#f5f3ff';
    const to = this.card?.uiMeta?.gradientTo || '#ede9fe';
    return `linear-gradient(135deg, ${from}, ${to})`;
  }

  altTypes: Array<'bar' | 'line' | 'doughnut'> = ['bar', 'line', 'doughnut'];
  selectedAltType?: 'bar' | 'line' | 'doughnut';

  private readonly styleLabels: Record<string, string> = {
    pill: 'Value pill', percent: 'Percentage', vertical: 'Vertical', circular: 'Circular',
  };

  // Stable arrays — recomputed once per card load in ionViewWillEnter, never in getters
  rankAltStyles: Array<{ key: RankStyle; label: string }> = [];
  selectedRankStyle: RankStyle = 'bars';

  readonly tableAltStyles: Array<{ key: TableStyle; label: string }> = [
    { key: 'pill',  label: 'Value pill' },
    { key: 'bars',  label: 'Bars' },
    { key: 'rows',  label: 'Clean rows' },
  ];
  selectedTableStyle: TableStyle = 'pill';

  private readonly versusStyleLabels: Record<string, string> = {
    mirror: 'Mirror', progress: 'Progress', winner: 'Winner',
  };

  versusAltStyles: Array<{ key: VersusStyle; label: string }> = [];
  selectedVersusStyle: VersusStyle = 'default';
  selectVersusAlt(style: VersusStyle): void { this.selectedVersusStyle = style; this._persistStyle(style); }

  mapAltStyles: Array<{ key: MapStyle; label: string }> = [
    { key: 'choropleth', label: 'Choropleth' },
    { key: 'pins',       label: 'Pin dots' },
    { key: 'bubbles',    label: 'Bubbles' },
  ];
  selectedMapStyle: MapStyle = 'choropleth';
  selectMapAlt(style: MapStyle): void { this.selectedMapStyle = style; this._persistStyle(style); }

  // Data-gated: a KPI style is only offered when the card's data can honestly
  // support it. Single source of truth lives next to the component.
  get kpiAltStyles(): Array<{ key: KpiStyle; label: string }> {
    return kpiAltStylesFor(this.card);
  }
  selectedKpiStyle: KpiStyle = 'default';

  factFontSize: 'small' | 'medium' | 'large' = 'medium';
  readonly fontSizeOptions: Array<{ key: 'small' | 'medium' | 'large'; label: string }> = [
    { key: 'small',  label: 'S' },
    { key: 'medium', label: 'M' },
    { key: 'large',  label: 'L' },
  ];

  setFactFontSize(size: 'small' | 'medium' | 'large'): void {
    this.factFontSize = size;
    if (this.card?.uiMeta) {
      this.card = { ...this.card, uiMeta: { ...this.card.uiMeta, factFontSize: size } };
      this.persistCardEdits();
    }
  }

  readonly accentOptions = ACCENT_COLORS;
  readonly badgeOptions = [
    'Trending', 'Unexpected', 'Weird Gap', 'Top 5', 'Global',
    'Historic', 'Fast Rising', 'Big Difference', 'Tiny Winner', 'AI Pick',
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private afs: AngularFirestore,
    private storage: AngularFireStorage,
    private http: HttpClient,
    private authService: AuthService,
    private actionSheetCtrl: ActionSheetController,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private navCtrl: NavController,
    private modalCtrl: ModalController,
    private ngZone: NgZone,
    private membership: MembershipService,
    private adminService: AdminService,
    private drafts: DraftService,
    private seo: SeoService,
    private analytics: AnalyticsService,
    private emoji: EmojiService,
  ) {}

  private async uid(): Promise<string> {
    const user = await firstValueFrom(this.authService.user$);
    return user?.uid ?? '';
  }

  /** Current signed-in user's display name (empty for guests). */
  private async userName(): Promise<string> {
    const user = await firstValueFrom(this.authService.user$);
    return (user?.displayName || '').trim();
  }

  /** Creator attribution shown on the share page. Reads the denormalized
   *  `createdByName` on the card doc (public-readable, so a shared-link viewer
   *  can see it); falls back to the owner's own name when they're viewing a
   *  card generated before the name was captured. */
  get creatorName(): string {
    const stored = (this.storedCard?.createdByName || '').trim();
    if (stored) return stored;
    return this.isOwner ? this._selfName : '';
  }
  private _selfName = '';

  /** Creator's avatar emoji for the by-line — denormalized on the card, with an
   *  owner fallback for cards made before it was captured. */
  get creatorEmoji(): string {
    const stored = (this.storedCard?.createdByEmoji || '').trim();
    if (stored) return stored;
    return this.isOwner ? this._selfEmoji : '';
  }
  private _selfEmoji = '';

  /**
   * Stored card with no explicit status (or 'draft') is a draft. A card that
   * belongs to a project is NEVER a draft, regardless of status — this stops
   * every draft-routing path (edit persistence, delete, the actions menu)
   * from silently pulling a project card into device Drafts.
   */
  private isDraftCard(): boolean {
    if (this.storedCard?.projectId) return false;
    return (this.storedCard?.publishStatus ?? 'draft') === 'draft';
  }

  /**
   * True only for a just-generated card the user hasn't committed to their
   * drafts yet. In this state the header shows an explicit Save button + a
   * discard (trash) icon instead of the options menu. Everything else — a card
   * opened from Drafts/Saved, or one the user has just Saved — shows the menu,
   * where publish / share / (admin) feed-curation options live.
   */
  get isUnsavedDraft(): boolean {
    return this.fromGenerate && !this.isSaved && !this.viewOnly;
  }

  /**
   * Product-metrics event for opening a card. `entry` distinguishes a card
   * opened from the in-app feed vs a shared/deep link. When the share UI is
   * shown (view-only), also record a share-options impression.
   */
  private trackCardOpen(entry: 'in_app' | 'deep_link'): void {
    if (!this.card) return;
    const cardId = this.route.snapshot.paramMap.get('id') || this.storedCard?.id || '';
    this.analytics.track('card_view', {
      card_id: cardId,
      card_type: this.card.cardType || '',
      entry,
    });
    if (this.viewOnly) {
      this.analytics.track('share_options_view', { card_id: cardId });
    }
  }

  /**
   * Set per-card title/description for JS-capable crawlers and browser tabs.
   * Social scrapers get their preview from the backend bot-snapshot route
   * instead (they never run this). Uses the default OG image until per-card
   * images are generated.
   */
  private applyCardSeo(): void {
    if (!this.card) return;
    const id = this.route.snapshot.paramMap.get('id');
    const plainTitle = (this.card.title ?? '').replace(/[\p{Extended_Pictographic}‍️]/gu, '').trim();
    this.seo.update({
      type: 'article',
      title: plainTitle ? `${plainTitle} — WeirdStats.ai` : undefined,
      description: this.card.insight || undefined,
      url: id ? `/card/${id}` : undefined,
    });
  }

  private _buildAltStyles(): void {
    const ui = this.card?.uiMeta;

    // Ranking alts
    const rankKeys = ui?.rankStyles?.length
      ? ui.rankStyles : ['pill', 'percent', 'vertical', 'circular'];
    this.rankAltStyles = rankKeys
      .filter(s => this.styleLabels[s])
      .map(s => ({ key: s as RankStyle, label: this.styleLabels[s] }));

    // Versus alts
    const versusKeys = ui?.versusStyles?.length
      ? ui.versusStyles : ['mirror', 'progress', 'winner'];
    this.versusAltStyles = versusKeys
      .filter(s => this.versusStyleLabels[s])
      .map(s => ({ key: s as VersusStyle, label: this.versusStyleLabels[s] }));

    // Map alts — only when the world map can actually draw this card's rows.
    // Sub-national rows (districts, states…) render an identical ranked-list
    // fallback in every style, so offering "alternatives" is pure noise.
    if (this.card?.cardType === 'map' && !hasMappableRows(this.card)) {
      this.mapAltStyles = [];
    } else {
      const mapKeys = ui?.mapStyles?.length
        ? ui.mapStyles : ['choropleth', 'pins', 'bubbles'];
      this.mapAltStyles = (mapKeys as MapStyle[])
        .filter(s => ['choropleth', 'pins', 'bubbles'].includes(s))
        .map(s => this.mapAltStyles.find(a => a.key === s) ?? { key: s, label: s });
    }

    // Chart alts — a time series (year labels) is never "parts of a whole", so
    // offering a doughnut is misleading. Give it line + bar only; other charts
    // keep the full set. Default the selection to the card's current type.
    if (this.card?.cardType === 'chart') {
      const labels = this.card.labels ?? [];
      const years = labels.filter(l => /(1[6-9]\d{2}|2[0-1]\d{2})/.test(String(l))).length;
      const timeSeries = labels.length >= 2 && years >= Math.ceil(labels.length * 0.6);
      this.altTypes = timeSeries ? ['line', 'bar'] : ['bar', 'line', 'doughnut'];
      const cur = this.card.chartType as 'bar' | 'line' | 'doughnut';
      this.selectedAltType = this.altTypes.includes(cur) ? cur : this.altTypes[0];
    }

    // Restore previously selected style
    const saved = ui?.selectedStyle;
    if (saved) {
      const ct = this.card?.cardType;
      if (ct === 'ranking' && this.styleLabels[saved]) this.selectedRankStyle = saved as RankStyle;
      else if (ct === 'kpi') this.selectedKpiStyle = saved as KpiStyle;
      else if (ct === 'table') this.selectedTableStyle = saved as TableStyle;
      else if (ct === 'versus') this.selectedVersusStyle = saved as VersusStyle;
      else if (ct === 'map') this.selectedMapStyle = saved as MapStyle;
    }

    // Restore a previously chosen fact-card font size
    this.factFontSize = ui?.factFontSize ?? 'medium';
  }

  private _persistStyle(style: string): void {
    if (!this.card?.uiMeta) return;
    this.card = { ...this.card, uiMeta: { ...this.card.uiMeta, selectedStyle: style } };
    this.persistCardEdits();
  }

  /**
   * Write the current in-memory edits (accent color, badge, font size, alt
   * style) back to wherever this card actually lives, so leaving the page
   * never loses a customization and Publish/Share always use what's on
   * screen rather than the stale as-generated version.
   *  - Draft (not yet saved, or saved as draft)  → device-local storage.
   *  - Saved (private/published)                 → the Firestore doc in place.
   */
  private persistCardEdits(): void {
    if (!this.card || !this.storedCard) return;
    this.storedCard = { ...this.storedCard, data: this.card };
    const card = this.storedCard;
    if (this.isDraftCard()) {
      this.uid().then(uid => { if (uid) this.drafts.add(uid, card); });
    } else if (card.id) {
      this.afs.doc(`stats/${card.id}`).update({ data: card.data, updatedAt: new Date().toISOString() }).catch(() => {});
      // A published card's share/link-preview image must not drift from its
      // edited look — rebuild it (debounced) whenever a public card is edited.
      if (card.publishStatus === 'published') this.scheduleOgRefresh();
    }
  }

  ngOnInit(): void {
    // Capture navigation state synchronously during the navigation event.
    // ionViewWillEnter handles re-entry when the page is reused by Ionic's cache.
    const nav = this.router.getCurrentNavigation();
    if (nav?.extras?.state) {
      this.pendingState = nav.extras.state as { card?: StoredStatCard; prompt?: string; fromSaved?: boolean; viewOnly?: boolean; isAdminView?: boolean; returnUrl?: string };
    }
  }

  private pendingState?: { card?: StoredStatCard; prompt?: string; fromSaved?: boolean; viewOnly?: boolean; isAdminView?: boolean; returnUrl?: string };

  ionViewWillEnter(): void {
    const state = this.pendingState ?? (history.state as { card?: StoredStatCard; prompt?: string; fromSaved?: boolean; viewOnly?: boolean; isAdminView?: boolean; returnUrl?: string } | undefined);
    this.pendingState = undefined;

    // Reset state on every entry so stale card doesn't persist
    this.card = undefined;
    this.storedCard = undefined;
    this.errorMsg = '';
    this.isSaved = false;
    this.viewOnly = !!state?.viewOnly;
    this.isAdminView = !!state?.isAdminView;
    this.returnUrl = state?.returnUrl ?? '';
    this.fromGenerate = false;

    // View-only cards show inline share — watermark hidden for premium users
    if (this.viewOnly) {
      this.isPremium = false;
      this.membership.isPremium().then((p) => (this.isPremium = p)).catch(() => {});
    }

    if (state?.fromSaved) this.isSaved = true;

    if (state?.card) {
      this.storedCard = state.card;
      this.card = state.card.data;
      this._buildAltStyles();
      this.applyCardSeo();
      this.trackCardOpen('in_app');
      this.maybeBackfillOg();
      this.prepareShareImage();
    } else {
      const id = this.route.snapshot.paramMap.get('id');
      if (id) {
        this.loadById(id);
      } else if (state?.prompt) {
        this.generate(state.prompt);
      } else {
        this.errorMsg = 'Nothing to show.';
      }
    }
  }

  private async loadById(id: string): Promise<void> {
    this.isLoading = true;
    this.beginLoadingUi();
    // A card reached by its /card/:id URL — a shared link, or a page refresh —
    // is a PUBLIC view. Show the clean view-only share layout, never the
    // owner's edit/alternatives UI. Owners edit from their profile/project,
    // which navigate here with in-app state (and viewOnly stays false).
    this.viewOnly = true;
    this.isPremium = false;
    this.membership.isPremium().then((p) => (this.isPremium = p)).catch(() => {});
    this.refreshGuest();
    try {
      const snap = await firstValueFrom(this.afs.doc<StoredStatCard>(`stats/${id}`).get());
      this.storedCard = snap?.data() ?? undefined;
      this.card = this.storedCard?.data;
      if (!this.card) this.errorMsg = 'Card not found.';
      else {
        // Re-check the viewer now that we know who created the card.
        await this.refreshGuest();
        // The owner opening their OWN card's link (refresh, or a shared link
        // back to themselves) should be able to manage it — edit / publish /
        // delete — not be stuck in the read-only share layout. Non-owners keep
        // the clean public view.
        if (this.isOwner) this.viewOnly = false;
        this._buildAltStyles(); this.applyCardSeo(); this.trackCardOpen('deep_link'); this.maybeBackfillOg();
        if (this.viewOnly) this.prepareShareImage();
      }
    } catch {
      this.errorMsg = 'Could not load this card.';
    } finally {
      // Same cross-fade as generation (usually instant — the 300ms gate means
      // a quick Firestore read shows no loading UI at all).
      this.revealCard();
    }
  }

  async generate(prompt: string): Promise<void> {
    this.isLoading = true;
    this.statusMsg = 'Starting…';
    this.errorMsg = '';
    this.skeletonType = '';
    this.beginLoadingUi();
    this.startGenSteps();

    const user = await firstValueFrom(this.authService.user$);
    const uid = user?.uid ?? null;
    // Snapshot the creator's identity now so it's denormalized onto the card.
    const creatorEmoji = uid ? await firstValueFrom(this.emoji.emoji$(uid)).catch(() => '') || '' : '';

    try {
      const res = await fetch(`${environment.apiUrl}/api/generate/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, uid }),
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

          this.ngZone.run(async () => {
            if (event.type === 'status') {
              this.statusMsg = event.message;
              this.backendStep = event.step ?? this.backendStep;
            } else if (event.type === 'shape') {
              // Backend knows the card type before the (slower) format step
              // finishes — render a matching skeleton so the wait feels shorter.
              this.skeletonType = event.cardType || '';
            } else if (event.type === 'card') {
              this.card = event.data;
              this._buildAltStyles();
              this.membership.recordGeneration();
              const draft: StoredStatCard = {
                id: event.data.id,
                status: 'completed',
                publishStatus: 'draft',
                createdBy: uid ?? '',
                createdByName: (user?.displayName || '').trim(),
                createdByEmoji: creatorEmoji,
                createdAt: event.data.createdAt ?? new Date().toISOString(),
                prompt,
                promptHash: '',
                data: event.data,
              };
              // Track it so the options menu treats this as an existing draft.
              this.storedCard = draft;
              if (uid) {
                // Cloud-synced draft: claim the backend's doc so it shows in the
                // user's Drafts on every device.
                this.drafts.add(uid, draft);
              } else {
                // Guest: hold the card and prompt to sign in so it isn't lost.
                // It's claimed into their drafts automatically on login.
                this.stashGuestCard(draft);
                this.guestUnsaved = true;
                this.toast('Sign in to save this card so you don’t lose it.');
              }
              // Cross-fade: frame out, real card in (interruptible; instant
              // when the 300ms gate never fired, e.g. cached results).
              this.revealCard();
              this.statusMsg = '';
              this.skeletonType = '';
              // Stay on the detail page so the user sees the generated card and
              // can edit / save it. It's already stored as a draft above, so
              // Back/exit lands on the Drafts tab (see back()).
              this.fromGenerate = true;
            } else if (event.type === 'error') {
              this.errorMsg = event.message;
              this.isLoading = false;
              this.statusMsg = '';
              this.skeletonType = '';
              this.resetLoadingUi();
            }
          });
        }
      }
    } catch {
      this.ngZone.run(() => {
        this.errorMsg = 'Generation failed. Please try again.';
        this.isLoading = false;
        this.statusMsg = '';
        this.resetLoadingUi();
      });
    }
  }

  /**
   * Admin-only feed-curation buttons (Publish to / Remove from Explore & Home).
   * Returned for any saved card — including community cards an admin doesn't
   * own — so the admin can curate the whole published pool, not just their own
   * cards. Empty for non-admins. Labels toggle on the card's current flags.
   */
  private async _feedToggleButtons(): Promise<any[]> {
    const id = this.storedCard?.id;
    if (!id) return [];
    const user = await firstValueFrom(this.authService.user$);
    if (!user || !(await this.adminService.isAdmin(user.uid))) return [];
    const onExplore = !!this.storedCard?.showOnExplore;
    const onHome = !!this.storedCard?.showOnHome;
    return [
      {
        text: onExplore ? 'Remove from Explore' : 'Publish to Explore',
        icon: 'compass-outline',
        handler: () => this._setFeedFlag('showOnExplore', !onExplore,
          onExplore ? 'Removed from Explore' : 'Published to Explore!'),
      },
      {
        text: onHome ? 'Remove from Home' : 'Publish to Home',
        icon: 'home-outline',
        handler: () => this._setFeedFlag('showOnHome', !onHome,
          onHome ? 'Removed from Home' : 'Published to Home!'),
      },
    ];
  }

  async presentViewActions(): Promise<void> {
    // Sharing lives inline on the page; the menu is Report + Cancel — plus the
    // admin feed-curation toggles when an admin is viewing a community card.
    const sheet = await this.actionSheetCtrl.create({
      buttons: [
        ...await this._feedToggleButtons(),
        {
          text: 'Report',
          icon: 'flag-outline',
          role: 'destructive',
          handler: () => { setTimeout(() => this._reportCard(), 250); },
        },
        { text: 'Cancel', role: 'cancel', icon: 'close' },
      ],
    });
    await sheet.present();
  }

  // ── Inline share (view-only) ────────────────────────────────────────────
  /** Deep-link URL for this card */
  private cardUrl(): string {
    const base = window.location.origin;
    const id = this.storedCard?.id;
    // /card/:id is the real route — and the URL the SEO bot-snapshot + rich
    // link previews are served for. (/card-detail/:id does not exist and would
    // redirect to home.)
    return id ? `${base}/card/${id}` : base;
  }

  /** Copy the shareable card link to the clipboard. */
  async copyLink(): Promise<void> {
    const url = this.cardUrl();
    try {
      if ((navigator as any).clipboard?.writeText) {
        await (navigator as any).clipboard.writeText(url);
      } else {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      this.analytics.track('share', { method: 'copy_link', card_id: this.storedCard?.id || '' });
      this.toast('Link copied!');
    } catch {
      this.toast('Could not copy link.');
    }
  }

  /** Render the watermarked share frame to a PNG data URL */
  private async renderPng(): Promise<string | null> {
    const el = this.shareArea?.nativeElement;
    if (!el) return null;
    return domtoimage.toPng(el, { bgcolor: '#ffffff', scale: 2 });
  }

  private slug(): string {
    return (this.card?.title ?? 'weirdstats').replace(/\s+/g, '-').slice(0, 40);
  }

  // Card image, pre-rendered in the background so a share tap can hand the file
  // to the native sheet synchronously — rendering on tap would drop the
  // user-gesture that navigator.share requires.
  private shareFile?: File;

  private dataUrlToFile(dataUrl: string, filename: string): File {
    const [header, data] = dataUrl.split(',');
    const mime = header.match(/:(.*?);/)![1];
    const bytes = atob(data);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new File([arr], filename, { type: mime });
  }

  /** Render the shareable card image once, in the background, and cache it. */
  private async prepareShareImage(): Promise<void> {
    if (!this.viewOnly) return;
    // Give the card (and any chart) a beat to settle before capturing.
    await new Promise((r) => setTimeout(r, 900));
    try {
      const dataUrl = await this.renderPng();
      if (dataUrl) this.shareFile = this.dataUrlToFile(dataUrl, `${this.slug()}.png`);
    } catch { /* non-fatal — sharing falls back to the link */ }
  }

  /** True when the device can share an actual image file (phones / PWAs). */
  private get canShareImage(): boolean {
    return !!this.shareFile && !!(navigator as any).canShare?.({ files: [this.shareFile] });
  }

  /**
   * Share the card. On phones we hand the actual PNG to the native share sheet
   * so it posts as a real IMAGE — the only way Instagram works, and it makes
   * WhatsApp/Messenger/etc. send a photo instead of a link-preview. The card URL
   * rides along as text so the link still travels with the image.
   *
   * On desktop (no file share) we fall back to the platform's web-intent, where
   * the OG image unfurls — except Instagram, which has no web intent at all, so
   * we save the image for the user to upload. Must stay synchronous with the tap
   * (the image is pre-rendered) or the browser blocks share/popup.
   */
  async shareTo(network: string): Promise<void> {
    if (!this.card || !this.ensureShareable()) return;
    this.analytics.track('share', { method: network, card_id: this.storedCard?.id || '' });

    if (this.canShareImage) {
      try {
        await (navigator as any).share({ files: [this.shareFile], title: this.card.title, text: this.cardUrl() });
      } catch { /* user cancelled the sheet */ }
      return;
    }

    // Desktop: Instagram can't take a link, so hand over the image file instead.
    if (network === 'instagram') {
      this.toast('Image saved — post it to Instagram.');
      this.download();
      return;
    }
    const url = this.shareUrl(network);
    if (url && url !== '#') window.open(url, '_blank', 'noopener');
  }

  /** Platform share URL (desktop fallback / href) */
  shareUrl(network: string): string {
    const enc = encodeURIComponent;
    const url = this.cardUrl();
    const map: Record<string, string> = {
      whatsapp: `https://wa.me/?text=${enc(url)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,
      twitter:  `https://twitter.com/intent/tweet?url=${enc(url)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`,
    };
    return map[network] ?? '#';
  }

  /** Save the watermarked card as a PNG */
  async download(): Promise<void> {
    if (!this.ensureShareable()) return;
    this.analytics.track('share', { method: 'save_image', card_id: this.storedCard?.id || '' });
    const loading = await this.loadingCtrl.create({ message: 'Saving image…', duration: 8000 });
    await loading.present();
    try {
      const dataUrl = await this.renderPng();
      await loading.dismiss();
      if (!dataUrl) return;
      const link = document.createElement('a');
      link.download = `${this.slug()}.png`;
      link.href = dataUrl;
      link.click();
      this.toast('Image saved!');
    } catch {
      await loading.dismiss();
      this.toast('Could not save image.');
    }
  }

  private async _reportCard(): Promise<void> {
    const id = this.storedCard?.id;
    if (id) {
      await this.afs.doc(`stats/${id}`).update({
        flagCount: firebase.firestore.FieldValue.increment(1),
      }).catch(() => {});
    }
    const t = await this.toastCtrl.create({
      message: 'Under review — thanks for your report',
      duration: 2500,
      position: 'bottom',
      color: 'warning',
      icon: 'flag-outline',
    });
    await t.present();
  }

  async presentAdminActions(): Promise<void> {
    const sheet = await this.actionSheetCtrl.create({
      header: 'Admin actions',
      buttons: [
        {
          text: 'Approve — remove flag',
          icon: 'checkmark-circle-outline',
          handler: () => {
            setTimeout(async () => {
              const id = this.storedCard?.id;
              if (id) await this.afs.doc(`stats/${id}`).update({ flagCount: 0 }).catch(() => {});
              this.toast('Card approved — flag cleared');
              this.back();
            }, 250);
          },
        },
        {
          text: 'Delete card',
          icon: 'trash-outline',
          role: 'destructive',
          handler: () => {
            setTimeout(async () => {
              const id = this.storedCard?.id;
              if (id) await this.afs.doc(`stats/${id}`).delete().catch(() => {});
              this.toast('Card deleted');
              this.back();
            }, 250);
          },
        },
        { text: 'Cancel', role: 'cancel', icon: 'close' },
      ],
    });
    await sheet.present();
  }


  async presentActions(): Promise<void> {
    const user = await firstValueFrom(this.authService.user$);
    const buttons: any[] = [];
    const hasStoredId = !!this.storedCard?.id;
    // Saving a fresh card moved to the header (Save button); by the time this
    // menu is reachable the card is always stored, so key off publishStatus.

    if (hasStoredId) {
      if (this.isDraftCard()) {
        buttons.push({ text: 'Publish…', icon: 'earth-outline', handler: () => this.publishFlow() });
      } else if (this.storedCard?.publishStatus === 'private') {
        buttons.push(
          { text: 'Make public', icon: 'earth-outline', handler: () => this.makePublic() },
          { text: 'Duplicate card', icon: 'copy-outline', handler: () => this.duplicateCard() },
        );
      } else if (this.storedCard?.publishStatus === 'published') {
        buttons.push(
          { text: 'Make private', icon: 'lock-closed-outline', handler: () => this.makePrivate() },
          { text: 'Duplicate card', icon: 'copy-outline', handler: () => this.duplicateCard() },
        );
      }
    }

    // Admin-only feed curation (Publish to / Remove from Explore & Home).
    buttons.push(...await this._feedToggleButtons());

    // Sharing is only offered once the card is public — a draft/private card
    // has no shareable link yet. The publish flow above is the path to unlock it.
    if (this.storedCard?.publishStatus === 'published') {
      buttons.push({
        text: 'Share card',
        icon: 'share-social-outline',
        handler: () => this.goShare(),
      });
    }

    if (user && hasStoredId) {
      buttons.push({
        text: 'Delete card',
        icon: 'trash-outline',
        role: 'destructive',
        handler: () => this.confirmDelete(),
      });
    }

    buttons.push({ text: 'Cancel', role: 'cancel' });

    const sheet = await this.actionSheetCtrl.create({ buttons });
    await sheet.present();
  }

  /** Draft → choose public or private. */
  /** Guard: a hollow card (empty chart, row-less list, value-less kpi) must not
   *  be shared or published as a "No data available" shell. Backend generation
   *  now repairs these, but pre-existing stored cards may still be hollow. */
  private ensureShareable(): boolean {
    if (cardHasData(this.card)) return true;
    this.toast("This card doesn't have enough data to share yet — try regenerating it.");
    return false;
  }

  private async publishFlow(): Promise<void> {
    if (!this.ensureShareable()) return;
    const modal = await this.modalCtrl.create({
      component: PublishModalComponent,
      breakpoints: [0, 1], initialBreakpoint: 1, handle: false,
    });
    await modal.present();
    const { data } = await modal.onWillDismiss();
    if (!data?.choice) return;
    if (data.choice === 'public') {
      await this._promoteDraft('published', 'Saved publicly — anyone with the link can view it.');
    } else {
      await this._savePrivateFlow();
    }
  }

  private async _savePrivateFlow(): Promise<void> {
    const uid = await this.uid();
    const allowed = (uid && await this.adminService.isAdmin(uid)) || await this.membership.isPremium();
    if (allowed) { await this._promoteDraft('private', 'Saved privately'); return; }

    const modal = await this.modalCtrl.create({
      component: PlanModalComponent,
      componentProps: { mode: 'limit' },
      breakpoints: [0, 1], initialBreakpoint: 1, handle: false,
    });
    await modal.present();
    const { data } = await modal.onWillDismiss();
    if (data?.plan === 'premium') await this._promoteDraft('private', 'Saved privately');
  }

  /** Publish/save a draft — the draft is already this user's stats doc, so this
   *  just flips its publishStatus in place (no copy, nothing to remove). */
  private async _promoteDraft(status: 'published' | 'private', msg: string): Promise<void> {
    const uid = await this.uid();
    const card = this.storedCard;
    if (!card?.id || !uid) return;
    // Backfill the creator name + emoji onto the card doc so the share page can
    // attribute it — public-readable, so shared-link viewers see it too.
    const createdByName = (card.createdByName || '').trim() || (await this.userName());
    const createdByEmoji = (card.createdByEmoji || '').trim()
      || await firstValueFrom(this.emoji.emoji$(uid)).catch(() => '') || '';
    // A private card must never carry the public-feed flags (they grant public
    // read on their own). Drafts never have them, but clear defensively.
    const feedClear = status === 'private' ? { showOnHome: false, showOnExplore: false } : {};
    try {
      await this.afs.doc(`stats/${card.id}`).set({
        ...card,
        publishStatus: status,
        createdBy: uid,
        createdByName,
        createdByEmoji,
        createdAt: card.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...feedClear,
      }, { merge: true });
      this.storedCard = { ...card, publishStatus: status, createdByName, createdByEmoji, ...feedClear };
      this.toast(msg);
      // Public cards get shared — render the real-card social preview now.
      if (status === 'published') this.generateOgImage();
    } catch {
      this.toast('Could not save card.');
    }
  }

  private async makePublic(): Promise<void> {
    await this._updateStatus('published', 'Now public — anyone with the link can view it.');
  }

  private async makePrivate(): Promise<void> {
    const uid = await this.uid();
    const allowed = (uid && await this.adminService.isAdmin(uid)) || await this.membership.isPremium();
    if (allowed) { await this._updateStatus('private', 'Set to private'); return; }

    const modal = await this.modalCtrl.create({
      component: PlanModalComponent,
      componentProps: { mode: 'limit' },
      breakpoints: [0, 1], initialBreakpoint: 1, handle: false,
    });
    await modal.present();
    const { data } = await modal.onWillDismiss();
    if (data?.plan === 'premium') await this._updateStatus('private', 'Set to private');
  }

  /** Update a saved card's visibility status in place. */
  private async _updateStatus(status: 'private' | 'published', msg: string): Promise<void> {
    const id = this.storedCard?.id;
    if (!id) return;
    const patch: Record<string, unknown> = { publishStatus: status };
    // A private card must not stay on the public feeds — the showOnHome/
    // showOnExplore flags grant public read on their own, so clear them when
    // going private (owners are allowed to *disable* the flags in the rules).
    if (status === 'private') { patch['showOnHome'] = false; patch['showOnExplore'] = false; }
    try {
      await this.afs.doc(`stats/${id}`).update(patch);
      this.storedCard = {
        ...this.storedCard!,
        publishStatus: status,
        ...(status === 'private' ? { showOnHome: false, showOnExplore: false } : {}),
      };
      this.toast(msg);
      // Public cards get shared — render the real-card social preview now.
      if (status === 'published') this.generateOgImage();
    } catch {
      this.toast('Could not update card.');
    }
  }

  /**
   * Admin-only: toggle whether this saved card appears on the Home or Explore
   * feed. The feed queries read these flags directly. Enabling a flag also
   * publishes the card (so it's publicly visible + shareable) and renders its
   * social-preview image; disabling just clears the flag. Firestore rules
   * enforce that only admins can enable the flags.
   */
  private async _setFeedFlag(field: 'showOnHome' | 'showOnExplore', value: boolean, msg: string): Promise<void> {
    const id = this.storedCard?.id;
    if (!id) return;
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { [field]: value, updatedAt: now };
    // A card on a public feed must be public — publish it on enable.
    if (value) patch['publishStatus'] = 'published';
    // Stamp Home-added time so the admin panel's Home list orders correctly.
    if (field === 'showOnHome' && value) patch['homeAddedAt'] = now;
    try {
      await this.afs.doc(`stats/${id}`).update(patch);
      this.storedCard = {
        ...this.storedCard!,
        [field]: value,
        ...(value ? { publishStatus: 'published' as const } : {}),
        ...(field === 'showOnHome' && value ? { homeAddedAt: now } : {}),
      };
      this.toast(msg);
      if (value) this.generateOgImage();
    } catch {
      this.toast('Could not update card.');
    }
  }

  /**
   * Copy a saved card into a brand-new draft: fresh id, draft state, current
   * on-screen edits included. The original stays saved and untouched; the
   * copy lives in Drafts until the user explicitly saves/publishes it.
   * Project/import linkage is intentionally NOT copied — the duplicate is a
   * fresh personal draft.
   */
  private async duplicateCard(): Promise<void> {
    const uid = await this.uid();
    if (!this.card || !uid) return;
    const copy: StoredStatCard = {
      id: this.afs.createId(),
      status: 'completed',
      publishStatus: 'draft',
      createdBy: uid,
      createdAt: new Date().toISOString(),
      prompt: this.storedCard?.prompt ?? '',
      promptHash: '',
      data: JSON.parse(JSON.stringify(this.card)),
    };
    this.drafts.add(uid, copy);
    this.toast('Copy added to your Drafts');
  }

  private async promptSignIn(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Sign in required',
      message: 'Create a free account to save cards to your profile.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Sign In', handler: () => this.router.navigate(['/profile']) },
      ],
    });
    await alert.present();
  }

  /**
   * Commit a freshly generated card to the user's drafts and flip the header
   * into the saved state (which reveals the options menu). Stays on the page so
   * the user can immediately publish / manage it. Guests are prompted to sign in
   * first. Idempotent — a signed-in generation already auto-claimed the doc, so
   * this just re-persists and marks it saved.
   */
  async saveDraft(): Promise<void> {
    if (!this.card) { this.toast('No card to save.'); return; }
    const user = await firstValueFrom(this.authService.user$);
    if (!user) { this.promptSignIn(); return; }
    const doc: StoredStatCard = {
      id: this.storedCard?.id || this.afs.createId(),
      status: 'completed',
      publishStatus: this.storedCard?.publishStatus ?? 'draft',
      createdBy: user.uid,
      createdByName: this.storedCard?.createdByName ?? (user.displayName || '').trim(),
      createdByEmoji: this.storedCard?.createdByEmoji ?? '',
      createdAt: this.storedCard?.createdAt ?? new Date().toISOString(),
      prompt: this.storedCard?.prompt ?? '',
      promptHash: this.storedCard?.promptHash ?? '',
      data: this.card,
    };
    await this.drafts.add(user.uid, doc);
    this.storedCard = doc;
    this.isSaved = true;
    this.toast('Saved to Drafts!');
  }

  /** Discard a freshly generated, not-yet-saved card. Signed-in: same confirm +
   *  doc/OG cleanup as a normal delete. Guest: the card is only in localStorage
   *  (plus an "Anonymous" backend cache doc they can't delete under the rules),
   *  so just drop the local copy and leave — no Firestore delete to fail on. */
  async discardDraft(): Promise<void> {
    const user = await firstValueFrom(this.authService.user$);
    if (!user) {
      try { localStorage.removeItem(CardDetailPage.PENDING_KEY); } catch { /* ignore */ }
      this.guestUnsaved = false;
      this.router.navigate(['/home']);
      return;
    }
    await this.confirmDelete();
  }

  private async confirmDelete(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Delete card?',
      message: 'This cannot be undone.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Delete', role: 'destructive', handler: () => this.deleteCard() },
      ],
    });
    await alert.present();
  }

  private async deleteCard(): Promise<void> {
    const card = this.storedCard;
    if (!card?.id) return;
    try {
      // Drafts and saved/published cards are all one stats doc now — delete it,
      // and clean up its social-preview image so no orphan is left in Storage.
      await this.afs.doc(`stats/${card.id}`).delete();
      await this.deleteOgImage(card.id);
      this.toast('Card deleted.');
      this.back();
    } catch {
      this.toast('Delete failed.');
    }
  }

  selectTableAlt(style: TableStyle): void { this.selectedTableStyle = style; this._persistStyle(style); }
  selectRankAlt(style: RankStyle): void { this.selectedRankStyle = style; this._persistStyle(style); }
  selectKpiAlt(style: KpiStyle): void { this.selectedKpiStyle = style; this._persistStyle(style); }

  trackByKey(_: number, item: { key: string }): string { return item.key; }

  selectAlt(type: 'bar' | 'line' | 'doughnut'): void {
    if (!this.card) return;
    this.selectedAltType = type;
    // Picking a chart type clears any "render as comparison KPI" selection.
    this.card = { ...this.card, chartType: type, uiMeta: { ...this.card.uiMeta, selectedStyle: '' } };
    this.persistCardEdits();
  }

  // ── Chart → comparison-KPI alternative (only for 2-point time charts) ──
  get canChartCompare(): boolean {
    return this.card?.cardType === 'chart'
      && this.card.datasets?.[0]?.data?.length === 2
      && this.card.labels?.length === 2;
  }

  get isChartComparison(): boolean {
    return this.card?.uiMeta?.selectedStyle === 'comparison';
  }

  /** A preview clone flagged to render as the comparison KPI. */
  get comparisonPreviewCard(): WeirdCard {
    return { ...this.card!, uiMeta: { ...this.card!.uiMeta, selectedStyle: 'comparison' } };
  }

  selectChartComparison(): void {
    if (!this.card) return;
    this.card = { ...this.card, uiMeta: { ...this.card.uiMeta, selectedStyle: 'comparison' } };
    this.persistCardEdits();
  }

  private readonly accentGradients: Record<string, { from: string; to: string }> = {
    '#6C5CE7': { from: '#f5f3ff', to: '#ede9fe' },
    '#378ADD': { from: '#e3f2fd', to: '#e8eaf6' },
    '#1D9E75': { from: '#e8f5e9', to: '#f1f8e9' },
    '#D85A30': { from: '#fff3ee', to: '#fce8e0' },
    '#BA7517': { from: '#fff8e1', to: '#fef3c7' },
  };

  setAccent(hex: string): void {
    if (!this.card) return;
    const grad = this.accentGradients[hex] ?? { from: '#f5f3ff', to: '#ffffff' };
    this.card = {
      ...this.card,
      uiMeta: {
        ...this.card.uiMeta,
        accentColor: hex,
        gradientFrom: grad.from,
        gradientTo: grad.to,
      },
    };
    this.persistCardEdits();
  }

  setBadge(badge: string): void {
    if (!this.card) return;
    this.card = { ...this.card, uiMeta: { ...this.card.uiMeta, insightBadge: badge } };
    this.persistCardEdits();
  }

  goShare(): void {
    if (!this.card || !this.ensureShareable()) return;
    // A card must be published before it can be shared — until then there's no
    // public link. Owners publish via the options menu (Publish… / Make public).
    if (this.storedCard?.publishStatus !== 'published') {
      this.toast('Publish this card first to share it.');
      return;
    }
    this.router.navigate(['/share-card'], {
      state: { card: this.card, cardId: this.storedCard?.id ?? null },
    });
  }

  back(): void {
    // Admin flow targets a specific page.
    if (this.returnUrl) { this.router.navigateByUrl(this.returnUrl); return; }
    // A freshly generated card was auto-saved as a draft — send the user to the
    // Drafts tab so they can find it.
    if (this.fromGenerate) {
      this.router.navigate(['/profile'], { state: { tab: 'draft' } });
      return;
    }
    // Owner opening their own shared link (a fresh tab, no in-app history) —
    // Back has nowhere to go, so take them to their account.
    if (this.viewOnly && this.isOwner) {
      this.router.navigate(['/profile']);
      return;
    }
    // Everyone else returns along the real navigation stack, so Back mirrors how
    // the user actually arrived (Home, Profile, Explore, a public profile…).
    this.navCtrl.back();
  }

  private async toast(msg: string): Promise<void> {
    const t = await this.toastCtrl.create({ message: msg, duration: 1800, position: 'bottom' });
    await t.present();
  }

  // ── Social-preview (OG) image: render the real card, store in Storage ───
  /**
   * Render the offscreen 1200x630 frame (the actual card on its gradient) to a
   * PNG, upload to Storage at og/{id}.png, and save the URL on the card doc so
   * the backend's share/OG meta points at the real card instead of the
   * generic template. Non-fatal: any failure just leaves the template.
   * Only the card's owner can write (Storage + Firestore rules).
   */
  private async generateOgImage(): Promise<void> {
    const id = this.storedCard?.id;
    const el = this.ogArea?.nativeElement;
    if (!id || !el) return;
    try {
      // Let Chart.js and layout settle before capturing.
      await new Promise((r) => setTimeout(r, 700));
      // Scale the card down to fit the fixed 1200×630 canvas so a tall card
      // (long table, big chart + story) is never clipped at the title/story.
      this.fitOgTile(el);
      const dataUrl: string = await domtoimage.toPng(el, {
        width: 1200, height: 630, bgcolor: '#ffffff',
      });
      const ref = this.storage.ref(`og/${id}.png`);
      await ref.putString(dataUrl, 'data_url', { contentType: 'image/png' });
      const url = await firstValueFrom(ref.getDownloadURL());
      await this.afs.doc(`stats/${id}`).update({ ogImage: url });
      if (this.storedCard) this.storedCard = { ...this.storedCard, ogImage: url };
    } catch (e) {
      console.warn('OG image generation failed', e);
    }
  }

  /** Scale the OG tile so its natural height fits the fixed 1200×630 canvas.
   *  Only ever scales DOWN (never upscales a short card); a short card stays
   *  centered on the gradient, a tall one shrinks to fit with nothing clipped. */
  private fitOgTile(frame: HTMLElement): void {
    const tile = frame.querySelector('.og-tile') as HTMLElement | null;
    if (!tile) return;
    tile.style.transform = '';
    tile.style.transformOrigin = 'center center';
    const availH = 630 - 88;              // frame height minus 44px top+bottom padding
    const availW = 1200;
    const natH = tile.scrollHeight;
    const natW = tile.scrollWidth;
    const scale = Math.min(1, availH / natH, availW / natW);
    if (scale < 1) tile.style.transform = `scale(${scale})`;
  }

  /** Remove a card's social-preview image from Storage on delete, so deleting a
   *  card never leaves an orphaned og/{id}.png behind. Non-fatal. */
  private async deleteOgImage(id: string): Promise<void> {
    try { await firstValueFrom(this.storage.ref(`og/${id}.png`).delete()); }
    catch { /* no image, or already gone — fine */ }
  }

  private ogRefreshTimer?: ReturnType<typeof setTimeout>;
  /** Rebuild a published card's OG image after edits settle, so its share
   *  preview always matches the current look (debounced against rapid edits). */
  private scheduleOgRefresh(): void {
    if (this.ogRefreshTimer) clearTimeout(this.ogRefreshTimer);
    this.ogRefreshTimer = setTimeout(() => this.generateOgImage(), 1500);
  }

  /** Owner viewing their own published card that has no preview yet — build
   *  it quietly in the background (lazy backfill for pre-existing cards). */
  private async maybeBackfillOg(): Promise<void> {
    const card = this.storedCard;
    if (!card?.id || card.ogImage || card.publishStatus !== 'published') return;
    const uid = await this.uid();
    if (uid && uid === card.createdBy) this.generateOgImage();
  }

  // ── Guest card hold + claim-on-login ────────────────────────────────────
  private static readonly PENDING_KEY = 'weirdstats_pending_card';

  private stashGuestCard(card: StoredStatCard): void {
    try { localStorage.setItem(CardDetailPage.PENDING_KEY, JSON.stringify(card)); } catch { /* quota */ }
  }

  /** After a guest signs in, move the card they generated into their cloud
   *  drafts so nothing is lost. Safe to call whenever a user becomes present. */
  private async claimGuestCardIfAny(uid: string): Promise<void> {
    if (!uid) return;
    let pending: StoredStatCard | undefined;
    try {
      const raw = localStorage.getItem(CardDetailPage.PENDING_KEY);
      pending = raw ? JSON.parse(raw) as StoredStatCard : undefined;
    } catch { pending = undefined; }
    if (!pending?.id) return;
    await this.drafts.add(uid, { ...pending, createdBy: uid });
    try { localStorage.removeItem(CardDetailPage.PENDING_KEY); } catch { /* ignore */ }
    this.guestUnsaved = false;
    if (this.storedCard?.id === pending.id) this.storedCard = { ...this.storedCard, createdBy: uid };
    this.toast('Saved to your drafts.');
  }

  // ── Shared-link visitor (logged-out) acquisition ────────────────────────
  private async refreshGuest(): Promise<void> {
    const user = await firstValueFrom(this.authService.user$);
    this.isGuest = !user;
    this.isOwner = !!user && user.uid === this.storedCard?.createdBy;
    // Fallback attribution for the owner viewing a pre-name/emoji card.
    this._selfName = (user?.displayName || '').trim();
    if (user) {
      this._selfEmoji = await firstValueFrom(this.emoji.emoji$(user.uid)).catch(() => '') || '';
      await this.claimGuestCardIfAny(user.uid);
    }
  }

  /** Open the sign-in modal; re-check guest state afterwards so the bar/CTA
   *  disappear the moment they sign in. */
  async openLogin(): Promise<void> {
    const { LoginComponent } = await import('../login/login.component');
    const modal = await this.modalCtrl.create({ component: LoginComponent, cssClass: 'login-modal' });
    await modal.present();
    await modal.onWillDismiss();
    await this.refreshGuest();
    this.analytics.track('share_signin_click', { card_id: this.storedCard?.id || '' });
  }

  /** "Make your own" CTA on a shared card — guests sign in first. */
  goCreate(): void {
    this.analytics.track('share_cta_click', { card_id: this.storedCard?.id || '' });
    if (this.isGuest) { this.openLogin(); return; }
    this.router.navigate(['/home']);
  }
}
