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

/**
 * Soft accent glow beneath a line/area stroke — wraps the line dataset draw in
 * a canvas shadow so the stroke reads like the premium home story cards rather
 * than a flat 1px chart line. Opt-in per chart via
 * `options.plugins.lineGlow = { enabled, color, blur, offsetY }`. Scoped to the
 * line dataset only (fill is translucent so its shadow is negligible), and the
 * shadow is torn down before value labels/points-on-top are drawn.
 */
const LineGlowPlugin = {
  id: 'lineGlow',
  beforeDatasetDraw(chart: any, args: any, opts: any) {
    if (!opts?.enabled || args?.meta?.type !== 'line') return;
    const ctx = chart.ctx;
    ctx.save();
    ctx.shadowColor = opts.color || 'rgba(108,92,231,0.45)';
    ctx.shadowBlur = opts.blur ?? 12;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = opts.offsetY ?? 4;
  },
  afterDatasetDraw(chart: any, args: any, opts: any) {
    if (!opts?.enabled || args?.meta?.type !== 'line') return;
    chart.ctx.restore();
  },
};
Chart.register(LineGlowPlugin);

/**
 * A glowing "head" that rides the drawing frontier of a line as it animates on —
 * a bright accent dot (white core) at the right-most drawn vertex each frame, so
 * the line reads as being traced live. Once the animation settles it rests on the
 * final point as an emphasised end-cap on the latest value. Opt-in via
 * `options.plugins.lineHead = { enabled, color, radius }`.
 */
const LineHeadPlugin = {
  id: 'lineHead',
  afterDatasetsDraw(chart: any, _args: any, opts: any) {
    if (!opts?.enabled || chart.config?.type !== 'line') return;
    const pts = chart.getDatasetMeta(0)?.data || [];
    let head: any = null;
    for (const el of pts) {
      if (el && isFinite(el.x) && isFinite(el.y) && (!head || el.x > head.x)) head = el;
    }
    if (!head) return;
    const ctx = chart.ctx;
    const color = opts.color || '#6C5CE7';
    const r = opts.radius ?? 5;
    ctx.save();
    ctx.beginPath();
    ctx.arc(head.x, head.y, r, 0, Math.PI * 2);
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.shadowBlur = 0;                       // crisp white core, no halo
    ctx.beginPath();
    ctx.arc(head.x, head.y, r * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
  },
};
Chart.register(LineHeadPlugin);

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
  private ro?: ResizeObserver;

  constructor(private zone: NgZone, private host: ElementRef<HTMLElement>) {}

  /** Pin BOTH the host and the canvas to the requested height. Chart.js
   *  (responsive + maintainAspectRatio:false) sizes the canvas to its PARENT's
   *  box; if the parent — this host — has no explicit height, it derives its
   *  height from the canvas, a circular dependency that intermittently collapses
   *  the canvas to ~0px. That left the 2nd+ chart in a row blank (the card-detail
   *  "Alternatives" previews) and could blank a chart after a scroll-driven
   *  resize(). An explicit host height breaks the cycle so every instance keeps
   *  its intended size. */
  private applyHeight(): void {
    const h = `${this.height}px`;
    this.host.nativeElement.style.height = h;
    if (this.canvasRef) this.canvasRef.nativeElement.style.height = h;
  }

  ngAfterViewInit(): void {
    this.applyHeight();
    requestAnimationFrame(() => this.render());
    // A card can be laid out at ZERO size (tile still off-screen / parent not
    // sized yet). Chart.js measures once at construction, so it would render
    // into a 0x0 canvas and stay blank forever. Re-render the first time the
    // canvas actually gains a size.
    if (typeof ResizeObserver !== 'undefined') {
      this.zone.runOutsideAngular(() => {
        this.ro = new ResizeObserver(entries => {
          const box = entries[0]?.contentRect;
          if (!box || box.width < 1) return;
          if (!this.chart) this.render();
          else this.chart.resize();
        });
        this.ro.observe(this.canvasRef.nativeElement);
      });
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['height'] && !changes['height'].firstChange) this.applyHeight();
    if (changes['config'] && !changes['config'].firstChange) {
      this.destroy();
      setTimeout(() => this.render(), 0);
    }
  }

  ngOnDestroy(): void {
    this.ro?.disconnect();
    this.ro = undefined;
    this.destroy();
  }

  private render(): void {
    if (!this.canvasRef || !this.config) return;
    // Nothing to draw into yet — the ResizeObserver will call back with a size.
    if (this.canvasRef.nativeElement.clientWidth < 1) return;
    this.destroy();
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
