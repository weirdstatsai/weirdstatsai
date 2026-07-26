import { Component, Input, OnInit } from '@angular/core';
import { ModalController, ModalOptions, ToastController } from '@ionic/angular';
import { MembershipService } from '../../services/membership.service';
import { BillingService, BillingPlan } from '../../services/billing.service';

type PlanId = 'free' | BillingPlan;

export type PlanModalMode = 'onboard' | 'limit' | 'upgrade';

/**
 * Modal options for the plan sheet — the single place that decides how it is
 * presented. A bottom sheet reads right on a phone, but on desktop Ionic
 * positions a sheet by transform against the full viewport height, which left it
 * stranded as a tall phone-width column overflowing the bottom of the screen.
 * At >=768px it becomes a plain modal instead, which `.ws-plan-modal` in
 * global.scss then centres as an auto-height card.
 */
export function planModalOptions(mode: PlanModalMode): ModalOptions {
  const phone = typeof window === 'undefined' || window.innerWidth < 768;
  return {
    component: PlanModalComponent,
    componentProps: { mode },
    cssClass: 'ws-plan-modal',
    ...(phone ? { breakpoints: [0, 1], initialBreakpoint: 1, handle: false } : {}),
  };
}

interface PlanOption {
  id: PlanId;
  name: string;
  price: string;
  period: string;
  desc: string;
  badge?: string;
}

@Component({
  selector: 'app-plan-modal',
  templateUrl: './plan-modal.component.html',
  styleUrls: ['./plan-modal.component.scss'],
})
export class PlanModalComponent implements OnInit {
  // 'limit'   — blocking: the daily cap was hit, shown with a reset countdown.
  // 'upgrade' — non-blocking: user tapped "Go Premium" with cards still left.
  @Input() mode: 'onboard' | 'limit' | 'upgrade' = 'onboard';

  // Paid options (ids match the backend PLANS keys). Prices are display copy —
  // the real charge is set by the Stripe Price the backend references.
  readonly paidPlans: PlanOption[] = [
    { id: 'monthly_auto', name: 'Monthly',       price: '$9.99',  period: '/ month',
      desc: 'Auto-renews monthly. Cancel anytime.', badge: 'Popular' },
    { id: 'monthly_once', name: 'Monthly pass',  price: '$9.99',  period: 'one-time',
      desc: 'One 30-day pass. No auto-renew.' },
    { id: 'yearly_auto',  name: 'Yearly',        price: '$100',   period: '/ year',
      desc: 'Auto-renews yearly — 2 months free.', badge: 'Best value' },
  ];

  selected: PlanId = 'monthly_auto';
  loading = false;
  resetIn = 'soon';

  constructor(
    private modalCtrl: ModalController,
    private membership: MembershipService,
    private billing: BillingService,
    private toastCtrl: ToastController,
  ) {}

  async ngOnInit(): Promise<void> {
    // In limit/upgrade the user already has free; default to the popular paid
    // plan so "Continue" reads as an upgrade, not a no-op.
    this.selected = this.mode === 'onboard' ? 'free' : 'monthly_auto';
    if (this.mode === 'limit') {
      const { resetAt } = await this.membership.getUsage();
      this.resetIn = resetAt ? this.formatCountdown(resetAt) : 'soon';
    }
  }

  private formatCountdown(target: Date): string {
    const ms = target.getTime() - Date.now();
    if (ms <= 0) return 'a few minutes';
    const totalMin = Math.ceil(ms / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h <= 0) return `${m}m`;
    return `${h}h ${m}m`;
  }

  select(id: PlanId): void {
    this.selected = id;
  }

  get continueLabel(): string {
    if (this.selected === 'free') return 'Continue';
    const p = this.paidPlans.find(x => x.id === this.selected);
    return `Continue — ${p?.price}${p?.period === 'one-time' ? '' : p?.period}`;
  }

  async confirm(): Promise<void> {
    this.loading = true;
    try {
      if (this.selected === 'free') {
        // First-time plan choice only — in limit/upgrade the user already has a
        // free plan, and re-initializing would reset their usage window.
        if (this.mode === 'onboard') await this.membership.initPlan('free');
        await this.modalCtrl.dismiss({ plan: 'free' });
        return;
      }
      // Paid: hand off to Stripe Checkout. This redirects the whole page away,
      // so we don't dismiss — the user returns via /billing/success.
      await this.billing.startCheckout(this.selected);
      // (If startCheckout resolves without navigating, the URL was missing.)
    } catch (e: any) {
      this.loading = false;
      const msg = e?.message === 'not-signed-in'
        ? 'Please sign in first to upgrade.'
        : 'Could not start checkout. Please try again.';
      const t = await this.toastCtrl.create({ message: msg, duration: 2200, color: 'danger' });
      await t.present();
    }
  }

  continueFree(): void {
    this.membership.initPlan('free');
    this.modalCtrl.dismiss({ plan: 'free' });
  }

  dismiss(): void {
    this.modalCtrl.dismiss(null);
  }
}
