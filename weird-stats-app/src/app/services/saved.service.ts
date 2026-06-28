import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { Graph } from '../models/graph.model';
import { AuthService } from './auth.service';

interface StoredGraph extends Omit<Graph, 'createdAt'> {
  createdAt: string;
  savedAt: string;
}

@Injectable({ providedIn: 'root' })
export class SavedService {
  readonly saved$: Observable<Graph[]>;

  constructor(
    private firestore: AngularFirestore,
    private authService: AuthService,
  ) {
    this.saved$ = this.authService.user$.pipe(
      switchMap(user => {
        if (!user) return of([]);
        return this.firestore
          .collection<StoredGraph>(`users/${user.uid}/saved`, ref =>
            ref.orderBy('savedAt', 'desc'),
          )
          .valueChanges()
          .pipe(
            map(docs =>
              docs.map(d => ({ ...d, createdAt: new Date(d.createdAt) })),
            ),
          );
      }),
    );
  }

  async save(uid: string, graph: Graph): Promise<void> {
    const data: StoredGraph = {
      ...graph,
      createdAt: graph.createdAt.toISOString(),
      savedAt: new Date().toISOString(),
    };
    await this.firestore.doc(`users/${uid}/saved/${graph.id}`).set(data);
  }

  async unsave(uid: string, graphId: string): Promise<void> {
    await this.firestore.doc(`users/${uid}/saved/${graphId}`).delete();
  }

  async isSaved(uid: string, graphId: string): Promise<boolean> {
    const snap = await this.firestore
      .doc(`users/${uid}/saved/${graphId}`)
      .get()
      .toPromise();
    return snap?.exists ?? false;
  }
}
