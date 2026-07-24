import { WeirdCard } from '../../models/weird-card.model';
import { rowsHaveMetric, cardHasData } from '../card-data.util';

/**
 * The premium "story card" is data-driven: `buildStoryView` distils any
 * `WeirdCard` into a normalized `StoryView` + a `treatment`, and the component
 * template just renders the treatment. Adding a new card type = one case here
 * and one template block — the premium chrome + theming are shared.
 */
export type Treatment =
  | 'cover'        // kpi — one hero number (or donut for %)
  | 'editorial'    // ranking — a few labelled bars
  | 'leaderboard'  // table — a denser bar list
  | 'duel'         // versus — two sides + split bar
  | 'statement'    // fact — a big typographic statement
  | 'chart'        // chart — premium frame around app-chart (light-on-dark)
  | 'atlas';       // map — country leaderboard (Phase 1)

// ── Premium alternatives ────────────────────────────────────────────────────
// A user-selectable spin on the auto treatment, persisted in
// uiMeta.selectedStyle (namespaced 'story-*' so legacy light-card style keys
// pass through harmlessly). Offered per card by `storyAltsFor`, honored by
// `buildStoryView(card, size, variant)`.
// One variant per TREATMENT, so every automatic treatment has an exact variant
// twin. That's what lets storyAltsFor's first entry always reproduce the auto
// render — a card the owner never edited looks identical on tiles (auto) and on
// the detail hero (seeded variant).
export type StoryVariant =
  | 'story-hero' | 'story-donut' | 'story-bars' | 'story-list'
  | 'story-leaderboard' | 'story-atlas' | 'story-duel' | 'story-chart' | 'story-statement';
const STORY_VARIANTS: readonly string[] = [
  'story-hero', 'story-donut', 'story-bars', 'story-list',
  'story-leaderboard', 'story-atlas', 'story-duel', 'story-chart', 'story-statement',
];

/** Narrow an arbitrary persisted selectedStyle to a story variant (or undefined). */
export function asStoryVariant(s: string | undefined | null): StoryVariant | undefined {
  return s && STORY_VARIANTS.includes(s) ? s as StoryVariant : undefined;
}

/** Rows with a real label — the ONLY row view any gate or renderer may use.
 *  (A blank-label placeholder row must never influence unit/value fallbacks.) */
function labelledRows(card: WeirdCard | undefined): any[] {
  return (card?.rows ?? []).filter(r => r && String(r.label ?? '').trim());
}

/** True for a kpi whose value can honestly render as a 0–100% donut.
 *  MUST mirror buildStoryView's donut gate exactly (same filtered rows, same
 *  null→NaN semantics) — the offer and the render may never disagree. */
function donutable(card: WeirdCard): boolean {
  const rows = labelledRows(card);
  const unit = (card?.metric?.unit || rows[0]?.unit || '').trim();
  const value = card?.metric?.value ?? rows[0]?.value ?? null;
  const num = value == null ? NaN : Number(value);
  return unit === '%' && isFinite(num) && num >= 0 && num <= 100;
}

/**
 * Data-gated premium alternatives, for EVERY card type — the premium card is
 * now the only card, so these replace the old per-type light-card styles.
 * The FIRST entry always matches what buildStoryView renders with no variant,
 * so it doubles as the default selection. Empty for hollow cards (no data →
 * nothing to restyle; legacy pre-gate drafts can still be data-less).
 */
export function storyAltsFor(card: WeirdCard | undefined): Array<{ key: StoryVariant; label: string }> {
  if (!card || !cardHasData(card) || card.cardType === 'map') return [];
  const rows = labelledRows(card);
  const metric = rowsHaveMetric(card);
  const alts: Array<{ key: StoryVariant; label: string }> = [];
  const add = (key: StoryVariant, label: string) => {
    if (!alts.some(a => a.key === key)) alts.push({ key, label });
  };

  switch (card.cardType) {
    case 'kpi':
      // Order matters: first entry must equal the auto pick (donut when the
      // value is a 0–100%, else the hero number).
      if (donutable(card)) add('story-donut', 'Donut');
      add('story-hero', 'Hero number');
      if (rows.length >= 2 && metric) add('story-bars', 'Bars');
      break;

    case 'ranking':
      if (metric) { add('story-bars', 'Bars'); add('story-list', 'Ranked list'); }
      else add('story-list', 'Ranked list');
      if (hasHeroValue(card, rows)) add('story-hero', 'Hero number');
      break;

    case 'table':
      if (metric) { add('story-leaderboard', 'Table'); add('story-list', 'Ranked list'); }
      else add('story-list', 'Ranked list');
      break;

    case 'versus':
      if (rows.length >= 2) add('story-duel', 'Head to head');
      if (rows.length >= 2 && metric) add('story-bars', 'Bars');
      break;

    case 'chart':
      if (card.labels?.length && card.datasets?.length) add('story-chart', 'Chart');
      if (rows.length >= 2 && metric) add('story-bars', 'Bars');
      if (hasHeroValue(card, rows)) add('story-hero', 'Hero number');
      break;
  }

  // Every card can fall back to the big typographic statement.
  add('story-statement', 'Statement');
  return alts;
}

export interface StoryBar { label: string; value: string; unit: string; pct: number; }
export interface StoryHero { value: string; unit: string; label: string; delta?: string; deltaUp?: boolean; }
export interface StoryDuelSide { label: string; value: string; emoji: string; }
export interface StoryDuel { a: StoryDuelSide; b: StoryDuelSide; pctA: number; winnerIdx: 0 | 1 | -1; unit: string; }
export interface StoryDonut { pct: number; label: string; }

export interface StoryView {
  treatment: Treatment;
  eyebrow: string;   // uiMeta.category
  title: string;     // headline (leading emoji stripped)
  quip: string;      // insight / supporting line
  emoji: string;     // uiMeta.icon (hero subject)
  accent: string;    // uiMeta.accentColor
  hasData: boolean;  // cardHasData — gate empty viz
  isList: boolean;   // ranking/table with no real metric → ordered list, no bars
  hero?: StoryHero;
  donut?: StoryDonut;
  bars?: StoryBar[];
  duel?: StoryDuel;
  card: WeirdCard;   // pass-through (chart → app-chart; fallbacks)
}

/** Compact K/M/B/T number formatter (mirrors card-chart's fmt). */
export function fmtNum(v: number | null | undefined): string {
  if (v == null || !isFinite(Number(v))) return '—';
  const n = Number(v);
  const a = Math.abs(n);
  if (a >= 1e12) return (n / 1e12).toFixed(a >= 1e13 ? 0 : 1) + 'T';
  if (a >= 1e9)  return (n / 1e9).toFixed(a >= 1e10 ? 0 : 1) + 'B';
  if (a >= 1e6)  return (n / 1e6).toFixed(a >= 1e7 ? 0 : 1) + 'M';
  if (a >= 1e3)  return (n / 1e3).toFixed(a >= 1e4 ? 0 : 1) + 'K';
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

const EMOJI_RE = /\p{Extended_Pictographic}/u;
const EMOJI_RE_G = /\p{Extended_Pictographic}/gu;

/** Strip a leading emoji (+ spaces) from a title, e.g. "🦟 Mosquitoes…" → "Mosquitoes…". */
function stripLeadingEmoji(s: string): string {
  return (s || '').replace(/^[\s\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]+/u, '').trim() || (s || '').trim();
}

/** First N emoji found anywhere in a string (for versus sides, e.g. "🥩 vs 🍗"). */
function firstEmojis(s: string, n: number): string[] {
  const out: string[] = [];
  const m = (s || '').match(EMOJI_RE_G);
  if (m) for (const e of m) { if (out.length >= n) break; if (EMOJI_RE.test(e)) out.push(e); }
  return out;
}

/** A short, punchy supporting line — the insight's first sentence, capped — so
 *  the hero stays clean (the full insight still shows in the detail's Story). */
/** Trailing text that looks like an abbreviation, not a sentence end —
 *  "…the U.S." , "…Dr." , "…approx." (single capitals + the common ones). */
const ABBR_TAIL = /(?:^|[\s(])(?:[A-Z]|[A-Z]\.[A-Z]|Mr|Mrs|Ms|Dr|Prof|St|Jr|Sr|Inc|Ltd|Co|Est|Fig|No|vs|etc|approx|e\.g|i\.e)$/;

function shortQuip(insight: string | undefined): string {
  const s = (insight || '').trim();
  if (!s) return '';
  // Take the first REAL sentence end. A candidate must be followed by
  // whitespace/end (so the '.' in "0.5%" doesn't cut the quip to "Only about
  // 0."), sit at least 20 chars in, and not be an abbreviation's dot
  // ("…the U.S." used to end the quip mid-sentence).
  let q = '';
  const re = /[.!?](?=\s|$)/g;
  for (let m = re.exec(s); m; m = re.exec(s)) {
    if (m.index + 1 < 20) continue;
    if (ABBR_TAIL.test(s.slice(0, m.index))) continue;
    q = s.slice(0, m.index + 1);
    break;
  }
  q = (q || s).trim();
  if (q.length > 96) q = q.slice(0, 92).trimEnd() + '…';
  return q;
}

function barsFromRows(rows: any[], count: number, unit: string): StoryBar[] {
  const top = rows.slice(0, count);
  const max = Math.max(...rows.map(r => Number(r.value) || 0), 1);
  return top.map(r => ({
    label: r.label,
    value: fmtNum(Number(r.value)),
    unit: (r.unit || unit || '').trim(),
    pct: Math.max(4, Math.round((Number(r.value) || 0) / max * 100)),
  }));
}

// ── Shared view builders ────────────────────────────────────────────────────
// Both the automatic (per card type) path and the user-picked variant path go
// through these, so a variant can never render something the auto path can't.

function coverHeroView(card: WeirdCard, base: any, rows: any[], unit: string): StoryView {
  const value = card.metric?.value ?? rows[0]?.value ?? null;
  const label = (card.metric?.name || rows[0]?.label || '').trim();
  const num = value == null ? NaN : Number(value);
  const hero: StoryHero = { value: fmtNum(num), unit, label };
  if (rows.length >= 2 && isFinite(Number(rows[1].value)) && Number(rows[1].value) !== 0 && isFinite(num)) {
    const prev = Number(rows[1].value);
    const pct = ((num - prev) / Math.abs(prev)) * 100;
    hero.delta = (pct >= 0 ? '+' : '') + pct.toFixed(Math.abs(pct) < 10 ? 1 : 0) + '%';
    hero.deltaUp = pct >= 0;
  }
  return { ...base, treatment: 'cover', hero };
}

function donutViewOf(card: WeirdCard, base: any, rows: any[]): StoryView {
  const label = (card.metric?.name || rows[0]?.label || '').trim();
  const num = Number(card.metric?.value ?? rows[0]?.value);
  return { ...base, treatment: 'cover', donut: { pct: num, label } };
}

/** Two-sided head-to-head. Null when the card has fewer than 2 usable rows. */
function duelViewOf(card: WeirdCard, base: any, rows: any[], unit: string): StoryView | null {
  const pair = rows.slice(0, 2);
  if (pair.length < 2) return null;
  const em = firstEmojis(card.title, 2);
  const av = Number(pair[0].value) || 0, bv = Number(pair[1].value) || 0;
  const tot = av + bv || 1;
  return {
    ...base, treatment: 'duel',
    duel: {
      a: { label: pair[0].label, value: fmtNum(av), emoji: em[0] || '' },
      b: { label: pair[1].label, value: fmtNum(bv), emoji: em[1] || '' },
      pctA: Math.round((av / tot) * 100),
      winnerIdx: av === bv ? -1 : (av > bv ? 0 : 1),
      unit,
    },
  };
}

/** True when the card carries a single headline value worth showing big. */
function hasHeroValue(card: WeirdCard, rows: any[]): boolean {
  const v = card?.metric?.value ?? rows[0]?.value ?? null;
  return v != null && isFinite(Number(v));
}

/**
 * Apply an explicitly-picked variant. Returns null when the card's data can't
 * support it, so the caller falls back to the automatic treatment — a stale
 * persisted pick can never render an empty/broken card.
 */
function applyVariant(
  card: WeirdCard, variant: StoryVariant, base: any, rows: any[], unit: string, full: boolean,
): StoryView | null {
  const barCount = full ? 8 : 4;
  switch (variant) {
    case 'story-statement':
      return { ...base, treatment: 'statement' };
    case 'story-list':
      return rows.length
        ? { ...base, treatment: 'editorial', isList: true, bars: barsFromRows(rows, barCount, unit) }
        : null;
    case 'story-bars':
      return (rows.length >= 2 && rowsHaveMetric(card))
        ? { ...base, treatment: 'editorial', isList: false, bars: barsFromRows(rows, barCount, unit) }
        : null;
    case 'story-leaderboard':
      return rows.length
        ? { ...base, treatment: 'leaderboard', isList: !rowsHaveMetric(card), bars: barsFromRows(rows, full ? 12 : 5, unit) }
        : null;
    case 'story-atlas':
      return rows.length
        ? { ...base, treatment: 'atlas', isList: !rowsHaveMetric(card), bars: barsFromRows(rows, barCount, unit) }
        : null;
    case 'story-hero':
      return hasHeroValue(card, rows) ? coverHeroView(card, base, rows, unit) : null;
    case 'story-donut':
      return donutable(card) ? donutViewOf(card, base, rows) : null;
    case 'story-duel':
      return duelViewOf(card, base, rows, unit);
    case 'story-chart':
      return (card?.labels?.length && card?.datasets?.length) ? { ...base, treatment: 'chart' } : null;
  }
  return null;
}

export function buildStoryView(card: WeirdCard, size: 'feed' | 'full' = 'feed', variant?: StoryVariant): StoryView {
  const ui: any = card?.uiMeta ?? {};
  const rows = labelledRows(card);
  const unit = (card?.metric?.unit || rows[0]?.unit || '').trim();
  const full = size === 'full';

  const base = {
    eyebrow: ui.category || '',
    title: stripLeadingEmoji(card?.title || ''),
    quip: shortQuip(card?.insight),
    emoji: ui.icon || '',
    accent: ui.accentColor || '#6C5CE7',
    hasData: cardHasData(card),
    isList: false,
    card,
  };

  // A picked variant wins over the type default (when the data supports it).
  if (variant) {
    const picked = applyVariant(card, variant, base, rows, unit, full);
    if (picked) return picked;
  }

  // ── Automatic treatment per card type ──
  switch (card?.cardType) {
    case 'kpi':
      return donutable(card) ? donutViewOf(card, base, rows) : coverHeroView(card, base, rows, unit);

    case 'ranking':
      return {
        ...base, treatment: 'editorial',
        isList: !rowsHaveMetric(card),      // value-less rows can't draw honest bars
        bars: barsFromRows(rows, full ? 8 : 4, unit),
      };

    case 'table':
      return {
        ...base, treatment: 'leaderboard', isList: !rowsHaveMetric(card),
        bars: barsFromRows(rows, full ? 12 : 5, unit),
      };

    case 'versus':
      return duelViewOf(card, base, rows, unit) ?? { ...base, treatment: 'statement' };

    case 'fact':
      return { ...base, treatment: 'statement' };

    case 'chart':
      return { ...base, treatment: 'chart' };

    case 'map':
      // Phase 1: a legible country leaderboard on the dark frame.
      return { ...base, treatment: 'atlas', bars: barsFromRows(rows, full ? 8 : 4, unit) };

    default:
      return { ...base, treatment: 'statement' };
  }
}
