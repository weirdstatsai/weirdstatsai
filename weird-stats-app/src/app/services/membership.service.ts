import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { firstValueFrom } from 'rxjs';

export type Plan = 'free' | 'premium';

export interface UserPlan {
  plan: Plan;
  planExpiry: string | null;       // ISO date — when premium expires
  windowStart: string;             // ISO date — start of 10-day window
  windowCount: number;             // cards generated in this window
  totalGenerated: number;          // lifetime total
  planChosenAt: string | null;     // ISO date — when they chose a plan
}

export const FREE_WINDOW_DAYS = 10;
export const FREE_WINDOW_LIMIT = 10;

const DEFAULT_PLAN: UserPlan = {
  plan: 'free',
  planExpiry: null,
  windowStart: new Date().toISOString(),
  windowCount: 0,
  totalGenerated: 0,
  planChosenAt: null,
};

@Injectable({ providedIn: 'root' })
export class MembershipService {
  constructor(
    private afs: AngularFirestore,
    private afAuth: AngularFireAuth,
  ) {}

  private async uid(): Promise<string | null> {
    const user = await firstValueFrom(this.afAuth.authState);
    return user?.uid ?? null;
  }

  async getUserPlan(): Promise<UserPlan | null> {
    const uid = await this.uid();
    if (!uid) return null;
    const snap = await firstValueFrom(
      this.afs.doc<UserPlan>(`users/${uid}`).get()
    );
    return snap.exists ? (snap.data() as UserPlan) : null;
  }

  async initPlan(plan: Plan): Promise<void> {
    const uid = await this.uid();
    if (!uid) return;
    const now = new Date().toISOString();
    const data: UserPlan = {
      ...DEFAULT_PLAN,
      plan,
      planChosenAt: now,
      windowStart: now,
    };
    await this.afs.doc(`users/${uid}`).set(data, { merge: true });
  }

  async setPremium(): Promise<void> {
    const uid = await this.uid();
    if (!uid) return;
    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + 1);
    await this.afs.doc(`users/${uid}`).update({
      plan: 'premium',
      planExpiry: expiry.toISOString(),
    });
  }

  // Returns remaining cards in current window, or Infinity for premium
  async getRemainingCards(): Promise<number> {
    const userPlan = await this.getUserPlan();
    if (!userPlan) return FREE_WINDOW_LIMIT;
    if (userPlan.plan === 'premium') {
      const expiry = userPlan.planExpiry ? new Date(userPlan.planExpiry) : null;
      if (!expiry || expiry > new Date()) return Infinity;
    }
    const windowStart = new Date(userPlan.windowStart);
    const now = new Date();
    const diffDays = (now.getTime() - windowStart.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays >= FREE_WINDOW_DAYS) return FREE_WINDOW_LIMIT; // window reset
    return Math.max(0, FREE_WINDOW_LIMIT - userPlan.windowCount);
  }

  async canGenerate(): Promise<boolean> {
    const remaining = await this.getRemainingCards();
    return remaining > 0;
  }

  // Call after a successful generation
  async recordGeneration(): Promise<void> {
    const uid = await this.uid();
    if (!uid) return;
    const userPlan = await this.getUserPlan();
    if (!userPlan) return;
    if (userPlan.plan === 'premium') {
      await this.afs.doc(`users/${uid}`).update({
        totalGenerated: (userPlan.totalGenerated ?? 0) + 1,
      });
      return;
    }
    const windowStart = new Date(userPlan.windowStart);
    const now = new Date();
    const diffDays = (now.getTime() - windowStart.getTime()) / (1000 * 60 * 60 * 24);
    const isNewWindow = diffDays >= FREE_WINDOW_DAYS;
    await this.afs.doc(`users/${uid}`).update({
      windowCount: isNewWindow ? 1 : (userPlan.windowCount ?? 0) + 1,
      windowStart: isNewWindow ? now.toISOString() : userPlan.windowStart,
      totalGenerated: (userPlan.totalGenerated ?? 0) + 1,
    });
  }

  async hasChosenPlan(): Promise<boolean> {
    const userPlan = await this.getUserPlan();
    return !!userPlan?.planChosenAt;
  }

  async isPremium(): Promise<boolean> {
    const userPlan = await this.getUserPlan();
    if (!userPlan || userPlan.plan !== 'premium') return false;
    const expiry = userPlan.planExpiry ? new Date(userPlan.planExpiry) : null;
    return !expiry || expiry > new Date();
  }
}
