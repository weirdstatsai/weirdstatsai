import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

/** The three purchase options — must match the backend `PLANS` keys. */
export type BillingPlan = 'monthly_auto' | 'monthly_once' | 'yearly_auto' | 'yearly_once';

/**
 * Client half of the Stripe flow: it only ever asks the backend for a hosted
 * Checkout / customer-portal URL and redirects there. Premium is granted
 * server-side by the Stripe webhook — never here — so a user can't self-upgrade.
 */
@Injectable({ providedIn: 'root' })
export class BillingService {
  constructor(private afAuth: AngularFireAuth) {}

  private async authHeader(): Promise<Record<string, string>> {
    const user = await this.afAuth.currentUser;
    if (!user) throw new Error('not-signed-in');
    const token = await user.getIdToken();
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  }

  /** Start Stripe Checkout for a plan and redirect the browser to it. */
  async startCheckout(plan: BillingPlan): Promise<void> {
    const headers = await this.authHeader();
    const res = await fetch(`${environment.apiUrl}/api/billing/checkout`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ plan, origin: window.location.origin }),
    });
    if (!res.ok) throw new Error(`checkout-failed-${res.status}`);
    const { url } = await res.json();
    if (!url) throw new Error('no-checkout-url');
    window.location.assign(url);
  }

  /** Open the Stripe customer portal to manage / cancel a subscription. */
  async openPortal(): Promise<void> {
    const headers = await this.authHeader();
    const res = await fetch(`${environment.apiUrl}/api/billing/portal`, {
      method: 'POST',
      headers,
    });
    if (!res.ok) throw new Error(`portal-failed-${res.status}`);
    const { url } = await res.json();
    if (!url) throw new Error('no-portal-url');
    window.location.assign(url);
  }
}
