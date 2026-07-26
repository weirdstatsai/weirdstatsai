import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { WeirdCard, CardSurface, cardSurfaceOf, premiumGradientForAccent, solidColorForAccent, inkColorForAccent } from '../../models/weird-card.model';
import { GraphConfig } from '../../models/graph.model';
import { buildStoryView, StoryView, StoryVariant, asStoryVariant, fmtNum } from './story-view';

/** Light/pastel segment palette for doughnuts on the dark premium frame. */
const PREMIUM_PIE = ['#ffffff', '#ffd27a', '#7ad0ff', '#8fe3b0', '#f4a3c9', '#c3b4f7', '#ffb08a'];
/** Saturated segment palette for doughnuts on the PLAIN (white) surface, where
 *  the light PREMIUM_PIE tones would wash out. */
const LIGHT_PIE = ['#6C5CE7', '#378ADD', '#1D9E75', '#D85A30', '#BA7517', '#8e7bf0', '#5aa9e6'];

/**
 * The premium "story card" — one data-driven component that renders any
 * `WeirdCard` in a vibrant dark treatment chosen by card type (see
 * `buildStoryView`). Used in the Explore feed and the card-detail hero.
 */
@Component({
  selector: 'app-story-card',
  templateUrl: './story-card.component.html',
  styleUrls: ['./story-card.component.scss'],
})
export class StoryCardComponent implements OnChanges {
  @Input() card!: WeirdCard;
  /** 'alt' = style-preview thumbnail; renders exactly like 'feed' (alt mirrors feed). */
  @Input() size: 'feed' | 'full' | 'alt' = 'feed';
  /** Explicit premium variant — used by the Alternatives thumbnails to preview
   *  each option. When unset, the owner's persisted pick (uiMeta.selectedStyle,
   *  'story-*' keys) applies automatically on EVERY surface: hero, feed tiles,
   *  captures, share page. Legacy light-card style keys are ignored (auto). */
  @Input() variant?: StoryVariant;
  /** Full chrome (quip + CTA) with TILE-density data: fewer bars/rows and a
   *  shorter chart. For fixed short frames like the Home stories deck, where
   *  the full 8-bar / 12-row / 220px-chart treatments would overflow and clip. */
  @Input() compact = false;
  /** Always paint the premium gradient regardless of the card's own
   *  `uiMeta.useGradient` — for curated showcase surfaces (the Home deck) and
   *  the edit panel's gradient preview. */
  @Input() forceGradient = false;
  /** "See the full story" CTA tapped. Live views wire this (card-detail scrolls
   *  to the story block); offscreen capture frames leave it unbound — there the
   *  button is a visual invitation to open the shared link. */
  @Output() storyCta = new EventEmitter<void>();

  view!: StoryView;
  accent = '#6C5CE7';
  pgFrom = '#241241';
  pgMid = '#3a2168';
  pgTo = '#6d3b8e';
  pgGlow = 'rgba(233,120,88,0.55)';
  /** Flat colour used when this card isn't on the premium gradient. */
  pgSolid = '#3a2168';
  /** Accent darkened enough to read as a spot colour on the white plate. */
  inkAccent = '#6C5CE7';
  /** Which background treatment this card paints. Same design in all three —
   *  only the colouring differs (see CardSurface). */
  surface: CardSurface = 'plain';
  chartConfig?: GraphConfig;

  ngOnChanges(): void {
    const v = this.variant ?? asStoryVariant(this.card?.uiMeta?.selectedStyle);
    // compact => build at tile density even though the chrome stays 'full'.
    const density = (this.size === 'full' && !this.compact) ? 'full' : 'feed';
    this.view = buildStoryView(this.card, density, v);
    this.accent = this.view.accent;
    const g = premiumGradientForAccent(this.accent);
    this.pgFrom = g.from;
    this.pgMid = g.mid;
    this.pgTo = g.to;
    this.pgGlow = g.glow;
    this.pgSolid = solidColorForAccent(this.accent);
    this.inkAccent = inkColorForAccent(this.accent);
    // Colouring is the ONLY difference between the three surfaces (and the only
    // premium gate): plain white by default, the basic accent colour when the
    // owner picks one, the gradient when a premium member opts in. Structure,
    // layout and chrome are identical in all three.
    this.surface = this.forceGradient ? 'gradient' : cardSurfaceOf(this.card?.uiMeta);
    this.chartConfig = this.view.treatment === 'chart' ? this.buildChartConfig() : undefined;
  }

  /** Chart canvas height. Compact (fixed short frames like the Home deck) gets
   *  the shortest viz — the chart treatment is the tallest one, and it has to
   *  share the frame with the title, quip and CTA. */
  get chartHeight(): number {
    if (this.compact) return 104;
    return this.size === 'full' ? 220 : 148;
  }

  /** SVG ring dash for the cover-donut (pathLength=100, so dash = pct of ring). */
  get ringDash(): string {
    const pct = Math.max(0, Math.min(100, this.view?.donut?.pct ?? 0));
    return `${pct} 100`;
  }

  /** A Chart.js config tuned for light-on-dark: white line/bars, accent glow +
   *  fill, light ticks/grid. Renders through the shared `app-chart`. */
  private buildChartConfig(): GraphConfig | undefined {
    const c = this.card;
    if (!c.labels?.length || !c.datasets?.length) return undefined;
    const hex = this.accent;
    const full = this.size === 'full' && !this.compact;
    const unit = c.metric?.unit || '';
    let type: any = c.chartType || 'bar';

    // A time series is never "parts of a whole" — coerce a mis-tagged pie/doughnut
    // of yearly values into a line so it renders with real axes.
    const yearish = (c.labels || []).filter(l => /(1[6-9]\d{2}|2[0-1]\d{2})/.test(String(l))).length;
    if ((type === 'doughnut' || type === 'pie') && yearish >= Math.ceil((c.labels?.length || 1) * 0.6)) type = 'line';

    // On the plain (white) surface the white-on-dark chart palette would be
    // invisible — draw with the accent on dark ticks instead.
    const plain = this.surface === 'plain';
    const ink = plain ? hex : '#ffffff';
    const light = plain ? 'rgba(20,22,45,0.55)' : 'rgba(255,255,255,0.6)';
    const grid = plain ? 'rgba(20,22,45,0.10)' : 'rgba(255,255,255,0.12)';
    const fmt = (v: unknown) => fmtNum(Number(v));

    const baseOpts: any = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 0 },
      layout: { padding: { top: full ? 12 : 8, right: 6, bottom: 0, left: 0 } },
      plugins: {
        legend: {
          display: (type === 'doughnut' || type === 'pie') && full,
          position: 'bottom',
          labels: { color: light, font: { size: 11 }, boxWidth: 10, boxHeight: 10, padding: 12, usePointStyle: true, pointStyle: 'circle' },
        },
        valueLabels: { enabled: false },   // light axes carry the numbers on dark
        tooltip: { enabled: full, backgroundColor: 'rgba(20,16,40,0.94)', titleColor: '#fff', bodyColor: 'rgba(255,255,255,0.8)', borderColor: hex, borderWidth: 1, padding: 10, cornerRadius: 10, displayColors: false },
      },
    };

    const xScale = {
      display: true,
      grid: { display: false, drawBorder: false },
      border: { display: false },
      ticks: { color: light, font: { size: full ? 11 : 10, weight: '500' }, maxRotation: 0, autoSkip: true, maxTicksLimit: full ? 6 : 4, padding: 6 },
    };
    const yScale = {
      display: full,
      beginAtZero: type !== 'line',
      grace: '8%',
      grid: { color: grid, drawBorder: false, drawTicks: false },
      border: { display: false },
      ticks: { color: light, font: { size: 11 }, padding: 8, maxTicksLimit: 6, callback: fmt },
    };

    if (type === 'line') {
      return {
        type: 'line',
        data: {
          labels: c.labels,
          datasets: [{
            label: c.datasets[0].label || unit, data: c.datasets[0].data,
            borderColor: ink, backgroundColor: hex + (plain ? '24' : '59'), borderWidth: full ? 3 : 2.5,
            fill: true, tension: 0.42,
            pointRadius: full ? 3 : 0, pointHoverRadius: 5,
            pointBackgroundColor: plain ? hex : '#fff', pointBorderColor: plain ? '#fff' : hex, pointBorderWidth: 1.5,
          } as any],
        },
        options: {
          ...baseOpts,
          plugins: {
            ...baseOpts.plugins,
            lineGlow: { enabled: !plain, color: hex + 'cc', blur: full ? 16 : 10, offsetY: 3 },
            lineHead: { enabled: full, color: ink, radius: 5 },
          },
          scales: { x: xScale, y: yScale },
        },
      };
    }

    if (type === 'doughnut' || type === 'pie') {
      return {
        type: 'doughnut',
        data: { labels: c.labels, datasets: [{ data: c.datasets[0].data, backgroundColor: plain ? [...LIGHT_PIE] : [...PREMIUM_PIE], borderWidth: 2, borderColor: plain ? '#ffffff' : 'rgba(10,8,24,0.55)', hoverOffset: 6 } as any] },
        options: { ...baseOpts, cutout: '62%' },
      };
    }

    return {
      type: 'bar',
      data: {
        labels: c.labels,
        datasets: [{
          label: c.datasets[0].label || unit, data: c.datasets[0].data,
          backgroundColor: plain ? hex + 'D9' : 'rgba(255,255,255,0.88)', hoverBackgroundColor: ink,
          borderWidth: 0, borderRadius: 6, borderSkipped: false, barPercentage: 0.68, categoryPercentage: 0.72,
        } as any],
      },
      options: { ...baseOpts, scales: { x: xScale, y: yScale } },
    };
  }
}
