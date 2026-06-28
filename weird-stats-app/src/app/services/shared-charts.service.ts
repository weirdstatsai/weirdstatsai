import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Graph } from '../models/graph.model';

export interface SharedChart {
  shareId: string;
  graphId: string;
  uid: string;
  title: string;
  type: string;
  insight: string;
  tags: string[];
  weirdScore: number;
  createdAt: string;
  viewCount: number;
}

@Injectable({ providedIn: 'root' })
export class SharedChartsService {
  constructor(private firestore: AngularFirestore) {}

  async createShare(uid: string, graph: Graph): Promise<string> {
    const shareId = this.firestore.createId();
    const data: SharedChart = {
      shareId,
      graphId: graph.id,
      uid,
      title: graph.title,
      type: graph.type,
      insight: graph.insight,
      tags: graph.tags,
      weirdScore: graph.weirdScore,
      createdAt: new Date().toISOString(),
      viewCount: 0,
    };
    await this.firestore.doc(`shared/${shareId}`).set(data);
    return shareId;
  }

  async getShare(shareId: string): Promise<SharedChart | undefined> {
    const snap = await this.firestore.doc<SharedChart>(`shared/${shareId}`).get().toPromise();
    return snap?.data();
  }

  async incrementViewCount(shareId: string): Promise<void> {
    const ref = this.firestore.doc<SharedChart>(`shared/${shareId}`);
    const snap = await ref.get().toPromise();
    const current = (snap?.data() as SharedChart)?.viewCount ?? 0;
    await ref.update({ viewCount: current + 1 });
  }
}
