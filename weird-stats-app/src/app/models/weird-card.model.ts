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

/** 'unsupported' = the question had no verifiable answer (an opinion or a
 *  prediction), so the card explains that rather than inventing a number. */
export type DataMode = 'researched' | 'cached' | 'estimated' | 'proxy' | 'unsupported';

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

/** The light card-background tint for an accent hex (case-insensitive). The five
 *  presets keep their hand-picked tints; a custom (premium) colour gets a soft
 *  wash derived from it, so light surfaces track the chosen hue too. Defined
 *  below `derivePremiumGradient`'s helpers — see `deriveLightTint`. */
export function gradientForAccent(hex: string | undefined): { from: string; to: string } {
  const key = ACCENT_COLORS.find(c => c.toLowerCase() === (hex || '').toLowerCase());
  if (key) return ACCENT_GRADIENTS[key];
  const norm = normalizeHex(hex);
  return norm ? deriveLightTint(norm) : ACCENT_GRADIENTS[ACCENT_COLORS[0]];
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

// ── Arbitrary-colour support ────────────────────────────────────────────────
// Premium members aren't limited to the five presets: they can pick ANY colour,
// so a gradient has to be derivable from an arbitrary hex rather than looked up.

/** True for a well-formed `#rgb` / `#rrggbb` string. */
export function isHexColor(hex: string | undefined): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test((hex || '').trim());
}

/** Normalise `#abc` → `#aabbcc` (lower-case); '' when not a hex. */
export function normalizeHex(hex: string | undefined): string {
  const h = (hex || '').trim().toLowerCase();
  if (!isHexColor(h)) return '';
  return h.length === 4 ? '#' + [...h.slice(1)].map(c => c + c).join('') : h;
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const h = normalizeHex(hex) || '#6c5ce7';
  const r = parseInt(h.slice(1, 3), 16) / 255;
  const g = parseInt(h.slice(3, 5), 16) / 255;
  const b = parseInt(h.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let hue: number;
  if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0));
  else if (max === g) hue = (b - r) / d + 2;
  else hue = (r - g) / d + 4;
  return { h: hue * 60, s, l };
}

function hslToHex(h: number, s: number, l: number): string {
  const hh = ((h % 360) + 360) % 360;
  const ss = Math.min(1, Math.max(0, s));
  const ll = Math.min(1, Math.max(0, l));
  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = ll - c / 2;
  const seg = Math.floor(hh / 60) % 6;
  const rgb = [[c,x,0],[x,c,0],[0,c,x],[0,x,c],[x,0,c],[c,0,x]][seg];
  const to255 = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${to255(rgb[0])}${to255(rgb[1])}${to255(rgb[2])}`;
}

/**
 * Build the deep three-stop card gradient for ANY colour, shaped like the
 * hand-tuned presets: a near-black base at the chosen hue, a mid tone, and a
 * lighter, slightly hue-rotated top, plus a bright same-hue bloom. Saturation is
 * floored so greys still read as a colour and capped so neons don't vibrate.
 */
export function derivePremiumGradient(hex: string): { from: string; mid: string; to: string; glow: string } {
  const { h, s } = hexToHsl(hex);
  // An achromatic pick (black / white / any grey) has hue 0 and no chroma.
  // Flooring saturation would invent a hue and paint the card RED, so keep
  // greys grey — only floor the saturation of colours that actually have some.
  const achromatic = s < 0.06;
  const sat = achromatic ? 0 : Math.min(0.86, Math.max(0.42, s));
  return {
    from: hslToHex(h - 5, sat * 0.95, 0.10),
    mid:  hslToHex(h,     sat * 0.92, 0.25),
    to:   hslToHex(h + 9, sat * 0.82, 0.42),
    glow: achromatic
      ? 'hsla(0, 0%, 72%, 0.35)'
      : `hsla(${Math.round(((h + 12) % 360 + 360) % 360)}, ${Math.round(sat * 100)}%, 64%, 0.5)`,
  };
}

/**
 * The accent as a SPOT colour on the white 'plain' plate (hero number, donut
 * ring, bars). A premium member can pick any colour, and a light one — pale
 * yellow, near-white — is invisible on white, so lightness is capped. Hue and
 * saturation are preserved, so the pick still reads as their colour.
 */
export function inkColorForAccent(hex: string | undefined): string {
  const key = ACCENT_COLORS.find(c => c.toLowerCase() === (hex || '').toLowerCase());
  if (key) return key;                       // the five presets are already safe
  const norm = normalizeHex(hex);
  if (!norm) return ACCENT_COLORS[0];
  const { h, s } = hexToHsl(norm);
  // Gate on RELATIVE LUMINANCE, not HSL lightness: they diverge badly by hue.
  // Yellow at l=0.44 is still bright enough to disappear on white, while blue at
  // the same l is already dark. Walk the lightness down until the colour is
  // genuinely dark enough to read as text on the white plate.
  if (relLuminance(norm) <= 0.30) return norm;
  const sat = s < 0.06 ? 0 : Math.max(s, 0.35);
  for (let l = 0.46; l >= 0.12; l -= 0.03) {
    const candidate = hslToHex(h, sat, l);
    if (relLuminance(candidate) <= 0.30) return candidate;
  }
  return hslToHex(h, sat, 0.12);
}

/** WCAG relative luminance (0 = black, 1 = white). */
function relLuminance(hex: string): number {
  const h = normalizeHex(hex) || '#000000';
  const ch = [1, 3, 5].map(i => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/** Soft light wash for an arbitrary colour — the light-surface counterpart of
 *  `derivePremiumGradient` (used by the OG/share backdrops and light cards). */
export function deriveLightTint(hex: string): { from: string; to: string } {
  const { h, s } = hexToHsl(hex);
  const sat = Math.min(0.62, Math.max(0.22, s));
  return { from: hslToHex(h, sat * 0.55, 0.94), to: hslToHex(h + 6, sat * 0.7, 0.87) };
}

/** The premium (dark) background for an accent hex. The five presets keep their
 *  hand-tuned values; any other colour is derived (premium custom colours). */
export function premiumGradientForAccent(hex: string | undefined): { from: string; mid: string; to: string; glow: string } {
  const key = ACCENT_COLORS.find(c => c.toLowerCase() === (hex || '').toLowerCase());
  if (key) return PREMIUM_GRADIENTS[key];
  const norm = normalizeHex(hex);
  return norm ? derivePremiumGradient(norm) : PREMIUM_GRADIENTS[ACCENT_COLORS[0]];
}

/**
 * FLAT (non-gradient) card colours — the standard, free coloration for the same
 * premium card DESIGN. This is simply the BASIC accent palette painted flat: the
 * card wears the very colour the picker shows, so "blue card" means `#378ADD`.
 * White copy stays legible because `.pc-scrim` already lays a dark wash over the
 * text side. Premium members can switch a card to the multi-stop gradient
 * (`uiMeta.useGradient`); everything else about the card is unchanged.
 */
export const SOLID_CARD_COLORS: Record<string, string> = {
  '#6C5CE7': '#6C5CE7', // violet
  '#378ADD': '#378ADD', // blue
  '#1D9E75': '#1D9E75', // green
  '#D85A30': '#D85A30', // terracotta
  '#BA7517': '#BA7517', // amber
};

/** The flat card colour for an accent hex. Off-palette values are used as-is
 *  (premium custom colours), so the card wears exactly the colour that was
 *  picked; only an unparseable value falls back to violet. */
export function solidColorForAccent(hex: string | undefined): string {
  const key = ACCENT_COLORS.find(c => c.toLowerCase() === (hex || '').toLowerCase());
  if (key) return SOLID_CARD_COLORS[key];
  return normalizeHex(hex) || SOLID_CARD_COLORS[ACCENT_COLORS[0]];
}

/**
 * How a story card paints its background. The DESIGN is identical across all
 * three — only the colouring differs, and only 'gradient' is premium-gated.
 */
export type CardSurface = 'plain' | 'color' | 'gradient';

/** Resolve a card's surface, honouring the legacy `useGradient` flag. Cards with
 *  nothing set are 'plain' — the neutral white default. */
export function cardSurfaceOf(ui: CardUiMeta | undefined): CardSurface {
  if (ui?.cardSurface) return ui.cardSurface;
  return ui?.useGradient ? 'gradient' : 'plain';
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
  /** The card's background treatment — the ONLY thing that differs between free
   *  and premium (the design/structure is identical in all three):
   *    'plain'    — neutral white card with dark copy. THE DEFAULT.
   *    'color'    — filled with the basic accent colour, white copy.
   *    'gradient' — the premium multi-stop gradient, white copy. Premium only.
   *  Set by the owner in the edit panel and persisted, so the card looks the same
   *  on every surface (feed, detail, captures, share). */
  cardSurface?: CardSurface;
  /** @deprecated superseded by `cardSurface`. Older cards that opted into the
   *  gradient carry this; still READ so they keep rendering as a gradient. */
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
