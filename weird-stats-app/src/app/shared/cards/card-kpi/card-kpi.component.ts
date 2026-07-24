import { Component, Input, OnChanges } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { getAnimalSvg } from '../../animal-icons';
import { WeirdCard, ACCENT_COLORS, gradientForAccent } from '../../../models/weird-card.model';

export type KpiStyle =
  | 'default' | 'circular' | 'comparison' | 'hero'          // classic: present the number
  | 'sparkline' | 'progress' | 'gauge' | 'delta';           // data-gated: add context

/**
 * Data-gated list of KPI styles a card can honestly render — the single source
 * of truth for every alternatives picker (card-detail, profile). A style is
 * only offered when the data it visualizes actually exists:
 *   sparkline              → a real series (≥3 points)
 *   progress/gauge/circular→ a genuine 0–100 % value
 *   comparison/delta       → a genuine second value (rows[1])
 * CardKpiComponent.effStyle enforces the same gates at render time.
 */
export function kpiAltStylesFor(card: WeirdCard | undefined): Array<{ key: KpiStyle; label: string }> {
  const styles: Array<{ key: KpiStyle; label: string }> = [
    { key: 'default', label: 'Default' },
  ];

  const series = (card?.datasets?.[0]?.data ?? [])
    .filter(v => typeof v === 'number' && !isNaN(v as number));
  if (series.length >= 3) styles.push({ key: 'sparkline', label: 'Sparkline' });

  const unit = (card?.metric?.unit || card?.rows?.[0]?.unit || '').trim();
  const val = card?.metric?.value ?? card?.rows?.[0]?.value;
  if (unit === '%' && val != null && val >= 0 && val <= 100) {
    styles.push(
      { key: 'progress', label: 'Progress' },
      { key: 'gauge',    label: 'Gauge' },
      { key: 'circular', label: 'Circular' },
    );
  }

  if (card?.rows?.[1]?.value != null) {
    styles.push(
      { key: 'comparison', label: 'Comparison' },
      { key: 'delta',      label: 'Delta' },
    );
  }

  styles.push({ key: 'hero', label: 'Hero' });
  return styles;
}

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
    const grad = gradientForAccent(this.accent);
    this.gradFrom = grad.from;
    this.gradTo   = grad.to;
  }

  /** Coerce to a FINITE number or null. Cards come from an LLM + Firestore, so
   *  a value slot can hold NaN, Infinity, or a numeric string — none of which
   *  may ever reach the UI as text ("NaN%", "InfinityT"). Every getter that
   *  feeds the template goes through this. */
  private num(v: unknown): number | null {
    const n = typeof v === 'string' ? parseFloat(v) : (v as number);
    return typeof n === 'number' && isFinite(n) ? n : null;
  }

  get displayValue(): string {
    const v = this.num(this.card?.metric?.value) ?? this.num(this.card?.rows?.[0]?.value);
    return v == null ? '—' : this.fmt(v);
  }

  /** The metric unit, trimmed ('' when none). */
  get unit(): string {
    return (this.card?.metric?.unit || '').trim();
  }

  /** A short unit ("g", "%", "in", "kg") rides the number as a small suffix
   *  (4·g). A long one ("kg/person/year") won't fit inline, so it drops to its
   *  own line — display what fits, keep the structure. */
  get shortUnit(): boolean {
    const u = this.unit;
    return u.length > 0 && u.length <= 5;
  }

  /** True only when the data carries a real, finite second value. */
  get hasBenchmark(): boolean {
    return this.num(this.card?.rows?.[1]?.value) != null;
  }

  /** Benchmark value — ONLY from a genuine second row. Never fabricated. */
  get compValue(): string {
    const b = this.num(this.card?.rows?.[1]?.value);
    return b == null ? '' : this.fmt(b);
  }

  get compLabel(): string {
    return this.card?.rows?.[1]?.label || '';
  }

  get diffPct(): number {
    const comp = this.num(this.card?.rows?.[1]?.value);
    const main = this.num(this.card?.metric?.value) ?? this.num(this.card?.rows?.[0]?.value);
    if (comp == null || main == null || !comp || comp === main) return 0;
    const pct = Math.round(((main - comp) / comp) * 100);
    return isFinite(pct) ? pct : 0;
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

  /** SVG ring dash for circular style. Circular is offered only for genuine
   *  0–100 % values (see kpiAltStylesFor), so the sweep is the value itself —
   *  an honest proportion, not the old decorative fixed 85%. Non-percent
   *  values (legacy persisted picks) keep a neutral 85% sweep. */
  get ringDash(): string {
    const c = 2 * Math.PI * 30;
    const frac = this.isPercent ? this.progressPct / 100 : 0.85;
    return `${(c * frac).toFixed(1)} ${(c + 1).toFixed(1)}`;
  }

  fmt(v: number): string {
    if (!isFinite(v)) return '—';   // belt-and-suspenders: never print NaN/Infinity
    const a = Math.abs(v);
    if (a >= 1_000_000_000_000) return (v / 1_000_000_000_000).toFixed(a >= 1e13 ? 0 : 1) + 'T';
    if (a >= 1_000_000_000) return (v / 1_000_000_000).toFixed(a >= 1e10 ? 0 : 1) + 'B';
    if (a >= 1_000_000) return (v / 1_000_000).toFixed(a >= 1e7 ? 0 : 1) + 'M';
    if (a >= 1_000) return (v / 1_000).toFixed(a >= 10_000 ? 0 : 1) + 'K';
    return v.toLocaleString();
  }

  // ── Data gates + geometry for the context styles ──────────────────────────
  // Each new style only renders when the card's data can honestly support it;
  // the same predicates drive which alternatives the detail page offers.

  /** The KPI's primary numeric value (mirrors displayValue's source chain).
   *  Always finite or null — junk (NaN/Infinity/strings) never drives
   *  geometry like the gauge sweep or progress width. */
  get numericValue(): number | null {
    return this.num(this.card?.metric?.value) ?? this.num(this.card?.rows?.[0]?.value);
  }

  /** Numeric series behind the KPI — present when research carried a trend. */
  get series(): number[] {
    return (this.card?.datasets?.[0]?.data ?? [])
      .filter((v): v is number => typeof v === 'number' && !isNaN(v));
  }

  /** sparkline gate: a real trend needs at least 3 points. */
  get hasSeries(): boolean { return this.series.length >= 3; }

  /** progress/gauge gate: a genuine share of a 0–100% whole. */
  get isPercent(): boolean {
    const u = (this.card?.metric?.unit || this.card?.rows?.[0]?.unit || '').trim();
    const v = this.numericValue;
    return u === '%' && v != null && v >= 0 && v <= 100;
  }

  get progressPct(): number {
    return Math.max(0, Math.min(100, this.numericValue ?? 0));
  }

  /** Sparkline polyline, normalized into a 100×32 viewBox (2px padding). */
  get sparkPoints(): string {
    const d = this.series;
    if (d.length < 2) return '';
    const min = Math.min(...d), max = Math.max(...d);
    const span = max - min || 1;
    const stepX = 100 / (d.length - 1);
    return d
      .map((v, i) => `${(i * stepX).toFixed(1)},${(2 + (1 - (v - min) / span) * 28).toFixed(1)}`)
      .join(' ');
  }

  /** End dot of the sparkline (the "now" point). */
  get sparkEnd(): { x: number; y: number } {
    const pts = this.sparkPoints.split(' ');
    const last = pts[pts.length - 1]?.split(',');
    return last?.length === 2 ? { x: +last[0], y: +last[1] } : { x: 100, y: 16 };
  }

  /** First/last x labels for the sparkline range, when the card has them. */
  get sparkRange(): [string, string] | null {
    const l = this.card?.labels ?? [];
    return l.length >= 2 ? [String(l[0]), String(l[l.length - 1])] : null;
  }

  /** Gauge arc stroke-dasharray — semicircle r=42 scaled by progressPct. */
  get gaugeDash(): string {
    const len = Math.PI * 42;
    return `${((this.progressPct / 100) * len).toFixed(1)} ${(len + 10).toFixed(1)}`;
  }

  /** Arc length of the value sweep — drives the entry animation (the dial
   *  sweeps from 0 to the value by animating stroke-dashoffset to 0). */
  get gaugeSweep(): string {
    return ((this.progressPct / 100) * Math.PI * 42).toFixed(1) + 'px';
  }

  /** Tip of the gauge arc — the indicator dot rides the semicircle's end. */
  get gaugeTip(): { x: number; y: number } {
    const a = Math.PI * (1 - this.progressPct / 100);
    return {
      x: +(50 + 42 * Math.cos(a)).toFixed(1),
      y: +(52 - 42 * Math.sin(a)).toFixed(1),
    };
  }

  /** Light tint of the accent — the soft end of the gauge's gradient. Kept
   *  fairly saturated (25% white) so it stays visible on warm card washes. */
  get accentSoft(): string {
    const r = parseInt(this.accent.slice(1, 3), 16);
    const g = parseInt(this.accent.slice(3, 5), 16);
    const b = parseInt(this.accent.slice(5, 7), 16);
    const mix = (c: number) => Math.round(c + (255 - c) * 0.25);
    return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
  }

  /** Unique per-instance gradient id. Sharing one id across instances broke
   *  the arc: url(#id) can resolve to a duplicate <defs> inside a hidden
   *  Ionic page, and a paint server in a display:none subtree renders as
   *  nothing — the arc simply vanished. Instance-scoped ids can't collide. */
  private static _uid = 0;
  readonly gaugeGradId = 'gaugeGrad' + (++CardKpiComponent._uid);

  /** The style that actually renders. A selected style whose data requirement
   *  isn't met (stale persisted pick, alt preview on a thin card) demotes to
   *  'default' instead of rendering an empty card. */
  get effStyle(): KpiStyle {
    const s = this.kpiStyle;
    if (s === 'sparkline' && !this.hasSeries) return 'default';
    if ((s === 'progress' || s === 'gauge') && !this.isPercent) return 'default';
    if ((s === 'comparison' || s === 'delta') && !this.hasBenchmark) return 'default';
    return s;
  }
}
