import { Component, Input } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { MembershipService } from '../../services/membership.service';

@Component({
  selector: 'app-plan-modal',
  templateUrl: './plan-modal.component.html',
  styleUrls: ['./plan-modal.component.scss'],
})
export class PlanModalComponent {
  @Input() mode: 'onboard' | 'limit' = 'onboard';

  selected: 'free' | 'premium' = 'free';
  loading = false;

  constructor(
    private modalCtrl: ModalController,
    private membership: MembershipService,
  ) {}

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
      } else {
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
