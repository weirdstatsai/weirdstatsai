import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { firstValueFrom } from 'rxjs';
import { StoredStatCard } from '../models/weird-card.model';

@Component({
  selector: 'app-public-profile',
  templateUrl: './public-profile.page.html',
  styleUrls: ['./public-profile.page.scss'],
})
export class PublicProfilePage implements OnInit {
  uid = '';
  displayName = '';
  cards: StoredStatCard[] = [];
  isLoading = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private afs: AngularFirestore,
  ) {}

  async ngOnInit(): Promise<void> {
    this.uid = this.route.snapshot.paramMap.get('uid') ?? '';
    if (!this.uid) { this.isLoading = false; return; }
    try {
      const snap = await firstValueFrom(
        this.afs.collection<StoredStatCard>('stats', ref =>
          ref.where('createdBy', '==', this.uid)
             .where('publishStatus', '==', 'published')
             .limit(50)
        ).get()
      );
      this.cards = snap.docs
        .map(d => d.data() as StoredStatCard)
        .filter(c => c.data?.title && c.data?.cardType)
        .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
      this.displayName = this.cards[0]?.createdByName ?? 'User';
    } catch { }
    this.isLoading = false;
  }

  open(card: StoredStatCard): void {
    this.router.navigate(['/card'], { state: { card, viewOnly: true } });
  }

  back(): void { this.router.navigate(['/explore']); }

  initial(): string { return this.displayName.charAt(0).toUpperCase() || '?'; }
}
