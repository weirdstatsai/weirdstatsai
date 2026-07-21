import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private _isAdmin: boolean | null = null;
  private _checkedUid: string | null = null;

  constructor(
    private afs: AngularFirestore,
    private afAuth: AngularFireAuth,
  ) {}

  // Pass the uid when the caller already has a reliably-resolved user (e.g. from
  // a live auth subscription) — this avoids racing afAuth.authState here, which
  // can still be mid-restore on a cold app load and would otherwise report
  // "not admin" before the persisted session finishes attaching.
  async isAdmin(uid?: string): Promise<boolean> {
    let targetUid = uid;
    if (!targetUid) {
      const user = await firstValueFrom(this.afAuth.authState);
      targetUid = user?.uid;
    }
    if (!targetUid) return false; // no user yet — NOT cached, so the next real check can still run
    if (this._isAdmin !== null && this._checkedUid === targetUid) return this._isAdmin;
    const snap = await firstValueFrom(this.afs.doc(`users/${targetUid}`).get());
    this._isAdmin = !!(snap.data() as any)?.isAdmin;
    this._checkedUid = targetUid;
    return this._isAdmin;
  }

  resetCache(): void { this._isAdmin = null; this._checkedUid = null; }

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

  /**
   * Every card across every user, newest first — for the admin "All cards" screen
   * where an admin curates what goes to Explore. Firestore rules already allow an
   * admin to read the whole `stats` collection. Cursor-paginated via `startAfter`
   * (pass back the `last` snapshot to fetch the next page). Ordered by createdAt
   * (present on every card; updatedAt can be missing on un-claimed cache docs).
   */
  async getAllCards(limitN = 60, startAfter?: unknown): Promise<{ cards: any[]; last: unknown }> {
    const snap = await firstValueFrom(
      this.afs.collection('stats', ref => {
        let q = ref.orderBy('createdAt', 'desc').limit(limitN);
        if (startAfter) q = q.startAfter(startAfter);
        return q;
      }).get()
    );
    return {
      cards: snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })),
      last: snap.docs.length ? snap.docs[snap.docs.length - 1] : null,
    };
  }

  /**
   * Admin: toggle a card onto/off the Explore or Home feed. Enabling also
   * publishes the card so it's publicly readable, and stamps homeAddedAt for
   * Home ordering. Mirrors card-detail's _setFeedFlag; Firestore rules restrict
   * enabling a feed flag to admins.
   */
  async setFeedFlag(cardId: string, field: 'showOnExplore' | 'showOnHome', value: boolean): Promise<void> {
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { [field]: value, updatedAt: now };
    if (value) patch['publishStatus'] = 'published';
    if (field === 'showOnHome' && value) patch['homeAddedAt'] = now;
    await this.afs.doc(`stats/${cardId}`).update(patch);
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
