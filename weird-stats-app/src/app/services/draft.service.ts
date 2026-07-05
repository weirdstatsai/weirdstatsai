import { Injectable } from '@angular/core';
import { StoredStatCard } from '../models/weird-card.model';

/**
 * Drafts live on the device only (localStorage) — never in Firestore.
 * Keyed per user so each account keeps its own working set.
 * Only when a draft is "saved publicly/privately" does it become a
 * Firestore doc (handled by the profile page).
 */
@Injectable({ providedIn: 'root' })
export class DraftService {
  private key(uid: string): string {
    return `weirdstats_drafts_${uid || 'guest'}`;
  }

  list(uid: string): StoredStatCard[] {
    try {
      const raw = localStorage.getItem(this.key(uid));
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  add(uid: string, card: StoredStatCard): void {
    const drafts = this.list(uid);
    // de-dupe by id, newest first
    const filtered = drafts.filter(d => d.id !== card.id);
    filtered.unshift(card);
    this._write(uid, filtered.slice(0, 100));
  }

  remove(uid: string, cardId: string): void {
    const drafts = this.list(uid).filter(d => d.id !== cardId);
    this._write(uid, drafts);
  }

  /** Remove all local drafts for a user (used after one-time migration to Firestore). */
  clearAll(uid: string): void {
    try { localStorage.removeItem(this.key(uid)); } catch { /* ignore */ }
  }

  get(uid: string, cardId: string): StoredStatCard | undefined {
    return this.list(uid).find(d => d.id === cardId);
  }

  count(uid: string): number {
    return this.list(uid).length;
  }

  private _write(uid: string, drafts: StoredStatCard[]): void {
    try {
      localStorage.setItem(this.key(uid), JSON.stringify(drafts));
    } catch { /* quota — ignore */ }
  }
}
