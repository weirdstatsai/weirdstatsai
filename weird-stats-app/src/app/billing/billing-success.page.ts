import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MembershipService } from '../services/membership.service';

/**
 * Landing page Stripe redirects to after a successful checkout. Premium is
 * granted asynchronously by the webhook, so this polls the plan for a few
 * seconds before confirming — then sends the user back to their profile.
 */
@Component({
  selector: 'app-billing-success',
  templateUrl: './billing-success.page.html',
  styleUrls: ['./billing-success.page.scss'],
})
export class BillingSuccessPage implements OnInit {
  state: 'activating' | 'done' | 'pending' = 'activating';

  constructor(
    private membership: MembershipService,
    private router: Router,
  ) {}

  async ngOnInit(): Promise<void> {
    // Poll for the webhook to flip the plan (usually 1–3s). Give it ~12s.
    for (let i = 0; i < 8; i++) {
      if (await this.membership.isPremium()) {
        this.state = 'done';
        setTimeout(() => this.goProfile(), 1600);
        return;
      }
      await new Promise(r => setTimeout(r, 1500));
    }
    // Payment likely succeeded but the webhook hasn't landed yet — reassure,
    // don't error. It'll reflect shortly.
    this.state = 'pending';
  }

  goProfile(): void {
    this.router.navigate(['/profile']);
  }
}
