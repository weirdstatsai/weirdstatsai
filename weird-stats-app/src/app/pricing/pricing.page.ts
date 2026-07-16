import { Component, OnInit } from '@angular/core';
import { NavController, ToastController } from '@ionic/angular';
import { BillingService, BillingPlan } from '../services/billing.service';
import { MembershipService } from '../services/membership.service';

interface PaidPlan {
  id: BillingPlan;
  name: string;
  price: string;
  period: string;
  note: string;
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
  selected: 'free' | BillingPlan = 'monthly_auto';

  readonly paid: PaidPlan[] = [
    { id: 'monthly_auto', name: 'Monthly', price: '$9.99', period: '/mo',
      note: 'Auto-renews monthly. Cancel anytime.', badge: 'Popular', featured: true },
    { id: 'yearly_auto', name: 'Yearly', price: '$100', period: '/yr',
      note: 'Auto-renews yearly — 2 months free.', badge: 'Best value' },
    { id: 'monthly_once', name: '30-day pass', price: '$9.99', period: 'once',
      note: 'One 30-day pass. No auto-renew.' },
  ];

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
      const msg = e?.message === 'not-signed-in'
        ? 'Please sign in first to upgrade.'
        : 'Could not start checkout. Please try again.';
      const t = await this.toastCtrl.create({ message: msg, duration: 2200, color: 'danger' });
      await t.present();
    }
  }

  back(): void {
    this.nav.back();
  }
}
