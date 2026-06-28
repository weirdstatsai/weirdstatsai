import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private _isAdmin: boolean | null = null;

  constructor(
    private afs: AngularFirestore,
    private afAuth: AngularFireAuth,
  ) {}

  async isAdmin(): Promise<boolean> {
    if (this._isAdmin !== null) return this._isAdmin;
    const user = await firstValueFrom(this.afAuth.authState);
    if (!user) return false;
    const snap = await firstValueFrom(this.afs.doc(`users/${user.uid}`).get());
    this._isAdmin = !!(snap.data() as any)?.isAdmin;
    return this._isAdmin;
  }

  resetCache(): void { this._isAdmin = null; }

  async getAllUsers(): Promise<any[]> {
    // Derive unique users from stats collection (publicly readable)
    const snap = await firstValueFrom(this.afs.collection('stats').get());
    const userMap = new Map<string, any>();
    for (const doc of snap.docs) {
      const d = doc.data() as any;
      const uid = d.createdBy;
      if (!uid || uid === 'seed' || uid === 'Anonymous') continue;
      if (!userMap.has(uid)) {
        userMap.set(uid, {
          uid,
          displayName: d.createdByName || '',
          email: '',
          plan: 'free',
          banned: false,
          cardCount: 0,
        });
      }
      userMap.get(uid).cardCount++;
    }
    // Try to enrich with users/{uid} doc for each user (may fail for non-admin)
    const users = Array.from(userMap.values());
    await Promise.all(users.map(async u => {
      try {
        const userSnap = await firstValueFrom(this.afs.doc(`users/${u.uid}`).get());
        if (userSnap.exists) {
          const data = userSnap.data() as any;
          u.plan = data?.plan ?? 'free';
          u.banned = data?.banned ?? false;
          u.email = data?.email ?? '';
        }
      } catch { /* permission denied for non-self — skip */ }
    }));
    return users;
  }

  async getUserCards(uid: string): Promise<any[]> {
    const snap = await firstValueFrom(
      this.afs.collection('stats', ref => ref.where('createdBy', '==', uid)).get()
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() as any }));
  }

  async updateUser(uid: string, data: Partial<{ displayName: string; plan: string; banned: boolean }>): Promise<void> {
    await this.afs.doc(`users/${uid}`).update(data);
  }

  async deleteCard(cardId: string): Promise<void> {
    await this.afs.doc(`stats/${cardId}`).delete();
  }

  async featureCard(cardId: string, featured: boolean): Promise<void> {
    await this.afs.doc(`stats/${cardId}`).update({ isFeatured: featured });
  }

  async setAdminFlag(uid: string, value: boolean): Promise<void> {
    await this.afs.doc(`users/${uid}`).set({ isAdmin: value }, { merge: true });
  }
}
