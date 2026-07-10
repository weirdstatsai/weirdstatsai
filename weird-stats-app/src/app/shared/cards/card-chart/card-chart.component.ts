import { Component, Input, OnChanges } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { getAnimalSvg } from '../../animal-icons';
import { WeirdCard, ACCENT_COLORS } from '../../../models/weird-card.model';
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

  accent = '#6C5CE7';
  gradFrom = '#f5f3ff';
  gradTo   = '#ffffff';

  constructor(private sanitizer: DomSanitizer) {}

  get bgSvg(): SafeHtml | null {
    const svg = getAnimalSvg(this.card?.uiMeta?.icon ?? '');
    return svg ? this.sanitizer.bypassSecurityTrustHtml(svg) : null;
  }
  chartConfig?: GraphConfig;

  ngOnChanges(): void {
    const h = (this.card?.uiMeta?.accentColor ?? '').trim();
    this.accent   = (ACCENT_COLORS as readonly string[]).includes(h) ? h : ACCENT_COLORS[0];
    this.gradFrom = this.card?.uiMeta?.gradientFrom || '#f5f3ff';
    this.gradTo   = this.card?.uiMeta?.gradientTo   || '#ffffff';
    this.chartConfig = this.buildConfig();
  }

  get chartHeight(): number {
    if (this.size === 'full') return 240;
    if (this.size === 'alt') return 100;
    return 120;
  }

  /** Max value across fallback rows, for bar-width scaling. */
  get fallbackMax(): number {
    return Math.max(...(this.card.rows ?? []).map(r => r.value), 1);
  }

  fallbackBarWidth(value: number): number {
    return Math.max(4, Math.round((value / this.fallbackMax) * 100));
  }

  fmt(v: number): string {
    if (Math.abs(v) >= 1_000_000_000) return (v / 1_000_000_000).toFixed(v >= 10_000_000_000 ? 0 : 1) + 'B';
    if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1) + 'M';
    if (Math.abs(v) >= 1_000) return (v / 1_000).toFixed(v >= 10_000 ? 0 : 1) + 'K';
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

  buildConfig(overrideType?: 'bar' | 'line' | 'doughnut'): GraphConfig | undefined {
    const c = this.card;
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

    const baseOpts: any = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: full ? 500 : 0 },
      layout: { padding: { top: 6, right: full ? 10 : 4, bottom: 0, left: 0 } },
      plugins: {
        legend: { display: false },
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
    const xScale = {
      display: full,
      grid: { display: false, drawBorder: false },
      border: { display: false },
      ticks: { font: { size: 11, weight: '500' }, color: tickColor, maxRotation: 0, autoSkip: true, maxTicksLimit: 6, padding: 6 },
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
      return {
        type: 'line',
        data: {
          labels: c.labels,
          datasets: [{
            label: c.datasets[0].label || unit, data: c.datasets[0].data,
            borderColor: hex, backgroundColor: hex + '1f', borderWidth: 2.5,
            fill: true, tension: 0.4,
            pointRadius: full ? 3 : 0, pointHoverRadius: 5,
            pointBackgroundColor: hex, pointBorderColor: '#fff', pointBorderWidth: 1.5,
          } as any],
        },
        options: {
          ...baseOpts,
          plugins: { ...baseOpts.plugins, tooltip: { ...baseOpts.plugins.tooltip,
            callbacks: { label: (ctx: any) => `${this.fmt(Number(ctx.parsed.y))}${unit ? ' ' + unit : ''}` } } },
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
