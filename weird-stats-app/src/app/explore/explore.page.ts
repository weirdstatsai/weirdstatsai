import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Subscription } from 'rxjs';
import { StoredStatCard, CardType } from '../models/weird-card.model';

interface ExploreCategory {
  id: string;
  label: string;
  emoji: string;
}

// Fact/map/ranking/table cards span two columns — all others are 3:4 tiles
const FULL_WIDTH_TYPES: CardType[] = ['fact', 'map', 'ranking', 'table'];

@Component({
  selector: 'app-explore',
  templateUrl: './explore.page.html',
  styleUrls: ['./explore.page.scss'],
})
export class ExplorePage implements OnInit, OnDestroy {
  categories: ExploreCategory[] = [
    { id: 'Trending',    label: 'Trending',    emoji: '🔥' },
    { id: 'Animals',     label: 'Animals',     emoji: '🦁' },
    { id: 'Countries',   label: 'Countries',   emoji: '🌍' },
    { id: 'Money',       label: 'Money',       emoji: '💸' },
    { id: 'Technology',  label: 'Tech',        emoji: '📱' },
    { id: 'Health',      label: 'Health',      emoji: '🧠' },
    { id: 'Sports',      label: 'Sports',      emoji: '⚽' },
  ];
  activeCategory = 'Trending';
  cards: StoredStatCard[] = [];
  searchQuery = '';
  isLoading = true;
  matchingProfiles: Array<{ name: string; uid: string; cardCount: number }> = [];

  private sub?: Subscription;

  constructor(
    private router: Router,
    private afs: AngularFirestore,
  ) {}

  ngOnInit(): void {
    // Newest first, and pull a wide window so valid cards aren't crowded out by
    // legacy docs. Only cards with the new schema (cardType present) are shown.
    this.sub = this.afs
      .collection<StoredStatCard>('stats', ref => ref.orderBy('createdAt', 'desc').limit(200))
      .valueChanges()
      .subscribe({
        next: docs => {
          this.cards = docs
            .filter(d => d.data?.title && d.data?.cardType)
            .filter(d => d.publishStatus === 'published')
            .sort((a, b) => (b.data?.weirdScore ?? 0) - (a.data?.weirdScore ?? 0));
          this.isLoading = false;
          this._computeProfiles();
        },
        error: () => { this.cards = []; this.isLoading = false; },
      });
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  onSearchChange(): void {
    this._computeProfiles();
  }

  setCategory(id: string): void {
    this.activeCategory = id;
    this.searchQuery = '';
    this.matchingProfiles = [];
  }

  isFullWidth(card: StoredStatCard): boolean {
    return FULL_WIDTH_TYPES.includes(card.data?.cardType);
  }


  get filteredCards(): StoredStatCard[] {
    const q = this.searchQuery.trim().toLowerCase();
    let list = this.cards;

    if (this.activeCategory !== 'Trending') {
      const cat = this.activeCategory.toLowerCase();
      list = list.filter(c =>
        (c.data?.uiMeta?.category ?? '').toLowerCase() === cat ||
        (c.data?.tags ?? []).some(t => t.toLowerCase().includes(cat)),
      );
    }

    if (q) {
      list = list.filter(c =>
        c.data?.title?.toLowerCase().includes(q) ||
        (c.data?.uiMeta?.category ?? '').toLowerCase().includes(q) ||
        (c.prompt ?? '').toLowerCase().includes(q) ||
        (c.data?.tags ?? []).some(t => t.toLowerCase().includes(q)),
      );
    }
    return this.pairCards(list);
  }

  /**
   * Reorder so non-fact cards always appear in pairs.
   * Fact cards (full-width) interleave after each pair.
   * A lone non-fact card (odd total) goes at the very end.
   */
  private pairCards(list: StoredStatCard[]): StoredStatCard[] {
    const tiles  = list.filter(c => !this.isFullWidth(c));
    const fulls  = list.filter(c =>  this.isFullWidth(c));
    const result: StoredStatCard[] = [];
    let ti = 0; let fi = 0;

    while (ti < tiles.length) {
      // Push a pair of tiles
      result.push(tiles[ti++]);
      if (ti < tiles.length) result.push(tiles[ti++]);
      // After each pair, insert one full-width card if available
      if (fi < fulls.length) result.push(fulls[fi++]);
    }
    // Remaining full-width cards
    while (fi < fulls.length) result.push(fulls[fi++]);
    return result;
  }

  open(card: StoredStatCard): void {
    // View-only — published cards, no edit panel or alternatives
    this.router.navigate(['/card'], { state: { card, viewOnly: true } });
  }


  private _computeProfiles(): void {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) { this.matchingProfiles = []; return; }
    const map = new Map<string, { name: string; uid: string; count: number }>();
    for (const card of this.cards) {
      const name = card.createdByName ?? '';
      const uid = card.createdBy ?? '';
      if (!name || uid === 'seed' || uid === 'Anonymous') continue;
      if (name.toLowerCase().includes(q)) {
        if (!map.has(uid)) map.set(uid, { name, uid, count: 0 });
        map.get(uid)!.count++;
      }
    }
    this.matchingProfiles = Array.from(map.values())
      .map(v => ({ name: v.name, uid: v.uid, cardCount: v.count }));
  }

  openProfile(uid: string): void {
    this.router.navigate(['/public-profile', uid]);
  }
}
