import { Component, OnInit, NgZone, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { HttpClient } from '@angular/common/http';
import { ActionSheetController, AlertController, ToastController, LoadingController, NavController, ModalController } from '@ionic/angular';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const domtoimage = require('dom-to-image-more');
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { WeirdCard, StoredStatCard, ACCENT_COLORS } from '../models/weird-card.model';
import { AuthService } from '../services/auth.service';
import { RankStyle } from '../shared/cards/card-ranking/card-ranking.component';
import { TableStyle } from '../shared/cards/card-table/card-table.component';
import { KpiStyle } from '../shared/cards/card-kpi/card-kpi.component';
import { VersusStyle } from '../shared/cards/card-versus/card-versus.component';
import { MapStyle, hasMappableRows } from '../shared/cards/card-map/card-map.component';
import { MembershipService } from '../services/membership.service';
import { AdminService } from '../services/admin.service';
import { DraftService } from '../services/draft.service';
import { SeoService } from '../services/seo.service';
import { AnalyticsService } from '../services/analytics.service';
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
  errorMsg = '';
  viewOnly = false;
  editing = false;
  isSaved = false;
  isAdminView = false;
  returnUrl = '';
  // True right after a fresh generation — the card is auto-saved as a draft,
  // so Back/exit should land on the Drafts tab.
  fromGenerate = false;

  // Inline share (view-only): watermark capture frame + premium flag
  @ViewChild('shareArea') shareArea?: ElementRef<HTMLElement>;
  isPremium = false;
  get canNativeShare(): boolean {
    return !!(navigator as any).share && !!(navigator as any).canShare;
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

  readonly kpiAltStyles: Array<{ key: KpiStyle; label: string }> = [
    { key: 'default',    label: 'Default' },
    { key: 'comparison', label: 'Comparison' },
    { key: 'hero',       label: 'Hero' },
  ];
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
  ) {}

  private async uid(): Promise<string> {
    const user = await firstValueFrom(this.authService.user$);
    return user?.uid ?? '';
  }

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
      this.afs.doc(`stats/${card.id}`).update({ data: card.data }).catch(() => {});
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
    this.editing = false;
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
    try {
      const snap = await firstValueFrom(this.afs.doc<StoredStatCard>(`stats/${id}`).get());
      this.storedCard = snap?.data() ?? undefined;
      this.card = this.storedCard?.data;
      if (!this.card) this.errorMsg = 'Card not found.';
      else { this._buildAltStyles(); this.applyCardSeo(); this.trackCardOpen('deep_link'); }
    } catch {
      this.errorMsg = 'Could not load this card.';
    } finally {
      this.isLoading = false;
    }
  }

  async generate(prompt: string): Promise<void> {
    this.isLoading = true;
    this.statusMsg = 'Starting…';
    this.errorMsg = '';

    const user = await firstValueFrom(this.authService.user$);
    const uid = user?.uid ?? null;

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
            } else if (event.type === 'card') {
              this.card = event.data;
              this._buildAltStyles();
              this.membership.recordGeneration();
              // Store the new card as a device-local draft (not in Firestore)
              if (uid) {
                const draft: StoredStatCard = {
                  id: event.data.id,
                  status: 'completed',
                  publishStatus: 'draft',
                  createdBy: uid,
                  createdAt: event.data.createdAt ?? new Date().toISOString(),
                  prompt,
                  promptHash: '',
                  data: event.data,
                };
                this.drafts.add(uid, draft);
                // Track it so the options menu treats this as an existing
                // draft (Publish/Delete) instead of offering to save it again.
                this.storedCard = draft;
              }
              this.isLoading = false;
              this.statusMsg = '';
              // Stay on the detail page so the user sees the generated card and
              // can edit / save it. It's already stored as a draft above, so
              // Back/exit lands on the Drafts tab (see back()).
              this.fromGenerate = true;
            } else if (event.type === 'error') {
              this.errorMsg = event.message;
              this.isLoading = false;
              this.statusMsg = '';
            }
          });
        }
      }
    } catch {
      this.ngZone.run(() => {
        this.errorMsg = 'Generation failed. Please try again.';
        this.isLoading = false;
        this.statusMsg = '';
      });
    }
  }

  async presentViewActions(): Promise<void> {
    // Sharing now lives inline on the page; the menu is just Report + Cancel.
    const sheet = await this.actionSheetCtrl.create({
      buttons: [
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

  private dataUrlToFile(dataUrl: string, filename: string): File {
    const [header, data] = dataUrl.split(',');
    const mime = header.match(/:(.*?);/)![1];
    const bytes = atob(data);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new File([arr], filename, { type: mime });
  }

  private slug(): string {
    return (this.card?.title ?? 'weirdstats').replace(/\s+/g, '-').slice(0, 40);
  }

  /** Share the watermarked card image directly — native sheet on mobile, URL on desktop */
  async shareTo(network: string): Promise<void> {
    if (!this.card) return;
    this.analytics.track('share', { method: network, card_id: this.storedCard?.id || '' });
    const loading = await this.loadingCtrl.create({ message: 'Preparing…', duration: 8000 });
    await loading.present();
    try {
      const dataUrl = await this.renderPng();
      const cardUrl = this.cardUrl();

      if (dataUrl && this.canNativeShare) {
        const file = this.dataUrlToFile(dataUrl, `${this.slug()}.png`);
        if ((navigator as any).canShare({ files: [file] })) {
          await loading.dismiss();
          try {
            await (navigator as any).share({ files: [file], url: cardUrl, title: this.card.title });
          } catch { /* user cancelled */ }
          return;
        }
      }

      await loading.dismiss();
      const url = this.shareUrl(network);
      if (url && url !== '#') window.open(url, '_blank', 'noopener');
    } catch {
      await loading.dismiss();
      this.toast('Something went wrong.');
    }
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

    if (!hasStoredId) {
      // Freshly generated — nothing stored yet
      if (user) {
        buttons.push({ text: 'Save to Drafts', icon: 'bookmark-outline', handler: () => this.saveCard() });
      } else {
        buttons.push({ text: 'Sign in to save', icon: 'log-in-outline', handler: () => this.promptSignIn() });
      }
    } else if (this.isDraftCard()) {
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

    buttons.push(
      {
        text: 'Edit card',
        icon: 'create-outline',
        handler: () => { this.editing = !this.editing; },
      },
      {
        text: 'Share card',
        icon: 'share-social-outline',
        handler: () => this.goShare(),
      },
    );

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
  private async publishFlow(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: PublishModalComponent,
      breakpoints: [0, 1], initialBreakpoint: 1, handle: false,
    });
    await modal.present();
    const { data } = await modal.onWillDismiss();
    if (!data?.choice) return;
    if (data.choice === 'public') {
      await this._promoteDraft('published', 'Saved publicly — live on Explore!');
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

  /** Promote a local draft into the user's Firestore collection. */
  private async _promoteDraft(status: 'published' | 'private', msg: string): Promise<void> {
    const uid = await this.uid();
    const card = this.storedCard;
    if (!card?.id || !uid) return;
    try {
      await this.afs.collection('stats').doc(card.id).set({
        ...card,
        publishStatus: status,
        createdBy: uid,
        createdAt: card.createdAt ?? new Date().toISOString(),
      });
      this.drafts.remove(uid, card.id);
      this.storedCard = { ...card, publishStatus: status };
      this.toast(msg);
    } catch {
      this.toast('Could not save card.');
    }
  }

  private async makePublic(): Promise<void> {
    await this._updateStatus('published', 'Now public — live on Explore!');
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
    try {
      await this.afs.doc(`stats/${id}`).update({ publishStatus: status });
      this.storedCard = { ...this.storedCard!, publishStatus: status };
      this.toast(msg);
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

  /** Save a freshly generated card as a device-local draft (never Firestore). */
  async saveCard(): Promise<void> {
    if (!this.card) { this.toast('No card to save.'); return; }
    const user = await firstValueFrom(this.authService.user$);
    if (!user) { this.toast('Sign in to save cards.'); return; }
    const doc: StoredStatCard = {
      id: this.storedCard?.id || this.afs.createId(),
      status: 'completed',
      publishStatus: 'draft',
      createdBy: user.uid,
      createdAt: this.storedCard?.createdAt ?? new Date().toISOString(),
      prompt: this.storedCard?.prompt ?? '',
      promptHash: this.storedCard?.promptHash ?? '',
      data: this.card,
    };
    this.drafts.add(user.uid, doc);
    this.isSaved = true;
    this.storedCard = doc;
    this.toast('Saved to Drafts!');
    this.router.navigate(['/profile'], { state: { tab: 'draft' } });
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
      if (this.isDraftCard()) {
        const uid = await this.uid();
        if (uid) this.drafts.remove(uid, card.id);
      } else {
        await this.afs.doc(`stats/${card.id}`).delete();
      }
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
    this.card = { ...this.card, chartType: type };
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
    if (!this.card) return;
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
    // Everyone else returns along the real navigation stack, so Back mirrors how
    // the user actually arrived (Home, Profile, Explore, a public profile…).
    this.navCtrl.back();
  }

  private async toast(msg: string): Promise<void> {
    const t = await this.toastCtrl.create({ message: msg, duration: 1800, position: 'bottom' });
    await t.present();
  }
}
