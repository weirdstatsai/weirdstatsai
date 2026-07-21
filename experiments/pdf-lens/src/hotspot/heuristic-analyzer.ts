/**
 * Heuristic StatAnalyzer — ships with the prototype, runs fully offline.
 *
 * It reads each paragraph block, scores how data-rich it is, and (for blocks
 * that clear the bar) derives which of the six stat cards it can support, with
 * mock previews built from the block's *actual* numbers so the cubes feel real.
 *
 * This is deliberately behind the `StatAnalyzer` interface: swap this for an
 * implementation that calls the WeirdStats backend and the rest of the app is
 * untouched.
 */
import type {
  StatAnalyzer,
  TextBlock,
  Hotspot,
  StatPreview,
  StatType,
} from '../core/types';

/** A small set of well-known regions so we can offer a `map` card sensibly. */
const GEO = [
  'USA', 'United States', 'China', 'India', 'Japan', 'Germany', 'UK',
  'United Kingdom', 'France', 'Brazil', 'Canada', 'Russia', 'Italy', 'Spain',
  'Mexico', 'Australia', 'Korea', 'Africa', 'Europe', 'Asia', 'America',
];

interface Num {
  value: number;
  raw: string;
  unit: string; // '%', '$', or ''
}

interface Pair {
  label: string;
  value: number;
  unit: string;
}

const NUMBER_RE = /(\$)?\s?(-?\d{1,3}(?:,\d{3})+|-?\d+(?:\.\d+)?)\s?(%|percent|billion|million|thousand|k|m|bn)?/gi;

function parseNumbers(text: string): Num[] {
  const out: Num[] = [];
  for (const m of text.matchAll(NUMBER_RE)) {
    const currency = m[1] ? '$' : '';
    let value = parseFloat(m[2].replace(/,/g, ''));
    const scale = (m[3] || '').toLowerCase();
    if (scale === 'billion' || scale === 'bn') value *= 1e9;
    else if (scale === 'million' || scale === 'm') value *= 1e6;
    else if (scale === 'thousand' || scale === 'k') value *= 1e3;
    const unit = m[3] && /%|percent/i.test(m[3]) ? '%' : currency;
    if (Number.isFinite(value)) out.push({ value, raw: m[0].trim(), unit });
  }
  return out;
}

/** Pull "Label 1,234" / "Label: 45%" style pairs — the backbone of rankings. */
function parsePairs(text: string): Pair[] {
  const out: Pair[] = [];
  const re = /([A-Z][A-Za-z&/. ]{2,28}?)[\s:–-]+(\$)?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s?(%|billion|million|thousand|k|m|bn)?/g;
  for (const m of text.matchAll(re)) {
    const label = m[1].trim().replace(/\s+/g, ' ');
    if (label.length < 3) continue;
    let value = parseFloat(m[3].replace(/,/g, ''));
    const scale = (m[4] || '').toLowerCase();
    if (scale === 'billion' || scale === 'bn') value *= 1e9;
    else if (scale === 'million' || scale === 'm') value *= 1e6;
    else if (scale === 'thousand' || scale === 'k') value *= 1e3;
    const unit = m[4] && m[4] === '%' ? '%' : m[2] ? '$' : '';
    if (Number.isFinite(value)) out.push({ label, value, unit });
  }
  return out;
}

function short(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (abs >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (abs >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(Math.round(n * 100) / 100);
}

function titleFrom(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  const firstClause = clean.split(/[.;:]/)[0];
  return (firstClause.length > 52 ? firstClause.slice(0, 49) + '…' : firstClause) || 'Stat';
}

/** A bare 4-digit year reads as a metric to a regex but isn't one. */
function isYear(v: number): boolean {
  return Number.isInteger(v) && v >= 1900 && v <= 2099;
}

/** Decide which cards a block supports and build mock previews from its data. */
function cardsFor(block: TextBlock): StatPreview[] {
  const text = block.text;
  const allNums = parseNumbers(text);
  // Drop lone years from the *metric* pool so KPIs/charts don't headline "2024".
  const nonYear = allNums.filter((n) => !isYear(n.value));
  const nums = nonYear.length ? nonYear : allNums;
  const pairs = parsePairs(text).filter((p) => !isYear(p.value));
  const geos = GEO.filter((g) => new RegExp(`\\b${g}\\b`, 'i').test(text));
  const hasVersus = /\bvs\.?\b|\bversus\b|\bcompared? (?:to|with)\b|\bthan\b/i.test(text);
  const title = titleFrom(text);
  const cards: StatPreview[] = [];

  const add = (type: StatType, extra: Partial<StatPreview> & { payload: StatPreview['payload'] }) =>
    cards.push({ type, title, ...extra } as StatPreview);

  // KPI — any single strong number becomes a headline metric.
  if (nums.length >= 1) {
    const hero = [...nums].sort((a, b) => Math.abs(b.value) - Math.abs(a.value))[0];
    add('kpi', {
      payload: {
        value: hero.unit === '$' ? '$' + short(hero.value) : short(hero.value),
        unit: hero.unit === '%' ? '%' : hero.unit === '$' ? '' : '',
        delta: nums.length > 1 ? (hero.value >= nums[0].value ? '▲ vs. rest' : '▼ vs. rest') : undefined,
      },
    });
  }

  // RANKING — labelled values, sorted high-to-low.
  if (pairs.length >= 3) {
    const rows = [...pairs].sort((a, b) => b.value - a.value).slice(0, 5)
      .map((p) => ({ label: p.label, value: p.value }));
    add('ranking', { payload: { rows } });
  }

  // CHART — a run of numbers becomes a series.
  if (nums.length >= 3) {
    const values = nums.slice(0, 6).map((n) => n.value);
    const labels = pairs.length >= 3
      ? pairs.slice(0, 6).map((p) => p.label.split(' ')[0])
      : values.map((_, i) => `#${i + 1}`);
    add('chart', { payload: { labels, values } });
  }

  // VERSUS — an explicit comparison with (at least) two numbers.
  if (hasVersus && (pairs.length >= 2 || nums.length >= 2)) {
    const a = pairs[0] ?? { label: 'A', value: nums[0]?.value ?? 0 };
    const b = pairs[1] ?? { label: 'B', value: nums[1]?.value ?? 0 };
    add('versus', { payload: { a: { label: a.label, value: a.value }, b: { label: b.label, value: b.value } } });
  }

  // TABLE — several labelled values, shown as rows.
  if (pairs.length >= 3 || nums.length >= 4) {
    const rowsSrc = pairs.length >= 3 ? pairs.slice(0, 4) : nums.slice(0, 4).map((n, i) => ({ label: `Item ${i + 1}`, value: n.value, unit: n.unit }));
    const columns = ['Item', 'Value'];
    const rows = rowsSrc.map((p) => [p.label, (p.unit === '$' ? '$' : '') + short(p.value) + (p.unit === '%' ? '%' : '')]);
    add('table', { payload: { columns, rows } });
  }

  // MAP — geographic labels with numbers.
  if (geos.length >= 2 && nums.length >= 2) {
    const regions = geos.slice(0, 5).map((name, i) => ({ name, value: nums[i]?.value ?? nums[0].value }));
    add('map', { payload: { regions } });
  }

  return cards;
}

/** Data-richness score in 0..1, used for ordering + visual emphasis. */
function scoreBlock(block: TextBlock, cardCount: number): number {
  const nums = parseNumbers(block.text).length;
  const pct = (block.text.match(/%|percent/gi) || []).length;
  const raw = nums * 1 + pct * 1.5 + cardCount * 2;
  return Math.max(0, Math.min(1, raw / 14));
}

export class HeuristicAnalyzer implements StatAnalyzer {
  readonly label = 'Heuristic (offline)';

  async analyze(blocks: TextBlock[]): Promise<Hotspot[]> {
    const hotspots: Hotspot[] = [];
    for (const block of blocks) {
      // Ignore tiny fragments (page numbers, headers).
      if (block.text.replace(/\s+/g, '').length < 24) continue;
      const cards = cardsFor(block);
      if (cards.length === 0) continue; // no data → not a hotspot (never fabricate)
      hotspots.push({
        id: `h-${block.id}`,
        block,
        score: scoreBlock(block, cards.length),
        cards,
      });
    }
    // Strongest hotspots first.
    return hotspots.sort((a, b) => b.score - a.score);
  }
}
