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

  buildConfig(overrideType?: 'bar' | 'line' | 'doughnut'): GraphConfig | undefined {
    const c = this.card;
    if (!c.labels?.length || !c.datasets?.length) return undefined;
    const hex = this.accent;
    const type = overrideType ?? this.forceType ?? (c.chartType as any) ?? 'bar';
    const full = this.size === 'full';

    const axisStyle = {
      grid: { color: 'rgba(0,0,0,0.05)', drawBorder: false },
      ticks: { font: { size: 11 }, color: '#888', maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
    };
    const baseOpts: any = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: full ? 500 : 0 },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: full },
      },
    };

    if (type === 'line') {
      return {
        type: 'line',
        data: {
          labels: c.labels,
          datasets: [{ label: c.datasets[0].label || c.metric?.unit || '', data: c.datasets[0].data, borderColor: hex, backgroundColor: hex + '22', borderWidth: 2.5, fill: true, tension: 0.4, pointRadius: full ? 3 : 0 }],
        },
        options: {
          ...baseOpts,
          scales: {
            x: { display: full, ...axisStyle, title: { display: full && !!c.labels?.[0], text: '', font: { size: 10 }, color: '#aaa' } },
            y: { display: full, ...axisStyle, title: { display: full && !!c.metric?.unit, text: full ? (c.metric?.unit || '') : '', font: { size: 10 }, color: '#aaa' } },
          },
        },
      };
    }

    if (type === 'doughnut' || type === 'pie') {
      return {
        type: 'doughnut',
        data: { labels: c.labels, datasets: [{ label: '', data: c.datasets[0].data, backgroundColor: [...ACCENT_COLORS], borderWidth: 2, borderColor: '#fff' } as any] },
        options: { ...baseOpts, cutout: '55%', plugins: { ...baseOpts.plugins, legend: { display: full, position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12 } } } },
      };
    }

    return {
      type: 'bar',
      data: {
        labels: c.labels,
        datasets: [{ label: c.datasets[0].label || c.metric?.unit || '', data: c.datasets[0].data, backgroundColor: hex + 'CC', borderWidth: 0, borderRadius: 4 } as any],
      },
      options: {
        ...baseOpts,
        scales: {
          x: { display: full, ...axisStyle },
          y: { display: full, ...axisStyle, title: { display: full && !!c.metric?.unit, text: full ? (c.metric?.unit || '') : '', font: { size: 10 }, color: '#aaa' } },
        },
      },
    };
  }
}
