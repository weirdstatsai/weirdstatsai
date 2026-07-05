import { Component, OnInit, NgZone } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { HttpClient } from '@angular/common/http';
import { ActionSheetController, AlertController, ModalController, ToastController } from '@ionic/angular';
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
import { AdminService } from '../services/admin.service';
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
    private modalCtrl: ModalController,
    private toastCtrl: ToastController,
    private ngZone: NgZone,
    private membership: MembershipService,
    private adminService: AdminService,
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
              // Ask before saving — show the card; nothing is stored until the
              // user taps "Save to Drafts". Keep the prompt so the draft records it.
              this.storedCard = { id: '', status: 'completed', createdBy: uid ?? '', createdAt: new Date().toISOString(), prompt, promptHash: '', data: event.data };
              this.isSaved = false;
              this.isLoading = false;
              this.statusMsg = '';
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
    const sheet = await this.actionSheetCtrl.create({
      buttons: [
        {
          text: 'Share card',
          icon: 'share-social-outline',
          handler: () => { setTimeout(() => this.goShare(), 250); },
        },
        {
          text: 'Report',
          icon: 'flag-outline',
          handler: () => { setTimeout(() => this._reportCard(), 250); },
        },
        { text: 'Cancel', role: 'cancel', icon: 'close' },
      ],
    });
    await sheet.present();
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


  /** Stored visibility: 'draft' | 'private' | 'published', or undefined if unsaved. */
  get cardStatus(): 'draft' | 'private' | 'published' | undefined {
    return this.storedCard?.id ? (this.storedCard?.publishStatus ?? 'draft') : undefined;
  }

  /** Freshly generated / not yet stored in the account. */
  get isUnsaved(): boolean {
    return !!this.card && !this.storedCard?.id;
  }

  async presentActions(): Promise<void> {
    const user = await firstValueFrom(this.authService.user$);
    const buttons: any[] = [];
    const status = this.cardStatus;

    if (this.isUnsaved) {
      // Nothing saved yet — keep it as a draft first
      if (user) {
        buttons.push({ text: 'Save to Drafts', icon: 'bookmark-outline', handler: () => this.saveAsDraft() });
      } else {
        buttons.push({ text: 'Sign in to save', icon: 'log-in-outline', handler: () => this.promptSignIn() });
      }
      buttons.push(
        { text: this.editing ? 'Done editing' : 'Edit card', icon: 'create-outline', handler: () => { this.editing = !this.editing; } },
        { text: 'Share card', icon: 'share-social-outline', handler: () => this.goShare() },
      );
    } else {
      // Saved record — status-specific visibility actions
      buttons.push({ text: 'Save changes', icon: 'save-outline', handler: () => this.saveChanges() });

      if (status === 'draft') {
        buttons.push({ text: 'Publish…', icon: 'earth-outline', handler: () => this.publishFlow() });
      } else if (status === 'private') {
        buttons.push(
          { text: 'Make public', icon: 'earth-outline', handler: () => this.makePublic() },
          { text: 'Move to Drafts', icon: 'document-text-outline', handler: () => this.moveToDraft() },
        );
      } else if (status === 'published') {
        buttons.push(
          { text: 'Make private', icon: 'lock-closed-outline', handler: () => this.makePrivate() },
          { text: 'Move to Drafts', icon: 'document-text-outline', handler: () => this.moveToDraft() },
        );
      }

      buttons.push(
        { text: this.editing ? 'Done editing' : 'Edit card', icon: 'create-outline', handler: () => { this.editing = !this.editing; } },
        { text: 'Share card', icon: 'share-social-outline', handler: () => this.goShare() },
        { text: 'Delete card', icon: 'trash-outline', role: 'destructive', handler: () => this.confirmDelete() },
      );
    }

    buttons.push({ text: 'Cancel', role: 'cancel' });

    const sheet = await this.actionSheetCtrl.create({ buttons });
    await sheet.present();
  }

  /** Save a freshly generated card as a Draft in the user's account (Firestore). */
  async saveAsDraft(): Promise<void> {
    if (!this.card) { this.toast('No card to save.'); return; }
    const user = await firstValueFrom(this.authService.user$);
    if (!user) { this.promptSignIn(); return; }
    try {
      const id = this.storedCard?.id || this.afs.createId();
      const doc: StoredStatCard = {
        id,
        status: 'completed',
        publishStatus: 'draft',
        createdBy: user.uid,
        createdAt: this.storedCard?.createdAt ?? new Date().toISOString(),
        prompt: this.storedCard?.prompt ?? '',
        promptHash: this.storedCard?.promptHash ?? '',
        data: this.card,
      };
      await this.afs.doc(`stats/${id}`).set(doc);
      this.storedCard = doc;
      this.isSaved = true;
      this.toast('Saved to Drafts');
    } catch {
      this.toast('Save failed.');
    }
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
    if (data.choice === 'public') await this._applyStatus('published', 'Published — live on Explore!');
    else await this.makePrivate();
  }

  private async makePublic(): Promise<void> {
    await this._applyStatus('published', 'Now public — live on Explore!');
  }

  private async makePrivate(): Promise<void> {
    const allowed = await this.adminService.isAdmin() || await this.membership.isPremium();
    if (allowed) { await this._applyStatus('private', 'Set to private'); return; }
    const modal = await this.modalCtrl.create({
      component: PlanModalComponent, componentProps: { mode: 'limit' },
      breakpoints: [0, 1], initialBreakpoint: 1, handle: false,
    });
    await modal.present();
    const { data } = await modal.onWillDismiss();
    if (data?.plan === 'premium') await this._applyStatus('private', 'Set to private');
  }

  private async moveToDraft(): Promise<void> {
    await this._applyStatus('draft', 'Moved to Drafts');
  }

  /** Update the stored card's visibility status. */
  private async _applyStatus(status: 'draft' | 'private' | 'published', msg: string): Promise<void> {
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

  /** Persist in-place edits (accent / badge / font size) back to the saved card. */
  private async saveChanges(): Promise<void> {
    const id = this.storedCard?.id;
    if (!id || !this.card) return;
    try {
      await this.afs.doc(`stats/${id}`).update({ data: this.card });
      this.storedCard = { ...this.storedCard!, data: this.card };
      this.editing = false;
      this.toast('Changes saved.');
    } catch {
      this.toast('Could not save changes.');
    }
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
    const id = this.storedCard?.id;
    if (!id) return;
    try {
      await this.afs.doc(`stats/${id}`).delete();
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
    if (this.returnUrl) { this.router.navigateByUrl(this.returnUrl); return; }
    this.router.navigate([this.isSaved ? '/tabs/profile' : '/tabs/explore']);
  }

  private async toast(msg: string): Promise<void> {
    const t = await this.toastCtrl.create({ message: msg, duration: 1800, position: 'bottom' });
    await t.present();
  }
}
