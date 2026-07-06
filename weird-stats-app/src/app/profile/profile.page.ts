import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { ModalController, ToastController, ActionSheetController, AlertController, PopoverController } from '@ionic/angular';
import { Observable, of, switchMap, Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AuthService } from '../services/auth.service';
import { LoginComponent } from '../login/login.component';
import { EmojiPickerComponent } from '../shared/emoji-picker/emoji-picker.component';
import { StoredStatCard } from '../models/weird-card.model';
import { Project, projectInitials } from '../models/project.model';
import { ProjectModalComponent } from '../shared/project-modal/project-modal.component';
import { ProjectService } from '../services/project.service';
import { AppConfigService } from '../services/app-config.service';
import { MembershipService } from '../services/membership.service';
import { AdminService } from '../services/admin.service';
import { DraftService } from '../services/draft.service';
import { PlanModalComponent } from '../shared/plan-modal/plan-modal.component';
import { PublishModalComponent } from '../shared/publish-modal/publish-modal.component';
import { CardMenuPopoverComponent } from '../shared/card-menu-popover/card-menu-popover.component';
import { RankStyle } from '../shared/cards/card-ranking/card-ranking.component';
import { KpiStyle } from '../shared/cards/card-kpi/card-kpi.component';
import { TableStyle } from '../shared/cards/card-table/card-table.component';

const EMOJI_STORAGE_KEY = 'weird_stats_emoji_';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
})
export class ProfilePage implements OnInit, OnDestroy {
  user$ = this.authService.user$;
  userProfile$ = this.authService.userProfile$;
  savedCards$: Observable<StoredStatCard[]> = of([]);
  savedCards: StoredStatCard[] = [];   // from Firestore (published + private)
  draftCards: StoredStatCard[] = [];   // from device localStorage
  isLoading = true;
  activeFilter: 'all' | 'chart' | 'map' | 'fact' = 'all';
  activeTab: 'saved' | 'draft' | 'projects' = 'saved';
  projects: Project[] = [];
  isCreatingProject = false;
  private currentUid = '';
  private sub?: Subscription;
  private projSub?: Subscription;

  // Inline draft alternatives panel
  selectedDraft?: StoredStatCard;
  selectedRankStyle: RankStyle = 'bars';
  selectedKpiStyle: KpiStyle = 'default';
  selectedTableStyle: TableStyle = 'pill';
  selectedChartType: 'bar' | 'line' | 'doughnut' = 'bar';

  readonly rankStyleLabels: Record<string, string> = {
    pill: 'Value pill', percent: 'Percentage', vertical: 'Vertical', circular: 'Circular',
  };
  readonly kpiAltStyles: Array<{ key: KpiStyle; label: string }> = [
    { key: 'default', label: 'Default' },
    { key: 'comparison', label: 'Comparison' },
    { key: 'hero', label: 'Hero' },
    { key: 'circular', label: 'Circular' },
  ];
  readonly tableAltStyles: Array<{ key: TableStyle; label: string }> = [
    { key: 'pill', label: 'Value pill' },
    { key: 'bars', label: 'Bars' },
    { key: 'rows', label: 'Clean rows' },
  ];
  readonly chartAltTypes: Array<'bar' | 'line' | 'doughnut'> = ['bar', 'line', 'doughnut'];

  get rankAltStyles(): Array<{ key: RankStyle; label: string }> {
    const styles = this.selectedDraft?.data?.uiMeta?.rankStyles ?? ['pill', 'percent', 'vertical', 'circular'];
    return styles
      .filter(s => this.rankStyleLabels[s])
      .map(s => ({ key: s as RankStyle, label: this.rankStyleLabels[s] }));
  }

  constructor(
    private afs: AngularFirestore,
    private authService: AuthService,
    private toastCtrl: ToastController,
    private modalCtrl: ModalController,
    private actionSheetCtrl: ActionSheetController,
    private alertCtrl: AlertController,
    private popoverCtrl: PopoverController,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private membership: MembershipService,
    private adminService: AdminService,
    private drafts: DraftService,
    private projectService: ProjectService,
    private appConfig: AppConfigService,
  ) {}

  /** Projects tab is gated behind the `projects` feature flag. */
  get showProjectsTab(): boolean {
    return this.appConfig.isEnabled('projects');
  }

  ngOnInit(): void {
    this.sub = this.user$.pipe(
      switchMap(user => {
        this.currentUid = user?.uid ?? '';
        this.draftCards = user ? this.drafts.list(user.uid) : [];

        if (!user) return of([] as StoredStatCard[]);
        return this.afs
          .collection<StoredStatCard>('stats', ref =>
            ref.where('createdBy', '==', user.uid).limit(300)
          )
          .valueChanges();
      }),
    ).subscribe({
      next: docs => {
        // Saved tab = published + private cards owned by the user
        this.savedCards = docs
          .filter(d => d.data?.title && d.data?.cardType)
          .filter(d => ['published', 'private'].includes(d.publishStatus ?? 'draft'))
          .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
        this.isLoading = false;
      },
      error: () => { this.savedCards = []; this.isLoading = false; },
    });

    // Live stream of the user's projects (stored on their user doc)
    this.projSub = this.user$.pipe(
      switchMap(user => user ? this.projectService.projects$(user.uid) : of([] as Project[])),
    ).subscribe(list => {
      this.projects = [...list].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
      this.cdr.detectChanges();
    });
  }

  ionViewWillEnter(): void {
    // Refresh local drafts each time the page is shown
    if (this.currentUid) this.draftCards = this.drafts.list(this.currentUid);
    // Open straight to a specific tab when navigated with a hint (e.g. Back from
    // a freshly generated draft → Drafts tab).
    const tab = (history.state as { tab?: 'saved' | 'draft' } | undefined)?.tab;
    if (tab === 'saved' || tab === 'draft') this.activeTab = tab;
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); this.projSub?.unsubscribe(); }

  getEmoji(uid: string): string | null {
    return localStorage.getItem(EMOJI_STORAGE_KEY + uid);
  }

  setFilter(f: 'all' | 'chart' | 'map' | 'fact'): void {
    this.activeFilter = f;
  }

  setTab(tab: 'saved' | 'draft' | 'projects'): void {
    this.activeTab = tab;
    this.selectedDraft = undefined;
  }

  // ── Projects ──────────────────────────────────────────────────────────────
  projectInitials(name: string): string {
    return projectInitials(name);
  }

  get projectCount(): number {
    return this.projects.length;
  }

  async openCreateProject(): Promise<void> {
    if (!this.currentUid) return;
    const modal = await this.modalCtrl.create({
      component: ProjectModalComponent,
      cssClass: 'project-modal',
    });
    await modal.present();
    const { data } = await modal.onWillDismiss();
    if (!data) return;
    await this.createProject(data);
  }

  private async createProject(name: string): Promise<void> {
    if (!this.currentUid) return;
    this.activeTab = 'projects';
    this.isCreatingProject = true;
    this.cdr.detectChanges();
    try {
      await this.projectService.create(this.currentUid, name);
      // The projects list refreshes via the live subscription.
    } catch {
      const t = await this.toastCtrl.create({ message: 'Could not create project', duration: 1500, color: 'danger' });
      await t.present();
    } finally {
      // Keep the wave skeleton briefly so the incoming row animates in
      setTimeout(() => { this.isCreatingProject = false; this.cdr.detectChanges(); }, 650);
    }
  }

  openProject(project: Project): void {
    this.router.navigate(['/project', project.project_id]);
  }

  get draftCount(): number {
    return this.draftCards.length;
  }

  get savedCount(): number {
    return this.savedCards.length;
  }

  filteredCards(): StoredStatCard[] {
    let cards = this.activeTab === 'saved' ? this.savedCards : this.draftCards;
    if (this.activeFilter !== 'all') {
      cards = cards.filter(c => {
        const t = c.data?.cardType;
        if (this.activeFilter === 'chart') return t === 'chart' || t === 'ranking' || t === 'kpi' || t === 'versus' || t === 'table';
        if (this.activeFilter === 'map') return t === 'map';
        if (this.activeFilter === 'fact') return t === 'fact';
        return true;
      });
    }
    return cards;
  }

  // Wide card types span two grid columns — same set as home/explore.
  isFullWidth(card: StoredStatCard): boolean {
    const t = card.data?.cardType;
    return t === 'map' || t === 'fact' || t === 'ranking' || t === 'table';
  }

  selectDraft(card: StoredStatCard): void {
    if (this.selectedDraft?.id === card.id) {
      this.selectedDraft = undefined;
      return;
    }
    this.selectedDraft = card;
    this.selectedRankStyle = 'bars';
    this.selectedKpiStyle = 'default';
    this.selectedTableStyle = 'pill';
    this.selectedChartType = (card.data?.chartType as any) ?? 'bar';
    this.cdr.detectChanges();
  }

  openMenuId: string | null = null;

  toggleCardMenu(id: string): void {
    this.openMenuId = this.openMenuId === id ? null : id;
  }

  closeMenu(): void { this.openMenuId = null; }

  async menuAction(action: string, card: StoredStatCard): Promise<void> {
    this.openMenuId = null;
    switch (action) {
      case 'open':    this.openCard(card); break;
      case 'publish': await this.togglePublish(card); break;
      case 'edit':    this.editCard(card); break;
      case 'delete':  await this.deleteCard(card); break;
    }
  }

  async showCardMenu(card: StoredStatCard, event: Event): Promise<void> {
    const isPublished = (card.publishStatus ?? 'draft') !== 'draft';
    const popover = await this.popoverCtrl.create({
      component: CardMenuPopoverComponent,
      componentProps: { isPublished },
      event,
      dismissOnSelect: true,
      showBackdrop: true,
      backdropDismiss: true,
      cssClass: 'card-menu-pop',
    });
    await popover.present();
    const { data } = await popover.onWillDismiss();
    if (!data?.action) return;
    switch (data.action) {
      case 'open':    this.openCard(card); break;
      case 'publish': await this.togglePublish(card); break;
      case 'edit':    this.editCard(card); break;
      case 'delete':  await this.deleteCard(card); break;
    }
  }

  editCard(card: StoredStatCard): void {
    this.router.navigate(['/card'], { state: { card, fromSaved: true } });
  }

  async deleteCard(card: StoredStatCard): Promise<void> {
    if (!card.id) return;
    try {
      if (this.isDraft(card)) {
        // Local draft — just remove from device
        this.drafts.remove(this.currentUid, card.id);
        this.draftCards = this.drafts.list(this.currentUid);
      } else {
        await this.afs.collection('stats').doc(card.id).delete();
      }
      const t = await this.toastCtrl.create({ message: 'Card deleted', duration: 1500, color: 'danger' });
      await t.present();
    } catch {
      const t = await this.toastCtrl.create({ message: 'Could not delete', duration: 1500, color: 'danger' });
      await t.present();
    }
  }

  async openCardActions(card: StoredStatCard, event: Event): Promise<void> {
    event.stopPropagation();
    const status = card.publishStatus ?? 'draft';
    const isPublished = status !== 'draft';
    const sheet = await this.actionSheetCtrl.create({
      header: card.data?.title?.slice(0, 50) ?? 'Card',
      buttons: [
        {
          text: 'Open card',
          icon: 'eye-outline',
          handler: () => { setTimeout(() => this.openCard(card), 250); },
        },
        {
          text: isPublished ? 'Move to Drafts' : 'Publish',
          icon: isPublished ? 'lock-closed-outline' : 'earth-outline',
          handler: () => { setTimeout(() => this.togglePublish(card), 250); },
        },
        { text: 'Cancel', role: 'cancel', icon: 'close' },
      ],
    });
    await sheet.present();
  }

  private isDraft(card: StoredStatCard): boolean {
    return (card.publishStatus ?? 'draft') === 'draft';
  }

  async togglePublish(card: StoredStatCard): Promise<void> {
    if (!card.id) return;

    // Saved card → move back to Drafts (delete Firestore, restore local draft)
    if (!this.isDraft(card)) {
      await this._moveToDrafts(card);
      return;
    }

    // Draft → choose how to save
    const modal = await this.modalCtrl.create({
      component: PublishModalComponent,
      breakpoints: [0, 1], initialBreakpoint: 1,
      handle: false,
    });
    await modal.present();
    const { data } = await modal.onWillDismiss();
    if (!data?.choice) return;
    if (data.choice === 'public') {
      await this._saveCard(card, 'published');
    } else {
      await this._savePrivate(card);
    }
  }

  private async _savePrivate(card: StoredStatCard): Promise<void> {
    // Premium members (and admins) save privately straight away — no upsell.
    const allowed = await this.adminService.isAdmin(this.currentUid) || await this.membership.isPremium();
    if (allowed) {
      await this._saveCard(card, 'private');
      return;
    }

    // Free users see the upgrade sheet first.
    const modal = await this.modalCtrl.create({
      component: PlanModalComponent,
      componentProps: { mode: 'limit' },
      breakpoints: [0, 1], initialBreakpoint: 1,
      handle: false,
    });
    await modal.present();
    const { data } = await modal.onWillDismiss();
    if (data?.plan === 'premium') await this._saveCard(card, 'private');
  }

  // Promote a local draft into the user's Firestore collection
  private async _saveCard(card: StoredStatCard, status: 'published' | 'private'): Promise<void> {
    try {
      const id = card.id;
      await this.afs.collection('stats').doc(id).set({
        ...card,
        publishStatus: status,
        createdBy: this.currentUid,
        createdAt: card.createdAt ?? new Date().toISOString(),
      });
      this.drafts.remove(this.currentUid, id);
      this.draftCards = this.drafts.list(this.currentUid);
      this.selectedDraft = undefined;
      this.activeTab = 'saved';
      const msg = status === 'published' ? 'Saved publicly — live on Explore!' : 'Saved privately';
      const t = await this.toastCtrl.create({ message: msg, duration: 1800, color: 'primary' });
      await t.present();
    } catch {
      const t = await this.toastCtrl.create({ message: 'Could not save card', duration: 1500, color: 'danger' });
      await t.present();
    }
  }

  // Move a saved card back to device drafts
  private async _moveToDrafts(card: StoredStatCard): Promise<void> {
    try {
      await this.afs.collection('stats').doc(card.id).delete();
      this.drafts.add(this.currentUid, { ...card, publishStatus: 'draft' });
      this.draftCards = this.drafts.list(this.currentUid);
      this.activeTab = 'draft';
      const t = await this.toastCtrl.create({ message: 'Moved to Drafts', duration: 1600, color: 'medium' });
      await t.present();
    } catch {
      const t = await this.toastCtrl.create({ message: 'Could not move card', duration: 1500, color: 'danger' });
      await t.present();
    }
  }

  getTypeIcon(cardType?: string): string {
    switch (cardType) {
      case 'chart':   return 'bar-chart-outline';
      case 'ranking': return 'trophy-outline';
      case 'kpi':     return 'trending-up-outline';
      case 'versus':  return 'git-compare-outline';
      case 'table':   return 'grid-outline';
      case 'map':     return 'earth-outline';
      case 'fact':    return 'bulb-outline';
      default:        return 'stats-chart-outline';
    }
  }

  openCard(card: StoredStatCard): void {
    this.router.navigate(['/card'], { state: { card, fromSaved: true } });
  }

  goExplore(): void {
    this.router.navigate(['/explore']);
  }

  async openAvatarPicker(uid: string): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: EmojiPickerComponent,
      componentProps: { current: this.getEmoji(uid) },
      breakpoints: [0, 0.6, 0.9],
      initialBreakpoint: 0.6,
      handle: true,
    });
    await modal.present();
    const { data } = await modal.onWillDismiss();
    if (data) localStorage.setItem(EMOJI_STORAGE_KEY + uid, data);
  }

  async openEditSheet(): Promise<void> {
    const sheet = await this.actionSheetCtrl.create({
      buttons: [
        {
          text: 'Change Display Name',
          icon: 'person-outline',
          handler: () => { setTimeout(() => this.changeDisplayName(), 250); },
        },
        { text: 'Cancel', role: 'cancel', icon: 'close' },
      ],
    });
    await sheet.present();
  }

  goAccount(): void {
    this.router.navigate(['/account']);
  }

  async changeDisplayName(): Promise<void> {
    const current = this.authService.getCurrentUser()?.displayName || '';
    const alert = await this.alertCtrl.create({
      header: 'Change display name',
      inputs: [
        {
          name: 'name',
          type: 'text',
          value: current,
          placeholder: 'Your display name',
          attributes: { maxlength: 30, autocapitalize: 'words' },
        },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Save',
          handler: (data: { name?: string }) => {
            const name = (data.name ?? '').trim();
            if (!name) return false; // keep the dialog open on empty input
            this.saveDisplayName(name);
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  private async saveDisplayName(name: string): Promise<void> {
    try {
      await this.authService.updateDisplayName(name);
      const t = await this.toastCtrl.create({ message: 'Name updated!', duration: 1500, color: 'success' });
      await t.present();
    } catch {
      const t = await this.toastCtrl.create({ message: 'Could not update name.', duration: 1500, color: 'danger' });
      await t.present();
    }
  }

  async signIn(): Promise<void> {
    const modal = await this.modalCtrl.create({ component: LoginComponent, cssClass: 'login-modal' });
    await modal.present();
  }

  async signOut(): Promise<void> {
    await this.authService.signOut();
  }

  async showComingSoon(): Promise<void> {
    const t = await this.toastCtrl.create({ message: 'Coming soon!', duration: 1500, color: 'primary' });
    await t.present();
  }
}
