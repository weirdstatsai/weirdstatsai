import { Component, Input } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { MembershipService } from '../../services/membership.service';
import { BillingService } from '../../services/billing.service';

@Component({
  selector: 'app-plan-modal',
  templateUrl: './plan-modal.component.html',
  styleUrls: ['./plan-modal.component.scss'],
})
export class PlanModalComponent {
  @Input() mode: 'onboard' | 'limit' = 'onboard';

  selected: 'free' | 'premium' = 'free';
  loading = false;
  error: string | null = null;

  constructor(
    private modalCtrl: ModalController,
    private membership: MembershipService,
    private billing: BillingService,
  ) {}

  select(plan: 'free' | 'premium'): void {
    this.selected = plan;
  }

  async confirm(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      if (this.selected === 'premium') {
        // Hand off to Stripe Checkout. Premium is granted server-side by the
        // Stripe webhook once payment completes — never from the client.
        // The browser redirects to Stripe here; on success it returns to the
        // app with ?checkout=success (handled in AppComponent).
        await this.billing.startCheckout();
        return;
      }
      await this.membership.initPlan('free');
      await this.modalCtrl.dismiss({ plan: this.selected });
    } catch (err) {
      this.error = (err as Error)?.message || 'Could not start checkout. Please try again.';
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
