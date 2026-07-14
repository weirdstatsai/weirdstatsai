import {
  Component, Input, OnChanges, OnDestroy,
  ElementRef, ViewChild, AfterViewInit, SimpleChanges, NgZone,
} from '@angular/core';
import { Chart, registerables } from 'chart.js';
import { GraphConfig } from '../../models/graph.model';

Chart.register(...registerables);

/**
 * Draws value labels on bar/line data points so a chart reads WITHOUT axes —
 * essential on feed tiles where the axes are hidden and the chart would
 * otherwise be a shape with no numbers. Opt-in per chart via
 * `options.plugins.valueLabels = { enabled, formatter, accent, maxAll }`.
 * Labels every point when there are few; otherwise just the ends, always
 * emphasising the latest value. A white halo keeps text legible over fills.
 */
const ValueLabelsPlugin = {
  id: 'valueLabels',
  afterDatasetsDraw(chart: any, _args: any, opts: any) {
    if (!opts?.enabled) return;
    const type = chart.config?.type;
    if (type !== 'bar' && type !== 'line') return;   // radial charts opt out
    const ctx = chart.ctx;
    const fmt = opts.formatter || ((v: number) => String(v));
    const accent = opts.accent || '#111827';
    const maxAll = opts.maxAll ?? 6;

    chart.data.datasets.forEach((ds: any, di: number) => {
      const meta = chart.getDatasetMeta(di);
      if (meta.hidden) return;
      const pts = meta.data || [];
      const n = pts.length;
      const showAll = n <= maxAll;
      const area = chart.chartArea;
      ctx.save();
      ctx.textBaseline = 'bottom';
      pts.forEach((el: any, i: number) => {
        const isLast = i === n - 1;
        const isEnd = isLast || i === 0;
        if (!showAll && !isEnd) return;
        const v = ds.data[i];
        if (v == null || isNaN(Number(v))) return;
        const pos = el.tooltipPosition ? el.tooltipPosition() : el.getCenterPoint();
        const text = fmt(Number(v));
        ctx.font = `${isLast ? 700 : 600} ${opts.fontSize || 10}px -apple-system, system-ui, sans-serif`;
        // Keep the label inside the plot area — left-align at the left edge,
        // right-align at the right edge, else centered above the point.
        const halfW = ctx.measureText(text).width / 2 + 1;
        let tx = pos.x;
        if (pos.x - halfW < area.left) { ctx.textAlign = 'left'; tx = area.left; }
        else if (pos.x + halfW > area.right) { ctx.textAlign = 'right'; tx = area.right; }
        else ctx.textAlign = 'center';
        // Nudge below the point if the label would clip the top edge.
        let ty = pos.y - 6;
        if (ty < area.top + 10) ty = pos.y + 16;
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(255,255,255,0.92)';
        ctx.strokeText(text, tx, ty);
        ctx.fillStyle = isLast ? accent : '#6b7280';
        ctx.fillText(text, tx, ty);
      });
      ctx.restore();
    });
  },
};
Chart.register(ValueLabelsPlugin);

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
