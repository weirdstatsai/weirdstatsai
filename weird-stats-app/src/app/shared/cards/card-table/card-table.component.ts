import { Component, Input, OnChanges } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { getAnimalSvg } from '../../animal-icons';
import { WeirdCard, CardRow, ACCENT_COLORS } from '../../../models/weird-card.model';

export type TableStyle = 'pill' | 'bars' | 'rows';

@Component({
  selector: 'app-card-table',
  templateUrl: './card-table.component.html',
  styleUrls: ['./card-table.component.scss'],
})
export class CardTableComponent implements OnChanges {
  @Input() card!: WeirdCard;
  @Input() size: 'feed' | 'full' | 'alt' = 'feed';
  @Input() tableStyle: TableStyle = 'pill';

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

  get rows(): CardRow[] {
    const limit = this.size === 'full' ? 25 : this.size === 'alt' ? 3 : 5;
    return (this.card.rows ?? []).slice(0, limit);
  }

  get hasRows(): boolean {
    return this.rows.length > 0;
  }

  fmt(v: number): string {
    if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
    if (Math.abs(v) >= 1_000) return (v / 1_000).toFixed(v >= 10_000 ? 0 : 1) + 'K';
    return v.toLocaleString();
  }

  barWidth(row: CardRow): number {
    const max = Math.max(...(this.card.rows ?? []).map(r => r.value), 1);
    return Math.round((row.value / max) * 85);
  }
}
