import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { ModalController } from '@ionic/angular';
import { Subscription, firstValueFrom } from 'rxjs';
import { StoredStatCard } from '../models/weird-card.model';
import { MembershipService } from '../services/membership.service';
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

  private cardSub?: Subscription;
  private authSub?: Subscription;

  constructor(
    private router: Router,
    private afs: AngularFirestore,
    private afAuth: AngularFireAuth,
    private modalCtrl: ModalController,
    private membership: MembershipService,
  ) {}

  ionViewWillEnter(): void {
    const state = history.state as { prefillQuery?: string } | undefined;
    if (state?.prefillQuery) {
      this.query = state.prefillQuery;
    }
  }

  ngOnInit(): void {
    this.authSub = this.afAuth.authState.subscribe(user => {
      if (user) {
        this.userName = user.displayName
          ? user.displayName.split(' ')[0]
          : (user.email?.split('@')[0] ?? '');
        this.userEmoji = localStorage.getItem('weird_stats_emoji_' + user.uid) ?? '';
      } else {
        this.userName = '';
        this.userEmoji = '';
      }
    });

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
      return;
    }

    this.query = '';
    this.router.navigate(['/card'], { state: { prompt: p } });
  }

  open(card: StoredStatCard): void {
    // View-only: no edit panel, no alternatives
    this.router.navigate(['/card'], { state: { card, viewOnly: true } });
  }
}
