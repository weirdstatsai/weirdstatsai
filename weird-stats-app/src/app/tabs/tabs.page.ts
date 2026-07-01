import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ModalController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { AuthService } from '../services/auth.service';

const EMOJI_STORAGE_KEY = 'weird_stats_emoji_';

@Component({
  selector: 'app-tabs',
  templateUrl: './tabs.page.html',
  styleUrls: ['./tabs.page.scss'],
})
export class TabsPage implements OnInit, OnDestroy {
  // Drives the desktop top-nav (≥850px): Profile link with avatar when signed
  // in, a Log in / Sign up button otherwise. Bottom tab bar (mobile) is
  // unaffected by this — it always shows Profile and prompts sign-in on tap.
  isLoggedIn = false;
  userEmoji = '';
  private authSub?: Subscription;

  constructor(
    private router: Router,
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
    const modal = await this.modalCtrl.create({ component: (await import('../login/login.component')).LoginComponent });
    await modal.present();
  }

  goGenerate(): void {
    this.router.navigate(['/graph-detail']);
  }
}
