import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { ChartType, Graph, GraphConfig } from '../models/graph.model';
import { AiService } from '../services/ai.service';
import { GraphService } from '../services/graph.service';

interface ChartOption {
  type: ChartType;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-generate',
  templateUrl: './generate.page.html',
  styleUrls: ['./generate.page.scss'],
})
export class GeneratePage implements OnInit {
  prompt = '';
  selectedType: ChartType | undefined = undefined;
  isGenerating = false;
  generatedGraph: Graph | null = null;
  errorMsg = '';
  private graphAdded = false;

  chartOptions: ChartOption[] = [
    { type: 'bar',       label: 'Bar',     icon: 'bar-chart-outline' },
    { type: 'line',      label: 'Line',    icon: 'analytics-outline' },
    { type: 'scatter',   label: 'Scatter', icon: 'ellipse-outline' },
    { type: 'doughnut',  label: 'Donut',   icon: 'pie-chart-outline' },
    { type: 'radar',     label: 'Radar',   icon: 'radio-outline' },
    { type: 'bubble',    label: 'Bubble',  icon: 'albums-outline' },
  ];

  suggestions: string[] = [];

  constructor(
    private aiService: AiService,
    private graphService: GraphService,
    private toastCtrl: ToastController,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.suggestions = this.aiService.getSuggestions().slice(0, 5);
    // Pre-fill prompt if navigated from home
    const nav = this.router.getCurrentNavigation();
    const state = nav?.extras?.state as { prompt?: string } | undefined;
    if (state?.prompt) {
      this.prompt = state.prompt;
    }
  }

  ionViewWillEnter(): void {
    // Check for passed state again (for cached views)
    const extras = history.state as { prompt?: string };
    if (extras?.prompt && !this.prompt) {
      this.prompt = extras.prompt;
    }
  }

  selectType(type: ChartType): void {
    this.selectedType = this.selectedType === type ? undefined : type;
  }

  useSuggestion(s: string): void {
    this.prompt = s;
  }

  async generate(): Promise<void> {
    if (!this.prompt.trim()) return;
    this.isGenerating = true;
    this.generatedGraph = null;
    this.errorMsg = '';

    this.aiService.generateGraph(this.prompt.trim(), this.selectedType).subscribe({
      next: graph => {
        this.generatedGraph = graph;
        this.isGenerating = false;
      },
      error: () => {
        this.errorMsg = 'Something went wrong. Try again!';
        this.isGenerating = false;
      },
    });
  }

  ionViewWillLeave(): void {
    // Auto-save as draft if user leaves without explicitly saving
    if (this.generatedGraph && !this.graphAdded) {
      this.graphService.add({ ...this.generatedGraph, saved: false });
      this.graphAdded = true;
    }
  }

  saveDraft(): void {
    if (!this.generatedGraph) return;
    this.graphService.add({ ...this.generatedGraph, saved: false });
    this.graphAdded = true;
    this.router.navigate(['/tabs/home']);
  }

  async save(): Promise<void> {
    if (!this.generatedGraph) return;
    this.graphService.add({ ...this.generatedGraph, saved: true });
    this.graphAdded = true;
    const toast = await this.toastCtrl.create({
      message: 'Graph saved!',
      duration: 2000,
      color: 'primary',
      position: 'bottom',
    });
    await toast.present();
  }

  viewDetail(): void {
    if (!this.generatedGraph) return;
    this.graphService.add({ ...this.generatedGraph, saved: false });
    this.graphAdded = true;
    this.router.navigate(['/graph-detail', this.generatedGraph.id]);
  }

  regenerate(): void {
    this.graphAdded = false;
    this.generate();
  }

  reset(): void {
    this.prompt = '';
    this.generatedGraph = null;
    this.selectedType = undefined;
    this.graphAdded = false;
  }
}
