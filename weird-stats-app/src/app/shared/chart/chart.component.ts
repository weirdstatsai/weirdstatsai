import {
  Component, Input, OnChanges, OnDestroy,
  ElementRef, ViewChild, AfterViewInit, SimpleChanges, NgZone,
} from '@angular/core';
import { Chart, registerables } from 'chart.js';
import { GraphConfig } from '../../models/graph.model';

Chart.register(...registerables);

@Component({
  selector: 'app-chart',
  template: `<canvas #canvas></canvas>`,
  styles: [`
    :host { display: block; position: relative; }
    canvas { display: block; width: 100% !important; }
  `],
})
export class ChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @Input() config!: GraphConfig;
  @Input() height = 220;
  @Input() mini = false;

  private chart?: Chart;

  constructor(private zone: NgZone) {}

  ngAfterViewInit(): void {
    this.canvasRef.nativeElement.style.height = `${this.height}px`;
    requestAnimationFrame(() => this.render());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config'] && !changes['config'].firstChange) {
      this.destroy();
      setTimeout(() => this.render(), 0);
    }
  }

  ngOnDestroy(): void {
    this.destroy();
  }

  private render(): void {
    if (!this.canvasRef || !this.config) return;
    this.zone.runOutsideAngular(() => {
      const baseOpts = this.config.options ?? {};
      const isRadial = ['radar', 'polarArea', 'doughnut', 'pie'].includes(this.config.type);
      const miniOverrides = this.mini ? {
        plugins: { ...(baseOpts as any).plugins, legend: { display: false }, tooltip: { enabled: false } },
        scales: (baseOpts as any).scales
          ? Object.fromEntries(Object.keys((baseOpts as any).scales).map((k: string) => [k, { display: false }]))
          : isRadial ? { r: { display: false, ticks: { display: false }, pointLabels: { display: false }, grid: { display: false } } } : undefined,
        layout: { padding: isRadial ? 8 : 4 },
        aspectRatio: isRadial ? 1 : undefined,
      } : {};
      this.chart = new Chart(this.canvasRef.nativeElement, {
        type: this.config.type as any,
        data: this.config.data as any,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          ...baseOpts,
          ...miniOverrides,
        } as any,
      });
    });
  }

  private destroy(): void {
    this.chart?.destroy();
    this.chart = undefined;
  }
}
