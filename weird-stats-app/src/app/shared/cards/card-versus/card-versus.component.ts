import { Component, Input, OnChanges } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { getAnimalSvg } from '../../animal-icons';
import { WeirdCard, CardRow, ACCENT_COLORS } from '../../../models/weird-card.model';

const ACCENT_B_MAP: Record<string, string> = {
  '#6C5CE7': '#D85A30',
  '#378ADD': '#BA7517',
  '#1D9E75': '#D85A30',
  '#D85A30': '#6C5CE7',
  '#BA7517': '#378ADD',
};

export type VersusStyle = 'default' | 'mirror' | 'progress' | 'winner';

@Component({
  selector: 'app-card-versus',
  templateUrl: './card-versus.component.html',
  styleUrls: ['./card-versus.component.scss'],
})
export class CardVersusComponent implements OnChanges {
  @Input() card!: WeirdCard;
  @Input() size: 'feed' | 'full' | 'alt' = 'feed';
  @Input() versusStyle: VersusStyle = 'default';

  accent  = '#6C5CE7';
  accentB = '#D85A30';
  gradFrom = '#f5f3ff';
  gradTo   = '#ffffff';

  constructor(private sanitizer: DomSanitizer) {}

  get bgSvg(): SafeHtml | null {
    const svg = getAnimalSvg(this.card?.uiMeta?.icon ?? '');
    return svg ? this.sanitizer.bypassSecurityTrustHtml(svg) : null;
  }
  pair: CardRow[] = [];

  ngOnChanges(): void {
    const h = (this.card?.uiMeta?.accentColor ?? '').trim();
    this.accent   = (ACCENT_COLORS as readonly string[]).includes(h) ? h : ACCENT_COLORS[0];
    this.accentB  = ACCENT_B_MAP[this.accent] ?? '#D85A30';
    this.gradFrom = this.card?.uiMeta?.gradientFrom || '#f5f3ff';
    this.gradTo   = this.card?.uiMeta?.gradientTo   || '#ffffff';
    this.pair    = (this.card.rows ?? []).slice(0, 2);
  }

  /** Emojis pulled from the title (e.g. "Chicken vs Beef 🥩🍗") — first two
   *  become the side illustrations; initials are the fallback. */
  get sideEmojis(): [string | null, string | null] {
    const title = this.card?.title ?? '';
    const matches = title.match(/\p{Extended_Pictographic}(?:️)?(?:‍\p{Extended_Pictographic}(?:️)?)*/gu) ?? [];
    if (matches.length >= 2) return [matches[0] ?? null, matches[1] ?? null];
    return [null, null];
  }

  initials(label: string | undefined): string {
    return (label ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0].toUpperCase())
      .join('');
  }

  fmt(v: number): string {
    if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
    if (Math.abs(v) >= 1_000) return (v / 1_000).toFixed(v >= 10_000 ? 0 : 1) + 'K';
    return Number.isInteger(v) ? v.toString() : v.toFixed(1);
  }

  get pctA(): number {
    const total = (this.pair[0]?.value ?? 0) + (this.pair[1]?.value ?? 0);
    return total ? Math.round((this.pair[0].value / total) * 100) : 50;
  }

  get pctB(): number { return 100 - this.pctA; }

  get winner(): CardRow | null {
    if (this.pair.length < 2) return null;
    return this.pair[0].value >= this.pair[1].value ? this.pair[0] : this.pair[1];
  }

  get delta(): number {
    if (this.pair.length < 2) return 0;
    return Math.abs(this.pair[0].value - this.pair[1].value);
  }
}
