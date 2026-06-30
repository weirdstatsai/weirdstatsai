import { Component, OnInit, NgZone, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { HttpClient } from '@angular/common/http';
import { ActionSheetController, AlertController, ToastController, LoadingController, NavController } from '@ionic/angular';

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
import { MapStyle } from '../shared/cards/card-map/card-map.component';
import { MembershipService } from '../services/membership.service';
import { DraftService } from '../services/draft.service';
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
    if (this.card?.uiMeta) (this.card.uiMeta as any).factFontSize = size;
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
    private ngZone: NgZone,
    private membership: MembershipService,
    private drafts: DraftService,
  ) {}

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

    // Map alts
    const mapKeys = ui?.mapStyles?.length
      ? ui.mapStyles : ['choropleth', 'pins', 'bubbles'];
    this.mapAltStyles = (mapKeys as MapStyle[])
      .filter(s => ['choropleth', 'pins', 'bubbles'].includes(s))
      .map(s => this.mapAltStyles.find(a => a.key === s) ?? { key: s, label: s });

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
  }

  private _persistStyle(style: string): void {
    if (!this.card?.uiMeta) return;
    this.card = { ...this.card, uiMeta: { ...this.card.uiMeta, selectedStyle: style } };
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
      else this._buildAltStyles();
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
                this.drafts.add(uid, {
                  id: event.data.id,
                  status: 'completed',
                  publishStatus: 'draft',
                  createdBy: uid,
                  createdAt: event.data.createdAt ?? new Date().toISOString(),
                  prompt,
                  promptHash: '',
                  data: event.data,
                });
              }
              this.isLoading = false;
              this.statusMsg = '';
              this.router.navigate(['/tabs/profile']);
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
    return id ? `${base}/card-detail/${id}` : base;
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

    if (user) {
      buttons.push({
        text: 'Save card',
        icon: 'bookmark-outline',
        handler: () => this.saveCard(),
      });
    } else {
      buttons.push({
        text: 'Sign in to save',
        icon: 'log-in-outline',
        handler: () => this.promptSignIn(),
      });
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

    if (user && this.storedCard?.id) {
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

  private async promptSignIn(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Sign in required',
      message: 'Create a free account to save cards to your profile.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Sign In', handler: () => this.router.navigate(['/tabs/profile']) },
      ],
    });
    await alert.present();
  }

  async saveCard(): Promise<void> {
    if (!this.card) { this.toast('No card to save.'); return; }
    const user = await firstValueFrom(this.authService.user$);
    if (!user) { this.toast('Sign in to save cards.'); return; }
    try {
      const id = this.afs.createId();
      const doc: StoredStatCard = {
        id,
        status: 'completed',
        createdBy: user.uid,
        createdAt: new Date().toISOString(),
        prompt: this.storedCard?.prompt ?? '',
        promptHash: this.storedCard?.promptHash ?? '',
        data: this.card,
      };
      await this.afs.doc(`stats/${id}`).set(doc);
      this.isSaved = true;
      this.toast('Saved to your profile!');
      this.router.navigate(['/tabs/profile']);
    } catch {
      this.toast('Save failed.');
    }
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
    if (!this.storedCard?.id) return;
    try {
      await this.afs.doc(`stats/${this.storedCard.id}`).delete();
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
  }

  setBadge(badge: string): void {
    if (!this.card) return;
    this.card = { ...this.card, uiMeta: { ...this.card.uiMeta, insightBadge: badge } };
  }

  goShare(): void {
    if (!this.card) return;
    this.router.navigate(['/share-card'], {
      state: { card: this.card, cardId: this.storedCard?.id ?? null },
    });
  }

  back(): void {
    // Admin flow targets a specific page; everyone else returns along the real
    // navigation stack, so Back mirrors how the user actually arrived
    // (Home, Profile, Explore, a public profile…) instead of a hardcoded guess.
    if (this.returnUrl) { this.router.navigateByUrl(this.returnUrl); return; }
    this.navCtrl.back();
  }

  private async toast(msg: string): Promise<void> {
    const t = await this.toastCtrl.create({ message: msg, duration: 1800, position: 'bottom' });
    await t.present();
  }
}
