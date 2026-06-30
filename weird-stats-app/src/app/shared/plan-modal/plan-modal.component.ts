import { Component, Input, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { MembershipService } from '../../services/membership.service';

@Component({
  selector: 'app-plan-modal',
  templateUrl: './plan-modal.component.html',
  styleUrls: ['./plan-modal.component.scss'],
})
export class PlanModalComponent implements OnInit {
  // 'limit'   — blocking: the daily cap was hit, shown with a reset countdown.
  // 'upgrade' — non-blocking: user tapped "Go Premium" with cards still left.
  @Input() mode: 'onboard' | 'limit' | 'upgrade' = 'onboard';

  // In 'limit'/'upgrade' mode the user already has a plan — default the
  // selector to Premium so "Continue" reads as an upgrade prompt, not a no-op.
  selected: 'free' | 'premium' = 'free';
  loading = false;
  resetIn = 'soon';

  constructor(
    private modalCtrl: ModalController,
    private membership: MembershipService,
  ) {}

  async ngOnInit(): Promise<void> {
    if (this.mode === 'limit' || this.mode === 'upgrade') {
      this.selected = 'premium';
    }
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

  select(plan: 'free' | 'premium'): void {
    this.selected = plan;
  }

  async confirm(): Promise<void> {
    this.loading = true;
    try {
      if (this.selected === 'premium') {
        // TODO: wire to RevenueCat / Stripe when payment is ready
        // For now, mark as premium directly (demo mode)
        await this.membership.setPremium();
      } else if (this.mode === 'onboard') {
        // First-time plan choice only — in 'limit'/'upgrade' mode the user
        // already has a free plan, and re-initializing it would reset their
        // usage window and let them bypass the daily cap.
        await this.membership.initPlan('free');
      }
      await this.modalCtrl.dismiss({ plan: this.selected });
    } finally {
      this.loading = false;
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
