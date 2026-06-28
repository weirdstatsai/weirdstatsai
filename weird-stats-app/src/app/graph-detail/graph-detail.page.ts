import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NavController, ToastController } from '@ionic/angular';
import { Graph } from '../models/graph.model';
import { GraphService } from '../services/graph.service';
import { AiService } from '../services/ai.service';

@Component({
  selector: 'app-graph-detail',
  templateUrl: './graph-detail.page.html',
  styleUrls: ['./graph-detail.page.scss'],
})
export class GraphDetailPage implements OnInit {
  graph?: Graph;
  alternatives: Graph[] = [];
  altMiniConfigs: any[] = [];
  chartHeight = 300;
  isGenerating = false;
  errorMsg = '';
  prompt = '';
  menuOpen = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private navCtrl: NavController,
    private toastCtrl: ToastController,
    private graphService: GraphService,
    private aiService: AiService,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      // Existing graph — load from store
      const g = this.graphService.getById(id);
      this.graph = g;
      // Alternatives aren't persisted, so rebuild them from the graph's own
      // data — available for both drafts and saved graphs.
      this.alternatives = g ? this.aiService.buildAlternativesFor(g) : [];
      this.altMiniConfigs = this.alternatives.map(a => this.miniConfig(a.config));
    } else {
      // New generation — read prompt from navigation state
      const nav = this.router.getCurrentNavigation();
      const state = (nav?.extras?.state ?? history.state) as { prompt?: string } | undefined;
      if (state?.prompt) {
        this.prompt = state.prompt;
        this.generate();
      }
    }
  }

  generate(): void {
    if (!this.prompt.trim()) return;
    this.isGenerating = true;
    this.graph = undefined;
    this.alternatives = [];
    this.errorMsg = '';

    this.aiService.generateGraph(this.prompt.trim()).subscribe({
      next: g => {
        const { alternatives, ...clean } = g;
        const draft = { ...clean, saved: false };
        // Auto-save as draft so the graph has an ID and appears in Drafts
        this.graphService.add(draft);
        this.graph = draft;
        // Include the current take first, then the AI's alternatives.
        this.alternatives = [
          { ...draft, alternatives: undefined },
          ...(alternatives ?? []),
        ];
        this.altMiniConfigs = this.alternatives.map(a => this.miniConfig(a.config));
        this.isGenerating = false;
      },
      error: () => {
        this.errorMsg = 'Something went wrong. Try again!';
        this.isGenerating = false;
      },
    });
  }

  selectAlternative(alt: Graph): void {
    if (!this.graph) return;
    // Swap in the alternative's config and type, keep the id/title/insight/tags/etc.
    this.graph = {
      ...this.graph,
      type: alt.type,
      config: alt.config,
    };
    // Persist so the chosen take sticks for both drafts and saved graphs
    this.graphService.setChartType(this.graph.id, alt.type, alt.config);
  }

  get insightLines(): string[] {
    if (!this.graph) return [];
    return this.graph.insight
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  miniConfig(config: any): any {
    if (!config) return config;
    const opts = config.options ?? {};
    const newOpts: any = {
      ...opts,
      animation: false,
      plugins: {
        ...(opts.plugins ?? {}),
        legend: { display: false },
        tooltip: { enabled: false },
      },
    };
    if (opts.scales) {
      newOpts.scales = {};
      for (const key of Object.keys(opts.scales)) {
        newOpts.scales[key] = { display: false };
      }
    }
    return { ...config, options: newOpts };
  }

  goBack(): void {
    this.navCtrl.back();
  }

  toggleMenu(event: Event): void {
    event.stopPropagation();
    this.menuOpen = !this.menuOpen;
  }

  closeMenu(): void {
    this.menuOpen = false;
  }

  save(): void {
    if (!this.graph || this.graph.saved) return;
    this.graphService.toggleSave(this.graph.id);
    this.graph = { ...this.graph, saved: true };
    this.showToast('Saved!', 'bookmark');
    this.menuOpen = false;
  }

  sendToDraft(): void {
    if (!this.graph) return;
    this.graphService.toggleSave(this.graph.id);
    this.graph = { ...this.graph, saved: false };
    this.showToast('Moved to drafts', 'document-outline');
    this.menuOpen = false;
  }

  deleteGraph(): void {
    if (!this.graph) return;
    this.graphService.delete(this.graph.id);
    this.menuOpen = false;
    this.navCtrl.back();
  }

  share(): void {
    if (!this.graph) return;
    this.router.navigate(['/share', this.graph.id]);
  }

  weirdStars(score: number): string {
    return '★'.repeat(Math.min(Math.round(score / 2), 5));
  }

  private async showToast(message: string, icon: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 1500,
      color: 'primary',
      icon,
      position: 'bottom',
    });
    await toast.present();
  }
}
