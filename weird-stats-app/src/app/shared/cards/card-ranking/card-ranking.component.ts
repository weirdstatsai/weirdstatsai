import { Component, Input, OnChanges } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { getAnimalSvg } from '../../animal-icons';
import { WeirdCard, CardRow, ACCENT_COLORS } from '../../../models/weird-card.model';
import { rowsHaveMetric } from '../../card-data.util';

export type RankStyle = 'bars' | 'pill' | 'percent' | 'vertical' | 'circular' | 'sparkline' | 'list';

const RANK_LABELS: Record<string, string> = {
  bars: 'Bars', pill: 'Value pill', percent: 'Percentage',
  vertical: 'Vertical', circular: 'Circular', sparkline: 'Sparkline', list: 'List',
};

/**
 * Data-gated ranking styles, mirroring `kpiAltStylesFor`. When the rows carry no
 * real metric (a curated "top X" list), the ONLY honest style is a plain ordered
 * list — the numeric styles (bars/gauges) would render empty. When there is a
 * real metric, every relative style works, plus List as a minimalist option.
 * `CardRankingComponent.effStyle` enforces the same gate at render time.
 */
export function rankAltStylesFor(card: WeirdCard | undefined): Array<{ key: RankStyle; label: string }> {
  const listOpt = { key: 'list' as RankStyle, label: 'List' };
  if (!rowsHaveMetric(card)) return [listOpt];
  const keys = card?.uiMeta?.rankStyles?.length
    ? card.uiMeta.rankStyles : ['pill', 'percent', 'vertical', 'circular'];
  const numeric = keys
    .filter(s => RANK_LABELS[s] && s !== 'list')
    .map(s => ({ key: s as RankStyle, label: RANK_LABELS[s] }));
  return [...numeric, listOpt];
}

@Component({
  selector: 'app-card-ranking',
  templateUrl: './card-ranking.component.html',
  styleUrls: ['./card-ranking.component.scss'],
})
export class CardRankingComponent implements OnChanges {
  @Input() card!: WeirdCard;
  @Input() size: 'feed' | 'full' | 'alt' = 'feed';
  @Input() rankStyle: RankStyle = 'bars';

  accent = '#6C5CE7';
  gradFrom = '#f5f3ff';
  gradTo   = '#ffffff';

  constructor(private sanitizer: DomSanitizer) {}

  get bgSvg(): SafeHtml | null {
    const svg = getAnimalSvg(this.card?.uiMeta?.icon ?? '');
    return svg ? this.sanitizer.bypassSecurityTrustHtml(svg) : null;
  }

  ngOnChanges(): void {
    const h = (this.card?.uiMeta?.accentColor ?? '').trim();
    this.accent   = (ACCENT_COLORS as readonly string[]).includes(h) ? h : ACCENT_COLORS[0];
    this.gradFrom = this.card?.uiMeta?.gradientFrom || '#f5f3ff';
    this.gradTo   = this.card?.uiMeta?.gradientTo   || '#ffffff';
  }

  /** The style actually rendered. A numeric style is downgraded to a plain
   *  ordered list when the rows have no real metric (all-zero / no variance),
   *  so a curated "top X" list never shows empty bars or 0% gauges. */
  get effStyle(): RankStyle {
    if (this.rankStyle === 'list') return 'list';
    return rowsHaveMetric(this.card) ? this.rankStyle : 'list';
  }

  get rows(): CardRow[] {
    return (this.card.rows ?? []).slice(0, this.size === 'full' ? 10 : 5);
  }

  get hasRows(): boolean {
    return this.rows.length > 0;
  }

  private get maxVal(): number {
    return Math.max(...(this.card.rows ?? []).map(r => r.value), 1);
  }

  get maxValPub(): number { return this.maxVal; }

  fmt(v: number): string {
    if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
    if (Math.abs(v) >= 1_000) return (v / 1_000).toFixed(1) + 'K';
    return Number.isInteger(v) ? v.toString() : v.toFixed(1);
  }

  barWidth(row: CardRow): number {
    return Math.round((row.value / this.maxVal) * 85);
  }

  pct(row: CardRow): number {
    return Math.round((row.value / this.maxVal) * 100);
  }

  /** Vertical bar height as % of column area */
  colHeight(row: CardRow): number {
    return Math.round((row.value / this.maxVal) * 100);
  }

  /** SVG circular ring capped at 85% so max never fully closes */
  ringDash(row: CardRow): string {
    const c = 2 * Math.PI * 22;
    const fill = c * (this.barWidth(row) / 100);
    return `${fill.toFixed(1)} ${c.toFixed(1)}`;
  }

  /** Simple sparkline SVG path from row values */
  sparkPath(index: number): string {
    const allRows = this.rows;
    if (allRows.length < 2) return '';
    const max = this.maxVal;
    const w = 48; const h = 24;
    const points = allRows.map((r, i) => {
      const x = (i / (allRows.length - 1)) * w;
      const y = h - (r.value / max) * h * 0.8;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    // Highlight current row point with a slightly different curve
    return `M ${points.join(' L ')}`;
  }
}
