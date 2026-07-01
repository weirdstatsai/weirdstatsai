import { Component, OnDestroy, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
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
  private authSub?: Subscription;

  constructor(
    private modalCtrl: ModalController,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.authSub = this.authService.user$.subscribe(user => {
      this.isLoggedIn = !!user;
      this.userEmoji = user ? (localStorage.getItem(EMOJI_STORAGE_KEY + user.uid) ?? '') : '';
    });
  }

  ngOnDestroy(): void {
    this.authSub?.unsubscribe();
  }

  async openLogin(): Promise<void> {
    const modal = await this.modalCtrl.create({ component: (await import('./login/login.component')).LoginComponent });
    await modal.present();
  }
}
