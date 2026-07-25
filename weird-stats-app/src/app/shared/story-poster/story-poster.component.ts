import { Component, Input, OnChanges } from '@angular/core';
import { WeirdCard } from '../../models/weird-card.model';
import { fmtNum } from '../story-card/story-view';
import { rowsHaveMetric } from '../card-data.util';

export type PosterDesign = 'editorial' | 'cover' | 'split';

export interface StoryPreset {
  design: PosterDesign;
  title: string; quip: string; emoji?: string; caption?: string;
  bars?: Array<{ label: string; value: string; pct: number }>;
  statValue?: string; statLabel?: string;
  donutPct?: number; donutLabel?: string; donutDeg?: string;
}

/** The three hand-authored Home story cards, verbatim from home.page.html.
 *  Rendered wherever their card appears — feed tiles, detail hero, share PNG,
 *  OG image — so the pretty Home design is what shows everywhere for these. */
export const STORY_PRESETS: ReadonlyArray<{ match: RegExp; preset: StoryPreset }> = [
  { match: /mosquito/i, preset: {
      design: 'editorial',
      title: 'Mosquitoes kill more humans than sharks every year',
      quip: 'Yep. Tiny, annoying, deadly.', emoji: '🦟',
      caption: 'Deaths per year (estimated)',
      bars: [
        { label: 'Mosquito', value: '725K+', pct: 100 },
        { label: 'Human',    value: '475K+', pct: 66 },
        { label: 'Snake',    value: '50K+',  pct: 12 },
        { label: 'Shark',    value: '10K+',  pct: 4 },
      ],
  } },
  { match: /old age|age-related/i, preset: {
      design: 'cover',
      title: 'Only 11% of everyone who ever lived died of old age',
      quip: "You're part of a very lucky 1 in 12.", emoji: '🌍',
      statValue: '1 in 12', statLabel: 'lived to grow old',
  } },
  { match: /freshwater|drinkable/i, preset: {
      design: 'split',
      title: "Only about 2% of Earth's water is drinkable",
      quip: 'Most of the blue planet, off the menu.',
      donutPct: 2, donutDeg: '30deg', donutLabel: 'freshwater accessible',
  } },
];

/** The Home-design preset for a card, or null if it isn't one of the three. */
export function presetForCard(card: { title?: string } | undefined): StoryPreset | null {
  const t = card?.title || '';
  return STORY_PRESETS.find(p => p.match.test(t))?.preset ?? null;
}

/**
 * The three hand-designed "Today's weird stories" treatments, rebuilt as a real
 * component so the SAME cards can be opened and SHARED (detail hero + share PNG
 * + OG image), not just admired on Home.
 *
 * The markup and styles are the Home deck's, unchanged — only the content is
 * data-driven instead of hardcoded:
 *   editorial — headline + labelled stat bars + subject emoji  (the mosquito card)
 *   cover     — full-bleed emoji + one big stat                (the 11% card)
 *   split     — text left, donut panel right                   (the 2% water card)
 */
@Component({
  selector: 'app-story-poster',
  templateUrl: './story-poster.component.html',
  styleUrls: ['./story-poster.component.scss'],
})
export class StoryPosterComponent implements OnChanges {
  @Input() card!: WeirdCard;
  /** Force a treatment; omitted = picked from the card's own data. */
  @Input() design?: PosterDesign;
  /** Render this content VERBATIM instead of deriving it from the card — used to
   *  reproduce a hand-authored Home story card exactly on the detail page. */
  @Input() preset?: {
    design: PosterDesign;
    title: string; quip: string; emoji?: string; caption?: string;
    bars?: Array<{ label: string; value: string; pct: number }>;
    statValue?: string; statLabel?: string;
    donutPct?: number; donutLabel?: string; donutDeg?: string;
  };

  eff: PosterDesign = 'cover';
  title = '';
  quip = '';
  emoji = '';
  bars: Array<{ label: string; value: string; pct: number }> = [];
  caption = '';
  statValue = '';
  statLabel = '';
  donutPct = 0;
  donutLabel = '';

  ngOnChanges(): void {
    if (this.preset) {
      const p = this.preset;
      this.eff = this.design ?? p.design;
      this.title = p.title;
      this.quip = p.quip;
      this.emoji = p.emoji ?? '';
      this.bars = p.bars ?? [];
      this.caption = p.caption ?? '';
      this.statValue = p.statValue ?? '';
      this.statLabel = p.statLabel ?? '';
      this.donutPct = p.donutPct ?? 0;
      this.donutLabel = p.donutLabel ?? '';
      this.presetDeg = p.donutDeg;
      return;
    }
    this.presetDeg = undefined;
    const c = this.card;
    const ui: any = c?.uiMeta ?? {};
    const rows = (c?.rows ?? []).filter(r => r && String(r.label ?? '').trim());
    const unit = (c?.metric?.unit || rows[0]?.unit || '').trim();
    const value = c?.metric?.value ?? rows[0]?.value ?? null;
    const num = value == null ? NaN : Number(value);
    const isPct = unit === '%' && isFinite(num) && num >= 0 && num <= 100;

    this.eff = this.design ?? (
      rows.length >= 2 && rowsHaveMetric(c) ? 'editorial' : isPct ? 'split' : 'cover'
    );

    this.title = (c?.title || '').replace(/^[\s\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]+/u, '').trim();
    this.quip = (c?.insight || '').split(/(?<=[.!?])\s/)[0]?.slice(0, 90) ?? '';
    this.emoji = ui.icon || '';

    // editorial — top rows as labelled bars
    const max = Math.max(...rows.map(r => Number(r.value) || 0), 1);
    this.bars = rows.slice(0, 4).map(r => ({
      label: r.label,
      value: fmtNum(Number(r.value)),
      pct: Math.max(4, Math.round(((Number(r.value) || 0) / max) * 100)),
    }));
    this.caption = (c?.metric?.name || '').trim() || unit;

    // cover — one big stat
    this.statValue = fmtNum(num);
    this.statLabel = (c?.metric?.name || rows[0]?.label || '').trim();

    // split — donut
    this.donutPct = isPct ? num : 0;
    this.donutLabel = this.statLabel;
  }

  /** Conic-gradient sweep for the split donut. */
  private presetDeg?: string;
  get donutDeg(): string {
    return this.presetDeg ?? `${Math.round((this.donutPct / 100) * 360)}deg`;
  }
}
