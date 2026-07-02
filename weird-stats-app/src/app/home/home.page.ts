import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { ModalController, ToastController } from '@ionic/angular';
import { Subscription, firstValueFrom } from 'rxjs';
import { StoredStatCard } from '../models/weird-card.model';
import { MembershipService, UsageInfo } from '../services/membership.service';
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
  private usageTimer?: ReturnType<typeof setInterval>;

  constructor(
    private router: Router,
    private afs: AngularFirestore,
    private afAuth: AngularFireAuth,
    private modalCtrl: ModalController,
    private toastCtrl: ToastController,
    private membership: MembershipService,
  ) {}

  async openNotifications(): Promise<void> {
    const toast = await this.toastCtrl.create({
      message: 'Notifications — coming soon!',
      duration: 1800,
      position: 'top',
      icon: 'notifications-outline',
    });
    await toast.present();
  }

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
        this.userEmoji = localStorage.getItem('weird_stats_emoji_' + user.uid) ?? '';
        this.refreshUsage();
      } else {
        this.userName = '';
        this.userEmoji = '';
        this.usage = null;
        this.usageCountdown = '';
      }
    });

    // Recompute the countdown text from the cached resetAt every minute —
    // no extra Firestore reads, just a local clock tick.
    this.usageTimer = setInterval(() => this.tickCountdown(), 60_000);

    // Home feed: published cards only, sorted client-side to avoid composite index
    this.cardSub = this.afs
      .collection<StoredStatCard>('stats', ref =>
        ref.where('publishStatus', '==', 'published').limit(25)
      )
      .valueChanges({ idField: 'id' })
      .subscribe({
        next: docs => {
          this.recentCards = docs
            .filter(d => d.data?.title && d.data?.cardType)
            .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
          this.isLoading = false;
        },
        error: () => { this.isLoading = false; },
      });
  }

  ngOnDestroy(): void {
    this.cardSub?.unsubscribe();
    this.authSub?.unsubscribe();
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
      const modal = await this.modalCtrl.create({ component: (await import('../login/login.component')).LoginComponent });
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

  // Map and fact cards need horizontal room to read — span both grid columns.
  // All other cards stay strict 2-up; grid-auto-flow: dense fills any hole a
  // full-width row break would leave by pulling the next tile up.
  isFullWidth(card: StoredStatCard): boolean {
    return card.data?.cardType === 'map' || card.data?.cardType === 'fact';
  }
}
