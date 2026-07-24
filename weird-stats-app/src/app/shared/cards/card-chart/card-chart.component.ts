import { Component, Input, OnChanges } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { getAnimalSvg } from '../../animal-icons';
import { WeirdCard, ACCENT_COLORS, gradientForAccent } from '../../../models/weird-card.model';
import { GraphConfig } from '../../../models/graph.model';

@Component({
  selector: 'app-card-chart',
  templateUrl: './card-chart.component.html',
  styleUrls: ['./card-chart.component.scss'],
})
export class CardChartComponent implements OnChanges {
  @Input() card!: WeirdCard;
  @Input() size: 'feed' | 'full' | 'alt' = 'feed';
  /** Override chart type (used for alt variant cards in detail view) */
  @Input() forceType?: 'bar' | 'line' | 'doughnut';
  /** Play the draw-on reveal. Set false on offscreen PNG-capture frames
   *  (OG/share) so a still, finished chart is captured, never a half-drawn one. */
  @Input() animate = true;

  accent = '#6C5CE7';
  gradFrom = '#f5f3ff';
  gradTo   = '#ffffff';
  /** True when the resolved chart renders as a line/area — gates the CSS reveal. */
  chartIsLine = false;

  constructor(private sanitizer: DomSanitizer) {}

  get bgSvg(): SafeHtml | null {
    const svg = getAnimalSvg(this.card?.uiMeta?.icon ?? '');
    return svg ? this.sanitizer.bypassSecurityTrustHtml(svg) : null;
  }
  chartConfig?: GraphConfig;

  ngOnChanges(): void {
    const h = (this.card?.uiMeta?.accentColor ?? '').trim();
    this.accent   = (ACCENT_COLORS as readonly string[]).includes(h) ? h : ACCENT_COLORS[0];
    const grad = gradientForAccent(this.accent);
    this.gradFrom = grad.from;
    this.gradTo   = grad.to;
    this.chartConfig = this.buildConfig();
  }

  get chartHeight(): number {
    if (this.size === 'full') return 240;
    if (this.size === 'alt') return 100;
    return 120;
  }

  /** CSS-reveal duration — snappier on the feed, a touch longer on detail. */
  get revealMs(): number { return this.size === 'full' ? 1000 : 560; }

  /** Max value across fallback rows, for bar-width scaling. */
  get fallbackMax(): number {
    return Math.max(...(this.card.rows ?? []).map(r => r.value), 1);
  }

  fallbackBarWidth(value: number): number {
    return Math.max(4, Math.round((value / this.fallbackMax) * 100));
  }

  fmt(v: number): string {
    if (!isFinite(v)) return '—';   // never print NaN/Infinity on a chart label
    const a = Math.abs(v);
    if (a >= 1_000_000_000_000) return (v / 1_000_000_000_000).toFixed(a >= 1e13 ? 0 : 1) + 'T';
    if (a >= 1_000_000_000) return (v / 1_000_000_000).toFixed(a >= 1e10 ? 0 : 1) + 'B';
    if (a >= 1_000_000) return (v / 1_000_000).toFixed(a >= 1e7 ? 0 : 1) + 'M';
    if (a >= 1_000) return (v / 1_000).toFixed(a >= 10_000 ? 0 : 1) + 'K';
    return Number.isInteger(v) ? v.toString() : v.toFixed(1);
  }

  /** Pull a 4-digit year out of a label like "2021/22" or "2024/25 Projection". */
  private yearIn(label: unknown): number | null {
    const m = String(label ?? '').match(/(1[6-9]\d{2}|2[0-1]\d{2})/);
    return m ? parseInt(m[1], 10) : null;
  }

  /** True when the x labels are predominantly years — i.e. a real time series.
   *  Years are not "parts of a whole", so such a card must never be a pie. */
  get isTimeSeries(): boolean {
    const labels = this.card?.labels ?? [];
    if (labels.length < 2) return false;
    const years = labels.filter(l => this.yearIn(l) !== null).length;
    return years >= Math.ceil(labels.length * 0.6);
  }

  /** Whether a zero baseline keeps the shape readable. Starting the y-axis at
   *  an arbitrary floor (e.g. 40) misleads; starting at 0 is honest — but only
   *  when the values aren't a thin band way up high (which zero would flatten). */
  private zeroBaselineOk(): boolean {
    const d = (this.card?.datasets?.[0]?.data ?? []).filter(v => typeof v === 'number') as number[];
    if (!d.length) return true;
    const min = Math.min(...d), max = Math.max(...d);
    if (min < 0) return false;
    return max === 0 ? true : (min / max) <= 0.5;
  }

  /** Scriptable vertical area fill: a rich accent gradient fading to fully
   *  transparent at the baseline — the "premium area graph" look. Returns a flat
   *  translucent fallback on the first paint, before the chart area exists. */
  private areaFill(hex: string) {
    return (ctx: any) => {
      const area = ctx?.chart?.chartArea;
      const c = ctx?.chart?.ctx;
      if (!area || !c) return hex + '24';
      const g = c.createLinearGradient(0, area.top, 0, area.bottom);
      g.addColorStop(0, hex + '52');    // ~32% at the peak
      g.addColorStop(0.55, hex + '1f'); // ~12% midway
      g.addColorStop(1, hex + '00');    // transparent at the baseline
      return g;
    };
  }

  buildConfig(overrideType?: 'bar' | 'line' | 'doughnut'): GraphConfig | undefined {
    const c = this.card;
    this.chartIsLine = false;
    if (!c.labels?.length || !c.datasets?.length) return undefined;
    const hex = this.accent;
    let type = overrideType ?? this.forceType ?? (c.chartType as any) ?? 'bar';
    // A time series is never "parts of a whole" — coerce a mis-tagged pie/
    // doughnut of yearly values into a line so it renders with real axes.
    if ((type === 'doughnut' || type === 'pie') && this.isTimeSeries) type = 'line';
    const full = this.size === 'full';
    const unit = c.metric?.unit || '';

    const tickColor = '#9aa0aa';
    const gridColor = 'rgba(0,0,0,0.05)';
    const numFmt = (v: unknown) => this.fmt(Number(v));
    const showAxes = this.size !== 'alt';

    // Value labels make bars/lines self-explanatory — critical on feed tiles
    // where the axes are hidden. Off on tiny alt previews (no room).
    // Just the number on the chart — the unit rides the y-axis/tooltip and the
    // title, and a verbose unit ("people") would clip the label at the edges.
    const valueLabels = this.size === 'alt'
      ? { enabled: false }
      : { enabled: true, formatter: (v: number) => this.fmt(v),
          accent: hex, maxAll: 6, fontSize: full ? 11 : 9 };

    const baseOpts: any = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: full ? 500 : 0 },
      layout: { padding: { top: full ? 14 : 12, right: full ? 10 : 4, bottom: 0, left: 0 } },
      plugins: {
        legend: { display: false },
        valueLabels,
        tooltip: {
          enabled: full,
          backgroundColor: 'rgba(255,255,255,0.97)',
          titleColor: '#1a1a2e',
          bodyColor: '#555',
          borderColor: hex,
          borderWidth: 1,
          padding: 10,
          cornerRadius: 10,
          displayColors: false,
          titleFont: { size: 12, weight: '700' },
          bodyFont: { size: 12, weight: '600' },
        },
      },
    };

    // Shared, elegant axes: no chart border, hairline horizontal grid only,
    // formatted numeric ticks so millions/billions read as "8M" / "1.4B".
    // X labels (years/categories) show on feed too — a chart with no x context
    // is just a shape. Fewer ticks on the smaller feed tile so they don't crowd.
    const xScale = {
      display: showAxes,
      grid: { display: false, drawBorder: false },
      border: { display: false },
      ticks: { font: { size: full ? 11 : 10, weight: '500' }, color: tickColor, maxRotation: 0, autoSkip: true, maxTicksLimit: full ? 6 : 4, padding: 6 },
    };
    const yScale = (beginZero: boolean) => ({
      display: full,
      beginAtZero: beginZero,
      grace: '8%',
      grid: { color: gridColor, drawBorder: false, drawTicks: false },
      border: { display: false },
      ticks: { font: { size: 11 }, color: tickColor, padding: 8, maxTicksLimit: 6, callback: numFmt },
      title: unit
        ? { display: true, text: unit, font: { size: 10, weight: '600' }, color: '#b0b4bd' }
        : { display: false },
    });

    if (type === 'line') {
      // The line renders in ONE cheap pass (glow + points baked in). The
      // left-to-right "draw-on" is a GPU-friendly CSS clip on the canvas (see
      // .line-reveal in the scss) — no per-frame canvas redraw, so it can't
      // stutter. Capture frames (animate=false) simply get no reveal class.
      this.chartIsLine = true;
      return {
        type: 'line',
        data: {
          labels: c.labels,
          datasets: [{
            label: c.datasets[0].label || unit, data: c.datasets[0].data,
            borderColor: hex, backgroundColor: this.areaFill(hex),
            borderWidth: full ? 3 : 2.5,
            fill: true, tension: 0.42,
            pointRadius: full ? 3 : 0, pointHoverRadius: 5,
            pointBackgroundColor: hex, pointBorderColor: '#fff', pointBorderWidth: 1.5,
          } as any],
        },
        options: {
          ...baseOpts,
          animation: { duration: 0 },   // instant; the CSS clip does the reveal
          plugins: {
            ...baseOpts.plugins,
            // Soft accent glow under the stroke — the premium home-card look.
            lineGlow: { enabled: this.size !== 'alt', color: hex + '59', blur: full ? 14 : 9, offsetY: 3 },
            // Glowing head that traces the line while it draws, then rests on the
            // latest point as an end-cap. Detail view only — kept off the feed so
            // grids stay calm. Static (no travel) on capture frames, which is fine.
            lineHead: { enabled: full, color: hex, radius: 5 },
            tooltip: { ...baseOpts.plugins.tooltip,
              callbacks: { label: (ctx: any) => `${this.fmt(Number(ctx.parsed.y))}${unit ? ' ' + unit : ''}` } },
          },
          scales: { x: xScale, y: yScale(this.zeroBaselineOk()) },
        },
      };
    }

    if (type === 'doughnut' || type === 'pie') {
      const total = (c.datasets[0].data as number[]).reduce((a, b) => a + (b || 0), 0) || 1;
      return {
        type: 'doughnut',
        data: { labels: c.labels, datasets: [{ label: '', data: c.datasets[0].data, backgroundColor: [...ACCENT_COLORS], borderWidth: 3, borderColor: '#fff', hoverOffset: 6 } as any] },
        options: {
          ...baseOpts,
          cutout: '62%',
          plugins: {
            ...baseOpts.plugins,
            legend: { display: full, position: 'bottom', labels: { font: { size: 11 }, boxWidth: 10, boxHeight: 10, padding: 12, usePointStyle: true, pointStyle: 'circle' } },
            tooltip: { ...baseOpts.plugins.tooltip, callbacks: {
              label: (ctx: any) => { const v = Number(ctx.parsed); const pct = Math.round((v / total) * 100); return `${this.fmt(v)}${unit ? ' ' + unit : ''} · ${pct}%`; } } },
          },
        },
      };
    }

    return {
      type: 'bar',
      data: {
        labels: c.labels,
        datasets: [{
          label: c.datasets[0].label || unit, data: c.datasets[0].data,
          backgroundColor: hex + 'D9', hoverBackgroundColor: hex,
          borderWidth: 0, borderRadius: 6, borderSkipped: false,
          barPercentage: 0.68, categoryPercentage: 0.72,
        } as any],
      },
      options: {
        ...baseOpts,
        plugins: { ...baseOpts.plugins, tooltip: { ...baseOpts.plugins.tooltip,
          callbacks: { label: (ctx: any) => `${this.fmt(Number(ctx.parsed.y))}${unit ? ' ' + unit : ''}` } } },
        // Bars must start at zero to be honest about magnitude.
        scales: { x: xScale, y: yScale(true) },
      },
    };
  }
}
