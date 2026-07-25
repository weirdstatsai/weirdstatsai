import { Component, OnInit } from '@angular/core';
import { NavController, ToastController } from '@ionic/angular';
import { BillingService, BillingPlan } from '../services/billing.service';
import { MembershipService } from '../services/membership.service';

interface PaidPlan {
  base: 'monthly' | 'yearly';
  name: string;
  price: string;
  period: string;
  badge?: string;
  featured?: boolean;
}

@Component({
  selector: 'app-pricing',
  templateUrl: './pricing.page.html',
  styleUrls: ['./pricing.page.scss'],
})
export class PricingPage implements OnInit {
  isPremium = false;
  loading: BillingPlan | null = null;
  selected: 'free' | 'monthly' | 'yearly' = 'monthly';
  /** Per-card auto-renew choice, made HERE on the page (Stripe fixes the
   *  checkout mode per session, so it can't be toggled inside Stripe's own
   *  page). ON → a recurring subscription; OFF → a one-time pass. Each card
   *  owns its own switch so the choice sits next to the price it controls. */
  //  Monthly can auto-renew (toggle); the Yearly plan is a one-time annual
  //  pass only — no auto-renew — so it stays false and shows no toggle.
  autoRenew: Record<'monthly' | 'yearly', boolean> = { monthly: true, yearly: false };

  readonly paid: PaidPlan[] = [
    { base: 'monthly', name: 'Monthly', price: '$9.99', period: '/mo', badge: 'Popular', featured: true },
    { base: 'yearly',  name: 'Yearly',  price: '$100',  period: '/yr', badge: 'Best value' },
  ];

  /** Resolve a card + its toggle into the actual Stripe plan key. */
  planId(base: 'monthly' | 'yearly'): BillingPlan {
    return `${base}_${this.autoRenew[base] ? 'auto' : 'once'}` as BillingPlan;
  }

  /** Sub-line under the price, reflecting that card's renew choice. */
  noteFor(base: 'monthly' | 'yearly'): string {
    if (this.autoRenew[base]) {
      return base === 'monthly'
        ? 'Auto-renews monthly. Cancel anytime.'
        : 'Auto-renews yearly — 2 months free.';
    }
    return base === 'monthly'
      ? 'One-time — 30 days of Premium, no auto-renew.'
      : 'One-time — a full year of Premium, no auto-renew.';
  }

  readonly compare: Array<{ label: string; free: string; premium: string }> = [
    { label: 'Stat cards per day', free: '3', premium: 'Unlimited' },
    { label: 'Every card style & editing', free: '✓', premium: '✓' },
    { label: 'Save & publish to profile', free: '✓', premium: '✓' },
    { label: 'Watermark-free sharing', free: '—', premium: '✓' },
    { label: 'Private cards', free: '—', premium: '✓' },
  ];

  constructor(
    private billing: BillingService,
    private membership: MembershipService,
    private nav: NavController,
    private toastCtrl: ToastController,
  ) {}

  async ngOnInit(): Promise<void> {
    this.isPremium = await this.membership.isPremium();
  }

  async choose(id: BillingPlan): Promise<void> {
    this.loading = id;
    try {
      await this.billing.startCheckout(id);
    } catch (e: any) {
      this.loading = null;
      // Backend blocks a second subscription (409) — send them to the portal to
      // manage the one they already have instead of double-charging.
      if (e?.message === 'checkout-failed-409') {
        this.isPremium = true;
        await this.toast('You already have an active subscription — opening your billing portal.', 'medium');
        return this.manage();
      }
      const msg = e?.message === 'not-signed-in'
        ? 'Please sign in first to upgrade.'
        : 'Could not start checkout. Please try again.';
      await this.toast(msg, 'danger');
    }
  }

  /** Open the Stripe customer portal to manage / cancel an existing plan. */
  async manage(): Promise<void> {
    try {
      await this.billing.openPortal();
    } catch (e: any) {
      const msg = e?.message === 'not-signed-in'
        ? 'Please sign in first.'
        : 'Could not open the billing portal. Please try again.';
      await this.toast(msg, 'danger');
    }
  }

  private async toast(message: string, color: string): Promise<void> {
    const t = await this.toastCtrl.create({ message, duration: 2400, color });
    await t.present();
  }

  back(): void {
    this.nav.back();
  }
}
