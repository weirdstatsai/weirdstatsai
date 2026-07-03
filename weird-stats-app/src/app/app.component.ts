import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { ModalController, ToastController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { AuthService } from './services/auth.service';

interface MenuItem {
  label: string;
  icon: string;
}

const EMOJI_STORAGE_KEY = 'weird_stats_emoji_';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit, OnDestroy {
  menuItems: MenuItem[] = [
    { label: 'Dashboard', icon: 'grid-outline' },
    { label: 'Favorites', icon: 'heart-outline' },
    { label: 'Notifications', icon: 'notifications-outline' },
    { label: 'Achievements', icon: 'trophy-outline' },
    { label: 'Invite Friends', icon: 'people-outline' },
    { label: 'Settings', icon: 'settings-outline' },
    { label: 'About', icon: 'information-circle-outline' },
    { label: 'Help & Support', icon: 'help-circle-outline' },
  ];

  // Desktop shell (≥850px) — fixed left rail + top-right nav wrap every page
  // at this root level, not just the /tabs/* children, so card-detail, admin,
  // contact/terms/privacy etc. all get it too. Drives the Profile-vs-Login
  // swap in the top nav.
  isLoggedIn = false;
  userEmoji = '';
  // The fixed top nav only belongs to root pages; sub-pages (card detail,
  // share, admin…) surface their own toolbar in the header space instead.
  isRootPage = true;
  private authSub?: Subscription;
  private routerSub?: Subscription;

  constructor(
    private modalCtrl: ModalController,
    private toastCtrl: ToastController,
    private authService: AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.authSub = this.authService.user$.subscribe(user => {
      this.isLoggedIn = !!user;
      this.userEmoji = user ? (localStorage.getItem(EMOJI_STORAGE_KEY + user.uid) ?? '') : '';
    });
    this.routerSub = this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        const url = event.urlAfterRedirects.split(/[?#]/)[0];
        this.isRootPage = ['/home', '/explore', '/profile'].some(
          root => url === root || url.startsWith(root + '/'),
        );
      }
    });
  }

  ngOnDestroy(): void {
    this.authSub?.unsubscribe();
    this.routerSub?.unsubscribe();
  }

  async openNotifications(): Promise<void> {
    const toast = await this.toastCtrl.create({
      message: 'Notifications — coming soon!',
      duration: 1800,
      position: 'top',
      icon: 'notifications-outline',
    });
    await toast.present();
  }

  async openLogin(): Promise<void> {
    const modal = await this.modalCtrl.create({ component: (await import('./login/login.component')).LoginComponent });
    await modal.present();
  }
}
