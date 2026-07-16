import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { NavController, ToastController, AlertController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { AdminService } from '../services/admin.service';

/** Admin-only list of flagged/reported cards. Reached from the Admin panel's
 *  Flagged metric. */
@Component({
  selector: 'app-admin-flagged',
  templateUrl: './admin-flagged.page.html',
  styleUrls: ['./admin-flagged.page.scss'],
})
export class AdminFlaggedPage implements OnInit {
  flaggedCards: any[] = [];
  isLoading = true;

  constructor(
    private adminService: AdminService,
    private afs: AngularFirestore,
    private router: Router,
    private nav: NavController,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
  ) {}

  async ngOnInit(): Promise<void> {
    const isAdmin = await this.adminService.isAdmin();
    if (!isAdmin) { this.router.navigate(['/home']); return; }
    await this.loadFlagged();
    this.isLoading = false;
  }

  async loadFlagged(): Promise<void> {
    try {
      const snap = await firstValueFrom(
        this.afs.collection('stats', ref => ref.where('flagCount', '>', 0)).get()
      );
      this.flaggedCards = snap.docs.map(d => ({ id: d.id, ...d.data() as any }));
    } catch { this.flaggedCards = []; }
  }

  async deleteCard(cardId: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Delete card?',
      message: 'This cannot be undone.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Delete', role: 'destructive', handler: async () => {
          await this.adminService.deleteCard(cardId);
          this.flaggedCards = this.flaggedCards.filter(c => c.id !== cardId);
          this.toast('Card deleted');
        }},
      ],
    });
    await alert.present();
  }

  async dismissFlag(cardId: string): Promise<void> {
    await this.afs.doc(`stats/${cardId}`).update({ flagCount: 0 });
    this.flaggedCards = this.flaggedCards.filter(c => c.id !== cardId);
    this.toast('Flag dismissed');
  }

  private async toast(msg: string): Promise<void> {
    const t = await this.toastCtrl.create({ message: msg, duration: 1800, position: 'bottom' });
    await t.present();
  }

  back(): void {
    this.nav.back();
  }
}
