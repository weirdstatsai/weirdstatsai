import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { firstValueFrom } from 'rxjs';
import { StoredStatCard } from '../models/weird-card.model';

/**
 * Drafts live in Firestore (the `stats` collection), keyed by the same id the
 * backend already assigned at generation time. A draft is simply a card owned
 * by the user with `publishStatus: 'draft'` — so it syncs across every device
 * the user signs in on, and publish/unpublish are just a status flip on the
 * same document (no copy, no separate store, nothing to orphan).
 *
 * The profile page reads the user's cards reactively via its own
 * `stats where createdBy == uid` query and splits them into Drafts vs Saved by
 * `publishStatus`; this service owns the writes.
 */
@Injectable({ providedIn: 'root' })
export class DraftService {
  /** localStorage key a guest's just-generated card is held under until they sign in. */
  static readonly PENDING_KEY = 'weirdstats_pending_card';

  constructor(private afs: AngularFirestore, private storage: AngularFireStorage) {}

  /**
   * Claim a guest's held card into their cloud drafts on sign-in. Wired into a
   * GLOBAL auth hook (AppComponent) so it fires on ANY sign-in, not only when a
   * card-detail page happens to be open. Idempotent + safe: no-ops when there's
   * nothing pending, validates the shape, and clears the hold once claimed.
   * Returns true if a card was claimed.
   */
  async claimPending(uid: string): Promise<boolean> {
    if (!uid) return false;
    let pending: StoredStatCard | undefined;
    try {
      const raw = localStorage.getItem(DraftService.PENDING_KEY);
      pending = raw ? (JSON.parse(raw) as StoredStatCard) : undefined;
    } catch { pending = undefined; }
    if (!pending?.id || !pending?.data) return false;
    await this.add(uid, { ...pending, createdBy: uid, publishStatus: 'draft' });
    try { localStorage.removeItem(DraftService.PENDING_KEY); } catch { /* ignore */ }
    return true;
  }

  /**
   * Take ownership of a generated card as this user's draft, and persist any
   * in-app edits to it. The backend already created `stats/{id}` (as an
   * anonymous cache doc), so we UPDATE ownership + content in place — that
   * preserves backend-only fields (prompt, promptHash, createdAt). If the doc
   * somehow doesn't exist yet, we create it.
   */
  async add(uid: string, card: StoredStatCard): Promise<void> {
    if (!uid || !card?.id) return;
    const ref = this.afs.doc(`stats/${card.id}`);
    const patch: Record<string, unknown> = {
      createdBy: uid,
      createdByName: card.createdByName ?? '',
      createdByEmoji: card.createdByEmoji ?? '',
      publishStatus: card.publishStatus ?? 'draft',
      data: card.data,
      updatedAt: new Date().toISOString(),
    };
    try {
      await ref.update(patch);
    } catch {
      // Doc not there yet (rare — backend save failed) → create it fresh.
      await ref.set({
        ...card,
        createdBy: uid,
        publishStatus: card.publishStatus ?? 'draft',
        createdAt: card.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  /** Delete a draft/card document. OG-image cleanup is handled by the caller. */
  async remove(_uid: string, cardId: string): Promise<void> {
    if (!cardId) return;
    // Read the doc BEFORE deleting: the uploaded photo's Storage path lives on
    // it, and without it we can't clean the object up. Deleting only the
    // Firestore doc left `card-media/{uid}/{cardId}` and `og/{cardId}.png`
    // behind — still publicly downloadable by URL — even though the delete
    // confirmation promises the card is removed. Card-detail's own delete
    // already did this; Profile and the admin screens go through here.
    let heroPath = '';
    try {
      const snap = await firstValueFrom(this.afs.doc<StoredStatCard>(`stats/${cardId}`).get());
      heroPath = snap?.data()?.data?.uiMeta?.heroImagePath || '';
    } catch { /* unreadable — still delete the doc below */ }

    await this.afs.doc(`stats/${cardId}`).delete();

    // Best-effort cleanup; a missing object is not an error worth surfacing.
    const bucket = this.storage;
    if (heroPath) {
      try { await firstValueFrom(bucket.ref(heroPath).delete()); } catch { /* already gone */ }
    }
    try { await firstValueFrom(bucket.ref(`og/${cardId}.png`).delete()); } catch { /* never had one */ }
  }

  /** Fetch one of the user's own cards by id (any status). */
  async get(uid: string, cardId: string): Promise<StoredStatCard | undefined> {
    if (!cardId) return undefined;
    const snap = await firstValueFrom(this.afs.doc<StoredStatCard>(`stats/${cardId}`).get());
    const d = snap.data() as StoredStatCard | undefined;
    return d && d.createdBy === uid ? { ...d, id: cardId } : undefined;
  }
}
