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

/**
 * Content-tinted card backgrounds — one soft-but-present gradient per accent.
 * A card's accent is chosen from its content (by the agent, or the edit
 * picker), so the background colour tracks the subject while staying light
 * enough that dark text and dense data (charts, tables, numbers) read cleanly.
 * Single source of truth: card components derive their background from here via
 * `gradientForAccent`, and the edit picker persists the same values.
 */
export const ACCENT_GRADIENTS: Record<string, { from: string; to: string }> = {
  '#6C5CE7': { from: '#ece7ff', to: '#d9ccfb' }, // violet
  '#378ADD': { from: '#e4eefb', to: '#ccdef5' }, // blue
  '#1D9E75': { from: '#e1f1e7', to: '#c9e7cd' }, // green
  '#D85A30': { from: '#fce9e0', to: '#f6d5c4' }, // terracotta
  '#BA7517': { from: '#fbeecb', to: '#f6dfa6' }, // amber
};

/** The card background gradient for an accent hex (case-insensitive), falling
 *  back to the violet default for anything off-palette. */
export function gradientForAccent(hex: string | undefined): { from: string; to: string } {
  const key = ACCENT_COLORS.find(c => c.toLowerCase() === (hex || '').toLowerCase());
  return ACCENT_GRADIENTS[key ?? ACCENT_COLORS[0]];
}

/**
 * Vibrant DARK backgrounds for the premium "story card" treatment — the dark,
 * white-text look from the home story cards, keyed off the same content-chosen
 * accent as the light `ACCENT_GRADIENTS`. `from`/`to` form the deep base
 * gradient; `glow` is a colored radial accent behind the hero. Distilled from
 * the home sc-a/sc-b treatments + the existing dark `.card-fact` gradient.
 */
export const PREMIUM_GRADIENTS: Record<string, { from: string; mid: string; to: string; glow: string }> = {
  '#6C5CE7': { from: '#241241', mid: '#3a2168', to: '#6d3b8e', glow: 'rgba(233,120,88,0.55)' }, // aubergine → purple (home sc-a)
  '#378ADD': { from: '#08102e', mid: '#141c52', to: '#28348a', glow: 'rgba(72,150,235,0.55)' },  // navy → indigo (home sc-b)
  '#1D9E75': { from: '#052a20', mid: '#0d5640', to: '#138a5f', glow: 'rgba(84,228,168,0.50)' },  // emerald → teal
  '#D85A30': { from: '#2a1207', mid: '#722e14', to: '#b04d20', glow: 'rgba(255,142,82,0.55)' },  // ember terracotta
  '#BA7517': { from: '#241a05', mid: '#63420c', to: '#a6781a', glow: 'rgba(255,196,92,0.50)' },  // warm amber
};

/** The premium (dark) background for an accent hex, falling back to violet. */
export function premiumGradientForAccent(hex: string | undefined): { from: string; mid: string; to: string; glow: string } {
  const key = ACCENT_COLORS.find(c => c.toLowerCase() === (hex || '').toLowerCase());
  return PREMIUM_GRADIENTS[key ?? ACCENT_COLORS[0]];
}

/**
 * FLAT (non-gradient) card colours — the standard, free coloration for the same
 * premium card DESIGN. One deep, solid tone per accent, sampled from the middle
 * of each premium gradient so the white text/donut chrome keeps identical
 * contrast. Premium members can switch a card to the multi-stop gradient
 * (`uiMeta.useGradient`); everything else about the card is unchanged.
 */
export const SOLID_CARD_COLORS: Record<string, string> = {
  '#6C5CE7': '#3a2168', // violet
  '#378ADD': '#1b2560', // navy
  '#1D9E75': '#0d5640', // emerald
  '#D85A30': '#722e14', // terracotta
  '#BA7517': '#5d3f0c', // amber
};

/** The flat card colour for an accent hex, falling back to violet. */
export function solidColorForAccent(hex: string | undefined): string {
  const key = ACCENT_COLORS.find(c => c.toLowerCase() === (hex || '').toLowerCase());
  return SOLID_CARD_COLORS[key ?? ACCENT_COLORS[0]];
}

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
  /** KPI cards only: opt IN to the premium dark GRADIENT treatment (app-story-card).
   *  Default/undefined = the free light card (app-card-kpi). Set by the owner in the
   *  edit panel and gated to premium members; persisted so the card renders the same
   *  on every surface (feed, detail, captures, share). */
  useGradient?: boolean;
  /** Owner-uploaded background photo (Storage download URL) — layers softly
   *  under the card content; fills the panel on the fact split style. Set
   *  client-side only (card-detail edit panel), never by the backend. */
  heroImage?: string;
  /** Storage path of that photo (card-media/{uid}/{cardId}) — kept so
   *  replace/remove/delete can clean the object up without URL parsing. */
  heroImagePath?: string;
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
  /** Creator's avatar emoji, denormalized onto the card so shared-link viewers
   *  can see it (users/{uid} is owner-only readable). Populated on claim/publish. */
  createdByEmoji?: string;
  createdAt: string;
  /** Last time the card was created, saved, published, or edited — used to sort
   *  "latest first" in Explore / Drafts / Saved. Falls back to createdAt. */
  updatedAt?: string;
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
  /** Admin-curated card pushed to the Home feed. Home shows these; Explore
   *  shows the public user-published cards (which don't have this flag).
   *  @deprecated superseded by `showOnHome` — kept for read back-compat. */
  homeFeatured?: boolean;
  /** ISO time the card was pushed to Home (ordering + shuffle windows). */
  homeAddedAt?: string;
  /** Admin-controlled: card is featured on the Home feed. The Home query reads
   *  this flag directly. Only admins may enable it (enforced in Firestore rules). */
  showOnHome?: boolean;
  /** Admin-controlled: card is surfaced on the Explore feed. The Explore query
   *  reads this flag directly. Only admins may enable it (Firestore rules). */
  showOnExplore?: boolean;
  data: WeirdCard;
}

/** @deprecated use StoredStatCard */
export type StoredWeirdCard = StoredStatCard;
