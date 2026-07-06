import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ModalController, ToastController } from '@ionic/angular';
import html2canvas from 'html2canvas';
import { Graph } from '../models/graph.model';
import { GraphService } from '../services/graph.service';
import { AuthService } from '../services/auth.service';
import { AnalyticsService } from '../services/analytics.service';
import { LoginComponent } from '../login/login.component';

@Component({
  selector: 'app-share',
  templateUrl: './share.page.html',
  styleUrls: ['./share.page.scss'],
})
export class SharePage implements OnInit {
  @ViewChild('shareCard') shareCard?: ElementRef<HTMLElement>;

  graph?: Graph;

  constructor(
    private route: ActivatedRoute,
    private graphService: GraphService,
    private toastCtrl: ToastController,
    private authService: AuthService,
    private modalCtrl: ModalController,
    private analytics: AnalyticsService,
  ) {}

  private get cardId(): string {
    return this.route.snapshot.paramMap.get('id') || '';
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.graph = this.graphService.getById(id);
  }

  async shareTo(network: string): Promise<void> {
    this.analytics.track('share', { method: network, card_id: this.cardId });
    await this.withAuth(async () => {
      if (!this.graph) return;
      const text = `Weird Stats: ${this.graph.title} — ${this.graph.insight}`;

      // Try sharing the full share-card image via the native share sheet first.
      if (navigator.canShare) {
        const canvas = await this.renderShareCard();
        const blob = canvas ? await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png')) : null;
        if (blob) {
          const file = new File([blob], `${this.graph.title.replace(/\s+/g, '-')}.png`, { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            try {
              await navigator.share({ files: [file], text, title: this.graph.title });
              return;
            } catch {
              // User cancelled or share failed - fall back to link-based sharing below.
            }
          }
        }
      }

      const url = encodeURIComponent(window.location.href);
      const encodedText = encodeURIComponent(text);

      let target = '';
      switch (network) {
        case 'whatsapp':
          target = `https://wa.me/?text=${encodedText}`;
          break;
        case 'facebook':
          target = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
          break;
        case 'twitter':
          target = `https://twitter.com/intent/tweet?text=${encodedText}`;
          break;
        case 'linkedin':
          target = `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
          break;
      }
      if (target) window.open(target, '_blank');
    });
  }

  async download(): Promise<void> {
    this.analytics.track('share', { method: 'save_image', card_id: this.cardId });
    await this.withAuth(async () => {
      const canvas = await this.renderShareCard();
      if (!canvas) return;
      const link = document.createElement('a');
      link.download = `${(this.graph?.title ?? 'graph').replace(/\s+/g, '-')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
  }

  private async renderShareCard(): Promise<HTMLCanvasElement | null> {
    const card = this.shareCard?.nativeElement;
    if (!card) return null;
    return html2canvas(card, { backgroundColor: '#ffffff', scale: 2 });
  }

  async copyLink(): Promise<void> {
    this.analytics.track('share', { method: 'copy_link', card_id: this.cardId });
    await this.withAuth(async () => {
      await navigator.clipboard.writeText(window.location.href).catch(() => {});
      const toast = await this.toastCtrl.create({
        message: 'Link copied to clipboard!',
        duration: 2000,
        color: 'success',
      });
      await toast.present();
    });
  }

  private async withAuth(action: () => void | Promise<void>): Promise<void> {
    if (this.authService.isLoggedIn()) {
      await action();
      return;
    }
    const modal = await this.modalCtrl.create({ component: LoginComponent, cssClass: 'login-modal' });
    await modal.present();
    const { data } = await modal.onWillDismiss();
    if (data === true) {
      await action();
    }
  }
}
