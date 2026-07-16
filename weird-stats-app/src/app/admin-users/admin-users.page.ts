import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { NavController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { AdminService } from '../services/admin.service';

/** Admin-only list of all users. Reached from the Admin panel's Users metric. */
@Component({
  selector: 'app-admin-users',
  templateUrl: './admin-users.page.html',
  styleUrls: ['./admin-users.page.scss'],
})
export class AdminUsersPage implements OnInit {
  users: any[] = [];
  isLoading = true;
  searchQuery = '';

  constructor(
    private adminService: AdminService,
    private afs: AngularFirestore,
    private router: Router,
    private nav: NavController,
  ) {}

  async ngOnInit(): Promise<void> {
    const isAdmin = await this.adminService.isAdmin();
    if (!isAdmin) { this.router.navigate(['/home']); return; }
    await this.loadUsers();
    this.isLoading = false;
  }

  async loadUsers(): Promise<void> {
    const allUsers = await this.adminService.getAllUsers();
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

  get filteredUsers(): any[] {
    const q = this.searchQuery.toLowerCase().trim();
    if (!q) return this.users;
    return this.users.filter(u =>
      (u.displayName ?? '').toLowerCase().includes(q) ||
      (u.email ?? '').toLowerCase().includes(q)
    );
  }

  openUser(uid: string): void {
    this.router.navigate(['/admin-user', uid]);
  }

  back(): void {
    this.nav.back();
  }
}
