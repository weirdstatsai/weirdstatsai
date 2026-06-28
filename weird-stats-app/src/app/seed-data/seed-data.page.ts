import { Component, OnDestroy } from '@angular/core';
import { NavController } from '@ionic/angular';
import { AiService } from '../services/ai.service';
import { GraphService } from '../services/graph.service';

export type JobStatus = 'pending' | 'running' | 'done' | 'failed';

export interface SeedJob {
  prompt: string;
  status: JobStatus;
  title?: string;
  error?: string;
}

const SEED_QUESTIONS: string[] = [
  'Nicolas Cage movies vs swimming pool drownings per year',
  'Countries ranked by ice cream consumption vs shark attack rates',
  'IKEA store count vs divorce rate by country',
  'Which day of the week do most people quit their jobs?',
  'Coffee consumption per capita vs Nobel Prize winners by country',
  'Countries that swear the most online ranked',
  'Avocado toast sales vs first-home buyer rates by year',
  'How many times does the average person check their phone per day by age group',
  'Cheese consumption vs Olympic gold medals by country',
  'Countries where people work the most hours but have the lowest productivity',
  'Pirate attacks by year vs global music piracy rates',
  'Internet speed vs happiness index by country',
  'Countries where people spend the most money on their pets',
  'Percentage of people who lie on their CV by industry',
  'Fast food consumption vs hospital admissions by country',
  'Average number of friends people have by age',
  'Time spent in traffic vs life satisfaction by city',
  'Countries ranked by how often citizens say sorry',
  'Countries ranked by how much their citizens trust the government',
  'Time spent on the toilet in a lifetime by country',
  'Countries most likely to believe in aliens',
  'Correlation between video game hours and academic performance',
  'Countries with most conspiracy theory believers',
  'Productivity by hour of day across different professions',
  'Countries ranked by average daily nap duration',
];

@Component({
  selector: 'app-seed-data',
  templateUrl: './seed-data.page.html',
  styleUrls: ['./seed-data.page.scss'],
})
export class SeedDataPage implements OnDestroy {
  jobs: SeedJob[] = SEED_QUESTIONS.map(prompt => ({ prompt, status: 'pending' }));
  isRunning = false;
  currentIndex = -1;
  private stopped = false;

  constructor(
    private navCtrl: NavController,
    private aiService: AiService,
    private graphService: GraphService,
  ) {}

  get doneCount(): number   { return this.jobs.filter(j => j.status === 'done').length; }
  get failedCount(): number { return this.jobs.filter(j => j.status === 'failed').length; }
  get progress(): number    { return Math.round(((this.doneCount + this.failedCount) / this.jobs.length) * 100); }
  get allFinished(): boolean { return this.doneCount + this.failedCount === this.jobs.length; }

  async runAll(): Promise<void> {
    this.stopped = false;
    this.isRunning = true;

    for (let i = 0; i < this.jobs.length; i++) {
      if (this.stopped) break;
      const job = this.jobs[i];
      if (job.status === 'done') continue;

      this.currentIndex = i;
      job.status = 'running';

      await new Promise<void>(resolve => {
        this.aiService.generateGraph(job.prompt).subscribe({
          next: graph => {
            const draft = { ...graph, saved: false };
            this.graphService.add(draft);
            job.status = 'done';
            job.title = draft.title;
            resolve();
          },
          error: () => {
            job.status = 'failed';
            job.error = 'API error — will retry on re-run';
            resolve();
          },
        });
      });
    }

    this.isRunning = false;
    this.currentIndex = -1;
  }

  stop(): void {
    this.stopped = true;
    this.isRunning = false;
    const running = this.jobs.find(j => j.status === 'running');
    if (running) running.status = 'pending';
    this.currentIndex = -1;
  }

  reset(): void {
    this.stop();
    this.jobs = SEED_QUESTIONS.map(prompt => ({ prompt, status: 'pending' }));
  }

  retryFailed(): void {
    this.jobs.filter(j => j.status === 'failed').forEach(j => {
      j.status = 'pending';
      j.error = undefined;
    });
    this.runAll();
  }

  statusIcon(status: JobStatus): string {
    return { pending: 'ellipse-outline', running: 'sync-outline', done: 'checkmark-circle', failed: 'close-circle' }[status];
  }

  goBack(): void { this.navCtrl.back(); }

  ngOnDestroy(): void { this.stopped = true; }
}
