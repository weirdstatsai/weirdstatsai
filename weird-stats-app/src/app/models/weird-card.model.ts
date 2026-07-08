/**
 * WeirdCard — the single source of truth for a generated metric card.
 *
 * This mirrors EXACTLY the JSON the backend Metrics pipeline produces
 * (Research Agent → Format Agent → validator). Both the backend Python
 * schema and this interface must stay in sync. When the backend stores a
 * card in Firestore `graphs/{id}`, it stores this shape (plus storage meta
 * like id/uid/createdAt/promptHash).
 */

export type CardType =
  | 'chart'
  | 'ranking'
  | 'kpi'
  | 'versus'
  | 'fact'
  | 'table'
  | 'map';

export type PresentationType =
  | 'bar-chart' | 'line-chart' | 'pie-chart' | 'doughnut-chart'
  | 'polar-area-chart' | 'scatter-chart' | 'bubble-chart'
  | 'top-5' | 'top-10' | 'top-25'
  | 'kpi-single' | 'kpi-comparison'
  | 'versus' | 'fact' | 'table' | 'map-region';

export type ChartType =
  | 'bar' | 'line' | 'scatter' | 'doughnut'
  | 'pie' | 'radar' | 'bubble' | 'polarArea';

export type CardStatus = 'success' | 'needs_review' | 'unsupported';

export type DataMode = 'researched' | 'cached' | 'estimated' | 'proxy';

export type Confidence = 'high' | 'medium' | 'low';

export type SourceType =
  | 'official' | 'research' | 'company' | 'database' | 'news' | 'other';

/** The five accent colors the agent is constrained to. */
export const ACCENT_COLORS = ['#6C5CE7', '#378ADD', '#1D9E75', '#D85A30', '#BA7517'] as const;
export type AccentColor = typeof ACCENT_COLORS[number];

export interface CardMetric {
  name: string;
  unit: string;
  value: number | null;
  description: string;
}

export interface CardDataset {
  label: string;
  data: number[];
}

export interface CardRow {
  rank: number | null;
  label: string;
  value: number;
  unit: string;
  extra: string;
}

export interface CardUiMeta {
  category: string;
  visualTheme: string;
  accentColor: string;
  gradientFrom: string;
  gradientTo: string;
  backgroundPattern: string;
  icon: string;
  insightBadge: string;
  shareTitle: string;
  rankStyles?: string[];
  versusStyles?: string[];
  mapStyles?: string[];
  selectedStyle?: string;
  factFontSize?: 'small' | 'medium' | 'large';
}

export interface CardDataMeta {
  geoScope: string;
  timePeriod: string;
  dataMode: DataMode;
  isProxy: boolean;
  proxyExplanation: string;
  confidence: Confidence;
}

export interface CardSource {
  name: string;
  url: string;
  sourceType: SourceType;
  retrievedAt: string;
}

export interface CardSourceMeta {
  primarySourceName: string;
  sources: CardSource[];
}

/** The exact agent output shape. */
export interface WeirdCard {
  status: CardStatus;
  title: string;
  cardType: CardType;
  presentationType: PresentationType;
  chartType: ChartType | null;
  theme: string;
  metric: CardMetric;
  labels: string[];
  datasets: CardDataset[];
  rows: CardRow[];
  insight: string;
  tags: string[];
  weirdScore: number;
  uiMeta: CardUiMeta;
  dataMeta: CardDataMeta;
  sourceMeta: CardSourceMeta;
}

/**
 * A document in the `stats` Firestore collection.
 * Top-level fields are storage metadata; all card content lives in `data`.
 */
export interface StoredStatCard {
  id: string;
  /** Pipeline status: whether the card was fully processed */
  status: 'draft' | 'completed';
  /** Publish status: 'draft' = private/only owner sees it; 'published' = visible on Explore */
  publishStatus?: 'draft' | 'published' | 'private';
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  prompt: string;
  promptHash: string;
  /** Set when the card was generated inside a project ("Add a stat") — such
   *  cards live in that project only, never in the profile Saved/Drafts tabs. */
  projectId?: string;
  /** Name of the document this card was bulk-imported from (absent for cards
   *  generated from a typed prompt). Used to group a project's grid by source. */
  importFile?: string;
  /** Firebase Storage URL of the rendered social-preview (OG) image — the real
   *  card, generated client-side on publish. Backend OG meta points here when
   *  present, else falls back to the generated Pillow template. */
  ogImage?: string;
  data: WeirdCard;
}

/** @deprecated use StoredStatCard */
export type StoredWeirdCard = StoredStatCard;
