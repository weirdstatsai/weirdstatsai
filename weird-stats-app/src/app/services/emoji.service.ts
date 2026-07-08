import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Observable, distinctUntilChanged, map, startWith } from 'rxjs';

/**
 * Profile avatar emoji, synced to the account.
 *
 * Firestore `users/{uid}.emoji` is the source of truth so the avatar follows
 * the user across devices and sign-ins. localStorage keeps the legacy
 * per-device copy as an instant-paint cache; a device that still has only the
 * legacy copy migrates it up to Firestore on first read.
 */
@Injectable({ providedIn: 'root' })
export class EmojiService {
  constructor(private afs: AngularFirestore) {}

  private key(uid: string): string {
    return 'weird_stats_emoji_' + uid;
  }

  /** Live avatar emoji for a user ('' when none picked yet). */
  emoji$(uid: string): Observable<string> {
    const cached = localStorage.getItem(this.key(uid)) ?? '';
    let migrated = false;
    return this.afs
      .doc<{ emoji?: string }>(`users/${uid}`)
      .valueChanges()
      .pipe(
        map(doc => doc?.emoji ?? ''),
        map(remote => {
          if (remote) {
            localStorage.setItem(this.key(uid), remote);
            return remote;
          }
          // Account has no emoji yet but this device does — migrate it up once.
          if (cached && !migrated) {
            migrated = true;
            this.set(uid, cached).catch(() => {});
          }
          return cached;
        }),
        startWith(cached),
        distinctUntilChanged(),
      );
  }

  /** Persist a newly picked emoji to the account (and the local cache). */
  async set(uid: string, emoji: string): Promise<void> {
    localStorage.setItem(this.key(uid), emoji);
    await this.afs.doc(`users/${uid}`).set({ emoji }, { merge: true });
  }
}
