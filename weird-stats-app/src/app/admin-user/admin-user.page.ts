import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController, AlertController } from '@ionic/angular';
import { AdminService } from '../services/admin.service';
import { StoredStatCard } from '../models/weird-card.model';

@Component({
  selector: 'app-admin-user',
  templateUrl: './admin-user.page.html',
  styleUrls: ['./admin-user.page.scss'],
})
export class AdminUserPage implements OnInit {
  uid = '';
  user: any = null;
  cards: StoredStatCard[] = [];
  isLoading = true;
  editingName = false;
  newName = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private adminService: AdminService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
  ) {}

  async ngOnInit(): Promise<void> {
    this.uid = this.route.snapshot.paramMap.get('uid') ?? '';
    const allUsers = await this.adminService.getAllUsers();
    this.user = allUsers.find(u => u.uid === this.uid) ?? null;
    this.newName = this.user?.displayName ?? '';
    this.cards = await this.adminService.getUserCards(this.uid) as any[];
    this.isLoading = false;
  }

  async saveName(): Promise<void> {
    if (!this.newName.trim()) return;
    await this.adminService.updateUser(this.uid, { displayName: this.newName.trim() });
    this.user.displayName = this.newName.trim();
    this.editingName = false;
    this.toast('Name updated');
  }

  async togglePlan(): Promise<void> {
    const newPlan = this.user.plan === 'premium' ? 'free' : 'premium';
    await this.adminService.updateUser(this.uid, { plan: newPlan });
    this.user.plan = newPlan;
    this.toast(`Plan set to ${newPlan}`);
  }

  async toggleBan(): Promise<void> {
    const banned = !this.user.banned;
    const alert = await this.alertCtrl.create({
      header: banned ? 'Ban user?' : 'Unban user?',
      message: banned ? 'They will not be able to generate cards.' : 'Restore their access.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: banned ? 'Ban' : 'Unban', role: 'destructive', handler: async () => {
          await this.adminService.updateUser(this.uid, { banned });
          this.user.banned = banned;
          this.toast(banned ? 'User banned' : 'User unbanned');
        }},
      ],
    });
    await alert.present();
  }

  async deleteCard(card: any): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Delete card?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Delete', role: 'destructive', handler: async () => {
          await this.adminService.deleteCard(card.id);
          this.cards = this.cards.filter((c: any) => (c as any).id !== card.id);
          this.toast('Card deleted');
        }},
      ],
    });
    await alert.present();
  }

  openCard(card: StoredStatCard): void {
    this.router.navigate(['/card'], {
      state: { card, viewOnly: false, isAdminView: true, returnUrl: '/admin-user/' + this.uid }
    });
  }

  initial(): string { return (this.user?.displayName || this.user?.email || '?').charAt(0).toUpperCase(); }

  private async toast(msg: string): Promise<void> {
    const t = await this.toastCtrl.create({ message: msg, duration: 1800 });
    await t.present();
  }

  back(): void { this.router.navigate(['/admin']); }
}
