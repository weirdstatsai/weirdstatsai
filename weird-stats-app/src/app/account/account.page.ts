import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import firebase from 'firebase/compat/app';
import { AuthService } from '../services/auth.service';
import { AdminService } from '../services/admin.service';
import { MembershipService } from '../services/membership.service';
import { BillingService } from '../services/billing.service';

@Component({
  selector: 'app-account',
  templateUrl: './account.page.html',
  styleUrls: ['./account.page.scss'],
})
export class AccountPage implements OnInit {
  user: firebase.User | null = null;
  isAdmin = false;
  isPremium = false;
  planLabel = '';
  hasSubscription = false;

  constructor(
    private router: Router,
    private authService: AuthService,
    private adminService: AdminService,
    private membership: MembershipService,
    private billing: BillingService,
    private toastCtrl: ToastController,
  ) {}

  async ngOnInit(): Promise<void> {
    this.user = this.authService.getCurrentUser();
    if (!this.user) { this.router.navigate(['/profile']); return; }
    this.isAdmin = await this.adminService.isAdmin(this.user.uid);
    await this.loadPlan();
  }

  private async loadPlan(): Promise<void> {
    this.isPremium = await this.membership.isPremium();
    const plan = await this.membership.getUserPlan();
    this.hasSubscription = this.isPremium && !!plan?.subscriptionId;
    const labels: Record<string, string> = {
      monthly_auto: 'Premium · Monthly', monthly_once: 'Premium · 30-day pass',
      yearly_auto: 'Premium · Yearly',
    };
    this.planLabel = this.isPremium ? (labels[plan?.planType ?? ''] ?? 'Premium') : 'Free';
  }

  /** Open Stripe's customer portal to manage or cancel the subscription. */
  async manageBilling(): Promise<void> {
    try {
      await this.billing.openPortal();
    } catch {
      const t = await this.toastCtrl.create({ message: 'Could not open billing.', duration: 1800, color: 'danger' });
      await t.present();
    }
  }

  get signInMethod(): string {
    const provider = this.user?.providerData?.[0]?.providerId ?? '';
    if (provider.includes('google')) return 'Signed in with Google';
    if (provider.includes('facebook')) return 'Signed in with Facebook';
    if (provider.includes('phone')) return 'Signed in with Phone';
    if (provider.includes('password')) return 'Signed in with Email';
    return '';
  }

  back(): void {
    this.router.navigate(['/profile']);
  }

  async showComingSoon(): Promise<void> {
    const t = await this.toastCtrl.create({ message: 'Coming soon!', duration: 1500, color: 'primary' });
    await t.present();
  }

  async signOut(): Promise<void> {
    await this.authService.signOut();
    this.router.navigate(['/home']);
  }
}
