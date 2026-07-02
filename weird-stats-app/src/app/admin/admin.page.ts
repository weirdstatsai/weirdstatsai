import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { ToastController, AlertController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { AdminService } from '../services/admin.service';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.page.html',
  styleUrls: ['./admin.page.scss'],
})
export class AdminPage implements OnInit {
  users: any[] = [];
  flaggedCards: any[] = [];
  activeTab: 'users' | 'flagged' = 'users';
  isLoading = true;
  searchQuery = '';

  constructor(
    private adminService: AdminService,
    private afs: AngularFirestore,
    private router: Router,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
  ) {}

  async ngOnInit(): Promise<void> {
    const isAdmin = await this.adminService.isAdmin();
    if (!isAdmin) { this.router.navigate(['/home']); return; }
    await this.loadUsers();
    await this.loadFlagged();
    this.isLoading = false;
  }

  async loadUsers(): Promise<void> {
    const allUsers = await this.adminService.getAllUsers();
    // Enrich with card count from stats
    const statsSnap = await firstValueFrom(this.afs.collection('stats').get());
    const countMap = new Map<string, number>();
    for (const doc of statsSnap.docs) {
      const uid = (doc.data() as any).createdBy;
      if (uid) countMap.set(uid, (countMap.get(uid) ?? 0) + 1);
    }
    this.users = allUsers
      .filter(u => !u.isAdmin)
      .map(u => ({ ...u, cardCount: countMap.get(u.uid) ?? 0 }))
      .sort((a, b) => (b.cardCount - a.cardCount));
  }

  async loadFlagged(): Promise<void> {
    try {
      const snap = await firstValueFrom(
        this.afs.collection('stats', ref => ref.where('flagCount', '>', 0)).get()
      );
      this.flaggedCards = snap.docs.map(d => ({ id: d.id, ...d.data() as any }));
    } catch { this.flaggedCards = []; }
  }

  get filteredUsers(): any[] {
    const q = this.searchQuery.toLowerCase();
    if (!q) return this.users;
    return this.users.filter(u =>
      (u.displayName ?? '').toLowerCase().includes(q) ||
      (u.email ?? '').toLowerCase().includes(q)
    );
  }

  openUser(uid: string): void {
    this.router.navigate(['/admin-user', uid]);
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

  back(): void { this.router.navigate(['/profile']); }
}
