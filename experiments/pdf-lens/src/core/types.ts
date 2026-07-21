/**
 * Shared domain types for the PDF-Lens prototype.
 *
 * These mirror the intent of the WeirdStats `WeirdCard` model so the prototype
 * can later port cleanly into the real app. The six stat card types below are
 * exactly the WeirdStats `CardType` union minus `fact` — "all stats except the
 * facts", per the product brief.
 */

/** The stat card types a hotspot can produce. Excludes `fact` by design. */
export type StatType = 'kpi' | 'chart' | 'ranking' | 'versus' | 'table' | 'map';

export const ALL_STAT_TYPES: StatType[] = ['kpi', 'chart', 'ranking', 'versus', 'table', 'map'];

/** A rectangle in device (on-screen canvas) pixels, origin top-left. */
export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** A single run of text from pdf.js, already projected into device pixels. */
export interface TextItem {
  str: string;
  rect: Rect;
  /** Rough font height in px — used to group runs into lines. */
  fontHeight: number;
}

/**
 * A paragraph-level block: one or more lines of text grouped together, with a
 * bounding box in device pixels. This is the unit the lens can snap to.
 */
export interface TextBlock {
  id: string;
  pageIndex: number;
  text: string;
  rect: Rect;
  /** Center of the block in device px — the lens snaps here. */
  center: { x: number; y: number };
}

/**
 * A stat-able region. Produced by a StatAnalyzer from a TextBlock. Carries the
 * card types it can support plus a mocked preview payload per type (until the
 * real AI analyzer is wired in).
 */
export interface Hotspot {
  id: string;
  block: TextBlock;
  /** 0..1 — how data-rich the block is. Drives ordering + visual emphasis. */
  score: number;
  /** Which stat cards this region can produce, best-first. */
  cards: StatPreview[];
}

/** A single stat card preview that orbits the lens. */
export interface StatPreview {
  type: StatType;
  title: string;
  /** Type-specific mock data used to render the little cube preview. */
  payload: KpiPayload | SeriesPayload | RankingPayload | VersusPayload | TablePayload | MapPayload;
}

export interface KpiPayload {
  value: string;
  unit: string;
  delta?: string;
}
export interface SeriesPayload {
  labels: string[];
  values: number[];
}
export interface RankingPayload {
  rows: { label: string; value: number }[];
}
export interface VersusPayload {
  a: { label: string; value: number };
  b: { label: string; value: number };
}
export interface TablePayload {
  columns: string[];
  rows: string[][];
}
export interface MapPayload {
  regions: { name: string; value: number }[];
}

/**
 * The pluggable analysis contract. The heuristic implementation ships with the
 * prototype (no API keys, fully offline). A future AI implementation that calls
 * the WeirdStats backend can be dropped in behind the same interface.
 */
export interface StatAnalyzer {
  readonly label: string;
  analyze(blocks: TextBlock[]): Promise<Hotspot[]>;
}
