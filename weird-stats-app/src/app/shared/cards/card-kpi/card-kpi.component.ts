import { Component, Input, OnChanges } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { getAnimalSvg } from '../../animal-icons';
import { WeirdCard, ACCENT_COLORS } from '../../../models/weird-card.model';

export type KpiStyle = 'default' | 'circular' | 'comparison' | 'hero';

@Component({
  selector: 'app-card-kpi',
  templateUrl: './card-kpi.component.html',
  styleUrls: ['./card-kpi.component.scss'],
})
export class CardKpiComponent implements OnChanges {
  @Input() card!: WeirdCard;
  @Input() size: 'feed' | 'full' | 'alt' = 'feed';
  @Input() kpiStyle: KpiStyle = 'default';

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

  get displayValue(): string {
    const v = this.card.metric?.value;
    if (v != null) return this.fmt(v);
    return this.card.rows?.[0]?.value != null ? this.fmt(this.card.rows[0].value) : '—';
  }

  /** True only when the data carries a real second value to compare against. */
  get hasBenchmark(): boolean {
    return this.card?.rows?.[1]?.value != null;
  }

  /** Benchmark value — ONLY from a genuine second row. Never fabricated. */
  get compValue(): string {
    return this.hasBenchmark ? this.fmt(this.card.rows![1].value) : '';
  }

  get compLabel(): string {
    return this.card?.rows?.[1]?.label || '';
  }

  get diffPct(): number {
    if (!this.hasBenchmark) return 0;
    const main = this.card.metric?.value ?? this.card.rows?.[0]?.value ?? 0;
    const comp = this.card.rows![1].value;
    if (!comp || comp === main) return 0;
    return Math.round(((main - comp) / comp) * 100);
  }

  /** Magnitude only — the arrow already carries direction. */
  get absDiffPct(): number {
    return Math.abs(this.diffPct);
  }

  /** A plain-English benchmark line, e.g. "up from 1,114 (30 years ago)". */
  get compSummary(): string {
    if (!this.hasBenchmark) return '';
    const dir = this.diffPct >= 0 ? 'up from' : 'down from';
    const ctx = this.compLabel ? ` (${this.compLabel})` : '';
    return `${dir} ${this.compValue}${ctx}`;
  }

  /** SVG ring dash for circular style — capped at 85% */
  get ringDash(): string {
    const c = 2 * Math.PI * 30;
    return `${(c * 0.85).toFixed(1)} ${c.toFixed(1)}`;
  }

  fmt(v: number): string {
    if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
    if (Math.abs(v) >= 1_000) return (v / 1_000).toFixed(v >= 10_000 ? 0 : 1) + 'K';
    return v.toLocaleString();
  }
}
