import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import { Graph } from '../models/graph.model';
import { AuthService } from './auth.service';
import firebase from 'firebase/compat/app';

const MAX_CACHED = 20;

interface StoredGraph extends Omit<Graph, 'createdAt'> {
  createdAt: string;
  editedAt?: string;
}

function toStored(g: Graph): StoredGraph {
  return { ...g, createdAt: g.createdAt.toISOString() };
}

function fromStored(s: StoredGraph): Graph {
  return { ...s, createdAt: new Date(s.createdAt) };
}

@Injectable({ providedIn: 'root' })
export class GraphService {
  private graphs$ = new BehaviorSubject<Graph[]>(this.loadLocal(null));
  private firestoreSub?: Subscription;
  private uid: string | null = null;

  constructor(
    private firestore: AngularFirestore,
    private authService: AuthService,
  ) {
    this.authService.user$.subscribe(user => this.onAuthChange(user ?? null));
  }

  getAll(): Observable<Graph[]> { return this.graphs$.asObservable(); }
  getSaved(): Observable<Graph[]> { return this.graphs$.pipe(map(gs => gs.filter(g => g.saved))); }
  getDrafts(): Observable<Graph[]> { return this.graphs$.pipe(map(gs => gs.filter(g => !g.saved))); }
  getById(id: string): Graph | undefined { return this.graphs$.value.find(g => g.id === id); }

  getRecent(limit = 6): Observable<Graph[]> {
    return this.graphs$.pipe(
      map(gs => [...gs].sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ).slice(0, limit))
    );
  }

  /** Called by graph-detail after backend generates and returns a graph. */
  add(graph: Graph): void {
    const updated = [graph, ...this.graphs$.value.filter(g => g.id !== graph.id)];
    this.graphs$.next(updated);
    this.persistLocal(this.uid, updated);
  }

  toggleSave(id: string): void { this.update(id, g => ({ ...g, saved: !g.saved })); }
  toggleShare(id: string): void { this.update(id, g => ({ ...g, shared: !g.shared })); }
  setChartType(id: string, type: Graph['type'], config: Graph['config']): void {
    this.update(id, g => ({ ...g, type, config }));
  }

  delete(id: string): void {
    const updated = this.graphs$.value.filter(g => g.id !== id);
    this.graphs$.next(updated);
    this.persistLocal(this.uid, updated);

    if (this.uid) {
      this.firestore.doc(`graphs/${id}`).update({ deleted: true }).catch(() => {});
    }
  }

  private update(id: string, fn: (g: Graph) => Graph): void {
    const g = this.graphs$.value.find(g => g.id === id);
    if (!g) return;
    const updated = fn(g);
    const list = this.graphs$.value.map(x => x.id === id ? updated : x);
    this.graphs$.next(list);
    this.persistLocal(this.uid, list);

    if (this.uid) {
      this.firestore.doc(`graphs/${id}`).update({
        saved: updated.saved,
        shared: updated.shared,
        editedAt: new Date().toISOString(),
      }).catch(() => {});
    }
  }

  private async onAuthChange(user: firebase.User | null): Promise<void> {
    this.firestoreSub?.unsubscribe();
    this.firestoreSub = undefined;
    this.uid = user?.uid ?? null;

    if (!user) {
      this.graphs$.next(this.loadLocal(null));
      return;
    }

    // 1. Seed UI immediately from cache
    const cached = this.loadLocal(user.uid);
    this.graphs$.next(cached);

    // 2. Determine the last fetched date
    const lastDate = this.loadLastDate(user.uid);

    // 3. Fetch only graphs newer than lastDate from Firestore
    await this.fetchFromFirestore(user.uid, lastDate, cached);
  }

  private async fetchFromFirestore(uid: string, lastDate: string | null, cached: Graph[]): Promise<void> {
    try {
      let query = this.firestore.collection<StoredGraph>('graphs', ref => {
        let q = ref.where('uid', '==', uid).orderBy('editedAt', 'desc');
        if (lastDate) q = q.where('editedAt', '>', lastDate);
        return q.limit(MAX_CACHED);
      });

      this.firestoreSub = query.valueChanges().subscribe(docs => {
        const fresh = docs.map(fromStored);
        // Merge: fresh first, then cached (deduplicated), cap at MAX_CACHED
        const merged = [...fresh];
        for (const c of cached) {
          if (!merged.find(g => g.id === c.id)) merged.push(c);
        }
        const final = merged.slice(0, MAX_CACHED);
        this.graphs$.next(final);
        this.persistLocal(uid, final);

        if (fresh.length > 0) {
          const newest = fresh.reduce((a, b) =>
            new Date(a.createdAt) > new Date(b.createdAt) ? a : b
          );
          this.saveLastDate(uid, newest.createdAt.toISOString());
        }
      });
    } catch (e) {
      console.warn('Firestore fetch failed, using cache', e);
    }
  }

  // ── LocalStorage helpers ──────────────────────────────────────────────────

  private cacheKey(uid: string | null) {
    return uid ? `ws_graphs_${uid}` : 'ws_graphs_anon';
  }

  private lastDateKey(uid: string) {
    return `ws_last_date_${uid}`;
  }

  private loadLocal(uid: string | null): Graph[] {
    try {
      const raw = localStorage.getItem(this.cacheKey(uid));
      if (raw) {
        return (JSON.parse(raw) as StoredGraph[]).map(fromStored);
      }
    } catch { /* ignore */ }
    return uid ? [] : this.seedData();
  }

  private persistLocal(uid: string | null, graphs: Graph[]): void {
    try {
      const capped = graphs.slice(0, MAX_CACHED);
      localStorage.setItem(this.cacheKey(uid), JSON.stringify(capped.map(toStored)));
    } catch { /* storage full */ }
  }

  private loadLastDate(uid: string): string | null {
    return localStorage.getItem(this.lastDateKey(uid));
  }

  private saveLastDate(uid: string, date: string): void {
    localStorage.setItem(this.lastDateKey(uid), date);
  }

  // ── Seed data for anonymous users ─────────────────────────────────────────

  private seedData(): Graph[] {
    return [
      {
        id: 'seed-1',
        title: 'Nicolas Cage movies vs pool drownings',
        prompt: 'Nicolas Cage movies vs swimming pool drownings per year',
        type: 'line',
        config: {
          type: 'line',
          data: {
            labels: ['2000','2001','2002','2003','2004','2005','2006','2007','2008'],
            datasets: [
              {
                label: 'Cage films',
                data: [2,2,2,3,1,1,2,3,4],
                borderColor: '#534AB7',
                backgroundColor: '#534AB722',
                borderWidth: 2.5,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: '#534AB7',
              },
              {
                label: 'Pool drownings (hundreds)',
                data: [1.09,1.02,1.23,1.05,0.87,1.12,1.34,1.52,1.62],
                borderColor: '#D85A30',
                backgroundColor: '#D85A3022',
                borderWidth: 2.5,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: '#D85A30',
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } },
            scales: {
              x: { grid: { display: false }, ticks: { font: { size: 11 } } },
              y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 11 } } },
            },
          },
        },
        insight: 'The correlation coefficient is a suspicious 0.666. Coincidence? Probably. Still weird.',
        tags: ['weird', 'correlation', 'spurious'],
        createdAt: new Date(Date.now() - 86400000 * 2),
        saved: true,
        shared: false,
        weirdScore: 10,
      },
    ];
  }
}
