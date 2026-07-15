import { Component, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';

interface MenuItem {
  label: string;
  icon: string;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
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

  constructor(private toastCtrl: ToastController) {}

  /** Surface the result when Stripe redirects the user back after checkout. */
  async ngOnInit(): Promise<void> {
    const checkout = new URLSearchParams(window.location.search).get('checkout');
    if (!checkout) return;

    const toast = await this.toastCtrl.create({
      message: checkout === 'success'
        ? 'Payment successful — your Premium access is being activated.'
        : 'Checkout cancelled. You can upgrade anytime from your profile.',
      duration: 4000,
      position: 'top',
      color: checkout === 'success' ? 'success' : 'medium',
    });
    await toast.present();

    // Strip the query param so a refresh doesn't re-trigger the toast.
    window.history.replaceState(
      {}, '', window.location.pathname + window.location.hash,
    );
  }
}
