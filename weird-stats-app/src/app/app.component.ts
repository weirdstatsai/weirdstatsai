import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { ModalController, ToastController } from '@ionic/angular';
import { Subscription, of, switchMap } from 'rxjs';
import { AuthService } from './services/auth.service';
import { SeoData, SeoService } from './services/seo.service';
import { ConsentService } from './services/consent.service';
import { AnalyticsService } from './services/analytics.service';
import { EmojiService } from './services/emoji.service';

interface MenuItem {
  label: string;
  icon: string;
}

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
  // Cookie-consent banner — shown until the visitor accepts or declines.
  showConsentBanner = false;
  private authSub?: Subscription;
  private routerSub?: Subscription;

  constructor(
    private modalCtrl: ModalController,
    private toastCtrl: ToastController,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private seo: SeoService,
    private consent: ConsentService,
    private analytics: AnalyticsService,
    private emojiService: EmojiService,
  ) {}

  ngOnInit(): void {
    // Consent: returning visitors who already accepted get analytics right away;
    // undecided visitors see the banner. (analytics.init() is a no-op in dev.)
    const status = this.consent.status();
    if (status === 'granted') this.analytics.init();
    else if (status === 'unset') this.showConsentBanner = true;

    // Avatar emoji follows the account (Firestore-synced) and updates live
    // when the user picks a new one.
    this.authSub = this.authService.user$.pipe(
      switchMap(user => {
        this.isLoggedIn = !!user;
        return user ? this.emojiService.emoji$(user.uid) : of('');
      }),
    ).subscribe(emoji => { this.userEmoji = emoji; });
    this.routerSub = this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        const url = event.urlAfterRedirects.split(/[?#]/)[0];
        this.isRootPage = ['/home', '/explore', '/profile'].some(
          root => url === root || url.startsWith(root + '/'),
        );
        this.applyRouteSeo(url);
        this.analytics.trackPage(url); // no-op until analytics is initialised
      }
    });
  }

  acceptConsent(): void {
    this.consent.grant();
    this.showConsentBanner = false;
    this.analytics.init();
  }

  declineConsent(): void {
    this.consent.deny();
    this.showConsentBanner = false;
  }

  ngOnDestroy(): void {
    this.authSub?.unsubscribe();
    this.routerSub?.unsubscribe();
  }

  /**
   * Apply per-route SEO from the deepest activated route's `data.seo`, falling
   * back to site defaults. Pages with dynamic content (card detail, public
   * profile) omit `data.seo` and call SeoService themselves once loaded.
   */
  private applyRouteSeo(url: string): void {
    let r = this.route;
    while (r.firstChild) r = r.firstChild;
    const seo = r.snapshot.data['seo'] as SeoData | undefined;
    const dynamic = r.snapshot.data['dynamicSeo'] as boolean | undefined;
    if (dynamic) return; // page manages its own tags
    if (seo) this.seo.update({ url, ...seo });
    else this.seo.reset();
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
    const modal = await this.modalCtrl.create({ component: (await import('./login/login.component')).LoginComponent, cssClass: 'login-modal' });
    await modal.present();
  }
}
