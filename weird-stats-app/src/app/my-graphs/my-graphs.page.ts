import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Subscription } from 'rxjs';
import { StoredStatCard } from '../models/weird-card.model';

type FilterTab = 'all' | 'chart' | 'ranking' | 'kpi' | 'versus' | 'fact' | 'table' | 'map';

@Component({
  selector: 'app-my-graphs',
  templateUrl: './my-graphs.page.html',
  styleUrls: ['./my-graphs.page.scss'],
})
export class MyGraphsPage implements OnInit, OnDestroy {
  activeTab: FilterTab = 'all';
  searchQuery = '';
  allCards: StoredStatCard[] = [];
  isLoading = true;

  readonly tabs: { id: FilterTab; label: string; emoji: string }[] = [
    { id: 'all',     label: 'All',     emoji: '✨' },
    { id: 'chart',   label: 'Charts',  emoji: '📊' },
    { id: 'ranking', label: 'Rankings',emoji: '🏆' },
    { id: 'kpi',     label: 'KPIs',    emoji: '🎯' },
    { id: 'versus',  label: 'Versus',  emoji: '⚡' },
    { id: 'fact',    label: 'Facts',   emoji: '💡' },
    { id: 'table',   label: 'Tables',  emoji: '📋' },
    { id: 'map',     label: 'Maps',    emoji: '🗺️' },
  ];

  private sub?: Subscription;

  constructor(
    private afs: AngularFirestore,
    private router: Router,
    private alertCtrl: AlertController,
  ) {}

  ngOnInit(): void {
    this.sub = this.afs
      .collection<StoredStatCard>('stats', ref =>
        ref.orderBy('createdAt', 'desc').limit(200)
      )
      .valueChanges({ idField: 'id' })
      .subscribe({
        next: docs => {
          this.allCards = docs.filter(d => d.data?.title && d.data?.cardType);
          this.isLoading = false;
        },
        error: () => { this.isLoading = false; },
      });
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  setTab(tab: FilterTab): void { this.activeTab = tab; }

  get filteredCards(): StoredStatCard[] {
    const q = this.searchQuery.trim().toLowerCase();
    return this.allCards.filter(c => {
      const matchesTab = this.activeTab === 'all' || c.data?.cardType === this.activeTab;
      const matchesSearch = !q ||
        c.data?.title?.toLowerCase().includes(q) ||
        (c.prompt ?? '').toLowerCase().includes(q) ||
        (c.data?.tags ?? []).some(t => t.toLowerCase().includes(q));
      return matchesTab && matchesSearch;
    });
  }

  open(card: StoredStatCard): void {
    this.router.navigate(['/card'], { state: { card } });
  }

  async confirmDelete(e: Event, card: StoredStatCard): Promise<void> {
    e.stopPropagation();
    const alert = await this.alertCtrl.create({
      header: 'Delete card?',
      message: `"${card.data?.title}" will be removed permanently.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => {
            if (card.id) this.afs.doc(`stats/${card.id}`).delete();
          },
        },
      ],
    });
    await alert.present();
  }

  goGenerate(): void {
    this.router.navigate(['/home']);
  }

  trackById(_i: number, card: StoredStatCard): string {
    return card.id ?? _i.toString();
  }
}
