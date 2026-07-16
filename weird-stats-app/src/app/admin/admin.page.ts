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
  usersCount = 0;
  flaggedCount = 0;
  homeCards: StoredStatCard[] = [];
  isLoading = true;

  // ── Trending (Google Trends / news / politics) → push to Home ──
  trends: Trend[] = [];
  trendsLoading = false;
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
    this.loadCounts();
  }

  /** Metric counts only — the full lists live on their own admin pages. */
  private async loadCounts(): Promise<void> {
    try {
      const users = await this.adminService.getAllUsers();
      this.usersCount = users.filter(u => !u.isAdmin).length;
    } catch { this.usersCount = 0; }
    try {
      const snap = await firstValueFrom(
        this.afs.collection('stats', ref => ref.where('flagCount', '>', 0)).get()
      );
      this.flaggedCount = snap.size;
    } catch { this.flaggedCount = 0; }
  }

  // ── Trending ────────────────────────────────────────────────────────────
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

  // ── Home feed ───────────────────────────────────────────────────────────
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

  async removeFromHome(card: StoredStatCard): Promise<void> {
    if (!card.id) return;
    const alert = await this.alertCtrl.create({
      header: 'Remove from Home?',
      message: 'This takes the card off the Home feed (the card itself is kept).',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Remove', role: 'destructive', handler: async () => {
          await this.afs.doc(`stats/${card.id}`).update({ showOnHome: false });
          this.homeCards = this.homeCards.filter(c => c.id !== card.id);
          this.toast('Removed from Home');
        }},
      ],
    });
    await alert.present();
  }

  goUsers(): void { this.router.navigate(['/admin-users']); }
  goFlagged(): void { this.router.navigate(['/admin-flagged']); }

  private async toast(msg: string): Promise<void> {
    const t = await this.toastCtrl.create({ message: msg, duration: 1800, position: 'bottom' });
    await t.present();
  }

  back(): void { this.router.navigate(['/profile']); }
}
