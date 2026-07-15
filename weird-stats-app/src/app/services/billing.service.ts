import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

/**
 * Talks to the backend Stripe endpoints. Premium is granted server-side via the
 * Stripe webhook — this service only kicks off Checkout and the billing portal.
 */
@Injectable({ providedIn: 'root' })
export class BillingService {
  constructor(private http: HttpClient, private afAuth: AngularFireAuth) {}

  private async authHeaders(): Promise<{ [header: string]: string }> {
    const user = await firstValueFrom(this.afAuth.authState);
    if (!user) throw new Error('Please sign in to upgrade.');
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}` };
  }

  /** Start a Stripe Checkout session and redirect the browser to Stripe. */
  async startCheckout(): Promise<void> {
    const headers = await this.authHeaders();
    const returnUrl = window.location.href.split('?')[0];
    const res = await firstValueFrom(
      this.http.post<{ url: string }>(
        `${environment.apiUrl}/api/billing/create-checkout-session`,
        { returnUrl },
        { headers },
      ),
    );
    if (!res?.url) throw new Error('Could not start checkout. Please try again.');
    window.location.href = res.url;
  }

  /** Open the Stripe customer portal (manage / cancel the subscription). */
  async openPortal(): Promise<void> {
    const headers = await this.authHeaders();
    const returnUrl = window.location.href.split('?')[0];
    const res = await firstValueFrom(
      this.http.post<{ url: string }>(
        `${environment.apiUrl}/api/billing/portal`,
        { returnUrl },
        { headers },
      ),
    );
    if (!res?.url) throw new Error('Could not open the billing portal.');
    window.location.href = res.url;
  }
}
