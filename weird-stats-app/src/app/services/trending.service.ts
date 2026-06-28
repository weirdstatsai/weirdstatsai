import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface TrendingItem {
  id: string;
  prompt: string;
  icon: string;
  order: number;
  active: boolean;
}

@Injectable({ providedIn: 'root' })
export class TrendingService {
  readonly trending$: Observable<TrendingItem[]>;

  constructor(private firestore: AngularFirestore) {
    this.trending$ = this.firestore
      .collection<TrendingItem>('trending', ref =>
        ref.where('active', '==', true).orderBy('order', 'asc'),
      )
      .valueChanges({ idField: 'id' })
      .pipe(map(items => items.slice(0, 8)));
  }

  async seed(): Promise<void> {
    const items: Omit<TrendingItem, 'id'>[] = [
      { prompt: 'Nicolas Cage movies vs swimming pool drownings per year', icon: 'film', order: 1, active: true },
      { prompt: 'Coffee consumption by programming language', icon: 'cafe', order: 2, active: true },
      { prompt: 'Correlation between country name length and GDP per capita', icon: 'globe', order: 3, active: true },
      { prompt: 'Sleep hours vs life satisfaction by age group', icon: 'bed', order: 4, active: true },
      { prompt: 'Dog ownership rate vs national happiness index', icon: 'paw', order: 5, active: true },
      { prompt: 'Number of Ikea stores vs divorce rate by country', icon: 'home', order: 6, active: true },
      { prompt: 'Ice cream sales vs shark attacks by month', icon: 'ice-cream', order: 7, active: true },
      { prompt: 'Productivity by time of day for different professions', icon: 'time', order: 8, active: true },
    ];

    const batch = this.firestore.firestore.batch();
    for (const item of items) {
      const ref = this.firestore.collection('trending').doc().ref;
      batch.set(ref, item);
    }
    await batch.commit();
  }
}
