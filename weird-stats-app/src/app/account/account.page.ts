import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import firebase from 'firebase/compat/app';
import { AuthService } from '../services/auth.service';
import { AdminService } from '../services/admin.service';

@Component({
  selector: 'app-account',
  templateUrl: './account.page.html',
  styleUrls: ['./account.page.scss'],
})
export class AccountPage implements OnInit {
  user: firebase.User | null = null;
  isAdmin = false;

  constructor(
    private router: Router,
    private authService: AuthService,
    private adminService: AdminService,
    private toastCtrl: ToastController,
  ) {}

  async ngOnInit(): Promise<void> {
    this.user = this.authService.getCurrentUser();
    if (!this.user) { this.router.navigate(['/profile']); return; }
    this.isAdmin = await this.adminService.isAdmin(this.user.uid);
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
