import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { LoadingController, ToastController, NavController } from '@ionic/angular';
import { WeirdCard } from '../models/weird-card.model';
import { AuthService } from '../services/auth.service';
import { MembershipService } from '../services/membership.service';
import { firstValueFrom } from 'rxjs';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const domtoimage = require('dom-to-image-more');

@Component({
  selector: 'app-share-card',
  templateUrl: './share-card.page.html',
  styleUrls: ['./share-card.page.scss'],
})
export class ShareCardPage implements OnInit {
  @ViewChild('shareArea') shareArea?: ElementRef<HTMLElement>;

  card?: WeirdCard;
  cardId?: string;
  userDisplay = '';
  userInitial = '';
  isPremium = false;

  get canNativeShare(): boolean {
    return !!(navigator as any).share && !!(navigator as any).canShare;
  }

  constructor(
    private router: Router,
    private authService: AuthService,
    private membership: MembershipService,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private navCtrl: NavController,
  ) {}

  async ngOnInit(): Promise<void> {
    const nav = this.router.getCurrentNavigation();
    const state = (nav?.extras?.state ?? history.state) as
      { card?: WeirdCard; cardId?: string } | undefined;
    this.card   = state?.card;
    this.cardId = state?.cardId ?? undefined;

    this.isPremium = await this.membership.isPremium();

    const user = await firstValueFrom(this.authService.user$);
    if (user) {
      const name = user.displayName || user.email || user.phoneNumber || '';
      this.userDisplay = name.split('@')[0];
      this.userInitial = this.userDisplay.charAt(0).toUpperCase();
    }
  }

  /** Build the deep-link URL for this card */
  private cardUrl(): string {
    const base = window.location.origin;
    return this.cardId ? `${base}/card/${this.cardId}` : base;
  }

  /** Render the share frame to a PNG data URL */
  private async renderPng(): Promise<string | null> {
    const el = this.shareArea?.nativeElement;
    if (!el) return null;
    return domtoimage.toPng(el, { bgcolor: '#ffffff', scale: 2 });
  }

  /** Convert data URL to a File object */
  private dataUrlToFile(dataUrl: string, filename: string): File {
    const [header, data] = dataUrl.split(',');
    const mime = header.match(/:(.*?);/)![1];
    const bytes = atob(data);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new File([arr], filename, { type: mime });
  }

  /** Share to a specific platform — image + link on mobile, URL fallback on desktop */
  async shareTo(network: string): Promise<void> {
    if (!this.card) return;

    const loading = await this.loadingCtrl.create({ message: 'Preparing…', duration: 8000 });
    await loading.present();

    try {
      const dataUrl = await this.renderPng();
      const cardUrl = this.cardUrl();

      // --- Mobile: native share sheet — image first, URL attached below ---
      if (dataUrl && this.canNativeShare) {
        const file = this.dataUrlToFile(dataUrl, `${this.slug()}.png`);
        if ((navigator as any).canShare({ files: [file] })) {
          await loading.dismiss();
          try {
            await (navigator as any).share({
              files: [file],
              url: cardUrl,
              title: this.card.title,
            });
          } catch { /* user cancelled */ }
          return;
        }
      }

      // --- Desktop fallback: open platform URL ---
      await loading.dismiss();
      const enc  = encodeURIComponent;
      const urls: Record<string, string> = {
        whatsapp: `https://wa.me/?text=${enc(cardUrl)}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${enc(cardUrl)}`,
        twitter:  `https://twitter.com/intent/tweet?url=${enc(cardUrl)}`,
        linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(cardUrl)}`,
      };
      if (urls[network]) window.open(urls[network], '_blank', 'noopener');

    } catch {
      await loading.dismiss();
      this.toast('Something went wrong.');
    }
  }

  /** Fallback URL for <a href> on desktop (shown when canNativeShare is false) */
  shareUrl(network: string): string {
    if (!this.card) return '#';
    const enc = encodeURIComponent;
    const url = this.cardUrl();
    const map: Record<string, string> = {
      whatsapp: `https://wa.me/?text=${enc(url)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,
      twitter:  `https://twitter.com/intent/tweet?url=${enc(url)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`,
    };
    return map[network] ?? '#';
  }

  async download(): Promise<void> {
    const loading = await this.loadingCtrl.create({ message: 'Saving image…', duration: 8000 });
    await loading.present();
    try {
      const dataUrl = await this.renderPng();
      await loading.dismiss();
      if (!dataUrl) return;
      const link = document.createElement('a');
      link.download = `${this.slug()}.png`;
      link.href = dataUrl;
      link.click();
      this.toast('Image saved!');
    } catch {
      await loading.dismiss();
      this.toast('Could not save image.');
    }
  }

  private slug(): string {
    return (this.card?.title ?? 'weirdstats').replace(/\s+/g, '-').slice(0, 40);
  }

  private async toast(msg: string): Promise<void> {
    const t = await this.toastCtrl.create({ message: msg, duration: 1800, position: 'bottom' });
    await t.present();
  }

  back(): void { this.navCtrl.back(); }
}
