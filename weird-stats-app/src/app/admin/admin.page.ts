import { Component, NgZone, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { HttpClient } from '@angular/common/http';
import { ToastController, AlertController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AdminService } from '../services/admin.service';
import { StoredStatCard } from '../models/weird-card.model';

interface Trend { topic: string; source: 'trends' | 'news' | 'politics'; }

@Component({
  selector: 'app-admin',
  templateUrl: './admin.page.html',
  styleUrls: ['./admin.page.scss'],
})
export class AdminPage implements OnInit {
  users: any[] = [];
  flaggedCards: any[] = [];
  activeTab: 'home' | 'users' | 'flagged' = 'home';
  isLoading = true;
  searchQuery = '';

  // ── Home-feed curation ──
  trends: Trend[] = [];
  trendsLoading = false;
  customTopic = '';
  homeCards: StoredStatCard[] = [];
  /** Topic currently being generated (prompt string) → shows a spinner. */
  generatingTopic: string | null = null;
  genStatus = '';
  private adminUid = '';

  readonly sourceOrder: Trend['source'][] = ['trends', 'news', 'politics'];
  readonly sourceMeta: Record<Trend['source'], { icon: string; label: string }> = {
    trends:   { icon: '🔥', label: 'Google Trends' },
    news:     { icon: '📰', label: 'Top news' },
    politics: { icon: '🏛️', label: 'Politics' },
  };

  constructor(
    private adminService: AdminService,
    private afs: AngularFirestore,
    private afAuth: AngularFireAuth,
    private http: HttpClient,
    private router: Router,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private ngZone: NgZone,
  ) {}

  async ngOnInit(): Promise<void> {
    const user = await firstValueFrom(this.afAuth.authState);
    this.adminUid = user?.uid ?? '';
    const isAdmin = await this.adminService.isAdmin();
    if (!isAdmin) { this.router.navigate(['/home']); return; }
    this.isLoading = false;
    this.loadHomeCards();
    this.loadTrends();
    this.loadUsers();
    this.loadFlagged();
  }

  // ── Home feed ─────────────────────────────────────────────────────────────
  trendsFor(source: Trend['source']): Trend[] {
    return this.trends.filter(t => t.source === source);
  }

  async loadTrends(): Promise<void> {
    this.trendsLoading = true;
    try {
      const res = await firstValueFrom(
        this.http.get<{ topics: Trend[] }>(`${environment.apiUrl}/api/admin/trending`)
      );
      this.trends = res?.topics ?? [];
    } catch {
      this.trends = [];
      this.toast('Could not load trending topics');
    } finally {
      this.trendsLoading = false;
    }
  }

  async loadHomeCards(): Promise<void> {
    try {
      const snap = await firstValueFrom(
        this.afs.collection<StoredStatCard>('stats', ref => ref.where('showOnHome', '==', true)).get()
      );
      this.homeCards = snap.docs
        .map(d => ({ ...(d.data() as StoredStatCard), id: d.id }))
        .sort((a, b) => (b.homeAddedAt ?? '').localeCompare(a.homeAddedAt ?? ''));
    } catch {
      this.homeCards = [];
    }
  }

  generateCustom(): void {
    const t = this.customTopic.trim();
    if (t) { this.generateToHome(t); this.customTopic = ''; }
  }

  /** Generate a card from a topic and push it straight to the Home feed. */
  async generateToHome(topic: string): Promise<void> {
    if (this.generatingTopic) return;
    this.generatingTopic = topic;
    this.genStatus = 'Starting…';
    try {
      const res = await fetch(`${environment.apiUrl}/api/generate/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: topic, uid: this.adminUid || null }),
      });
      if (!res.ok || !res.body) throw new Error('Stream failed');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let saved = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const event = JSON.parse(line.slice(6));
          if (event.type === 'status') {
            this.ngZone.run(() => { this.genStatus = event.message; });
          } else if (event.type === 'card') {
            await this.saveHomeCard(topic, event.data);
            saved = true;
          } else if (event.type === 'error') {
            throw new Error(event.message || 'Generation failed');
          }
        }
      }
      if (!saved) throw new Error('No card produced');
      this.ngZone.run(() => this.toast('Pushed to Home 🎉'));
    } catch (e: any) {
      this.ngZone.run(() => this.toast(e?.message || 'Generation failed'));
    } finally {
      this.ngZone.run(() => { this.generatingTopic = null; this.genStatus = ''; });
    }
  }

  private async saveHomeCard(topic: string, data: any): Promise<void> {
    const id = data.id || this.afs.createId();
    const now = new Date().toISOString();
    const doc: StoredStatCard = {
      id,
      status: 'completed',
      publishStatus: 'published',
      createdBy: this.adminUid,
      createdByName: 'WeirdStats',
      createdAt: data.createdAt ?? now,
      prompt: topic,
      promptHash: '',
      showOnHome: true,
      homeAddedAt: now,
      data,
    };
    await this.afs.collection('stats').doc(id).set(doc);
    this.ngZone.run(() => this.loadHomeCards());
  }

  async removeFromHome(card: StoredStatCard): Promise<void> {
    if (!card.id) return;
    const alert = await this.alertCtrl.create({
      header: 'Remove from Home?',
      message: 'This takes the card off the Home feed (the card itself is kept).',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Remove', role: 'destructive', handler: async () => {
          // Flip the flag off — keep the card (deleting it was destructive).
          await this.afs.doc(`stats/${card.id}`).update({ showOnHome: false });
          this.homeCards = this.homeCards.filter(c => c.id !== card.id);
          this.toast('Removed from Home');
        }},
      ],
    });
    await alert.present();
  }

  // ── Users / flagged (existing) ────────────────────────────────────────────
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
