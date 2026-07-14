import { Component, Input, OnChanges } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer } from '@angular/platform-browser';
import { WeirdCard, CardRow, ACCENT_COLORS } from '../../../models/weird-card.model';
import { WorldTopoService } from '../../../services/world-topo.service';
import type { CountryFeature } from '../../../services/world-topo.service';

export type MapStyle = 'choropleth' | 'pins' | 'bubbles';

/**
 * True when at least one row label resolves to a country the world map can
 * actually draw. Mirrors the component's own marker/choropleth resolution —
 * used by card-detail to hide map-style alternatives that would render empty
 * (e.g. districts or states, which the world atlas doesn't contain).
 */
export function hasMappableRows(card: WeirdCard | undefined): boolean {
  return (card?.rows ?? []).some(r => {
    const key = (r.label || '').toLowerCase().trim();
    const raw = (r.extra ?? '').trim();
    const isoId = /^\d{1,3}$/.test(raw) ? parseInt(raw, 10) : NaN;
    const id = (!isNaN(isoId) && isoId > 0 && isoId <= 894) ? isoId : NAME_TO_ID[key];
    return COUNTRY_COORDS[key] !== undefined || id !== undefined;
  });
}

const NAME_TO_ID: Record<string, number> = {
  'afghanistan':2,'albania':8,'algeria':12,'angola':24,'argentina':32,
  'australia':36,'austria':40,'azerbaijan':31,'bangladesh':50,'belarus':112,
  'belgium':56,'bolivia':68,'bosnia':70,'brazil':76,'bulgaria':100,
  'cambodia':116,'cameroon':120,'canada':124,'chile':152,'china':156,
  'colombia':170,'congo':180,'costa rica':188,'croatia':191,'cuba':192,
  'czech republic':203,'czechia':203,'denmark':208,'ecuador':218,
  'egypt':818,'ethiopia':231,'finland':246,'france':250,'germany':276,
  'ghana':288,'greece':300,'guatemala':320,'hungary':348,'india':356,
  'indonesia':360,'iran':364,'iraq':368,'ireland':372,'israel':376,
  'italy':380,'japan':392,'jordan':400,'kazakhstan':398,'kenya':404,
  'north korea':408,'south korea':410,'korea':410,'kuwait':414,
  'laos':418,'lebanon':422,'libya':434,'malaysia':458,'mexico':484,
  'morocco':504,'mozambique':508,'myanmar':104,'nepal':524,'netherlands':528,
  'new zealand':554,'nicaragua':558,'nigeria':566,'norway':578,'pakistan':586,
  'peru':604,'philippines':608,'poland':616,'portugal':620,'romania':642,
  'russia':643,'saudi arabia':682,'senegal':686,'serbia':688,'slovakia':703,
  'somalia':706,'south africa':710,'spain':724,'sri lanka':144,'sudan':736,
  'sweden':752,'switzerland':756,'syria':760,'taiwan':158,'tajikistan':762,
  'tanzania':834,'thailand':764,'tunisia':788,'turkey':792,'turkiye':792,
  'ukraine':804,'united arab emirates':784,'uae':784,
  'united kingdom':826,'uk':826,'great britain':826,
  'united states':840,'usa':840,'us':840,'united states of america':840,
  'uzbekistan':860,'venezuela':862,'vietnam':704,'yemen':887,'zimbabwe':716,
  // Smaller nations that show up in per-capita rankings — present in the 110m
  // atlas, so they get a choropleth fill (were previously marker-only).
  'estonia':233,'latvia':428,'lithuania':440,'luxembourg':442,'iceland':352,
  'slovenia':705,'moldova':498,'cyprus':196,'malta':470,'montenegro':499,
  'north macedonia':807,'armenia':51,'georgia':268,'qatar':634,'bahrain':48,
  'oman':512,'singapore':702,'brunei':96,'kosovo':412,
};

// Country centroid [lat, lon] for marker placement
const COUNTRY_COORDS: Record<string, [number, number]> = {
  'united states':     [38.9, -95.7],
  'usa':               [38.9, -95.7],
  'us':                [38.9, -95.7],
  'canada':            [60.0, -95.0],
  'brazil':            [-14.2, -51.9],
  'mexico':            [23.6, -102.5],
  'argentina':         [-38.4, -63.6],
  'colombia':          [4.6, -74.3],
  'peru':              [-9.2, -75.0],
  'venezuela':         [6.4, -66.6],
  'chile':             [-35.7, -71.5],
  'united kingdom':    [55.4, -3.4],
  'uk':                [55.4, -3.4],
  'great britain':     [55.4, -3.4],
  'france':            [46.2, 2.2],
  'germany':           [51.2, 10.5],
  'russia':            [61.5, 105.3],
  'spain':             [40.5, -3.7],
  'italy':             [41.9, 12.6],
  'ukraine':           [48.4, 31.2],
  'poland':            [51.9, 19.1],
  'netherlands':       [52.1, 5.3],
  'sweden':            [60.1, 18.6],
  'norway':            [60.5, 8.5],
  'switzerland':       [46.8, 8.2],
  'austria':           [47.5, 14.5],
  'belgium':           [50.5, 4.5],
  'denmark':           [56.3, 9.5],
  'finland':           [61.9, 25.7],
  'turkey':            [38.9, 35.2],
  'turkiye':           [38.9, 35.2],
  'china':             [35.9, 104.2],
  'india':             [20.6, 78.9],
  'japan':             [36.2, 138.3],
  'south korea':       [35.9, 127.8],
  'korea':             [35.9, 127.8],
  'indonesia':         [-0.8, 113.9],
  'vietnam':           [14.1, 108.3],
  'thailand':          [15.9, 100.9],
  'malaysia':          [4.2, 108.0],
  'philippines':       [12.9, 121.8],
  'pakistan':          [30.4, 69.3],
  'bangladesh':        [23.7, 90.4],
  'iran':              [32.4, 53.7],
  'saudi arabia':      [23.9, 45.1],
  'iraq':              [33.2, 43.7],
  'israel':            [31.0, 34.9],
  'uae':               [24.0, 54.0],
  'united arab emirates': [24.0, 54.0],
  'egypt':             [26.8, 30.8],
  'nigeria':           [9.1, 8.7],
  'south africa':      [-30.6, 22.9],
  'kenya':             [-0.0, 37.9],
  'ethiopia':          [9.1, 40.5],
  'ghana':             [7.9, -1.0],
  'tanzania':          [-6.4, 34.9],
  'morocco':           [31.8, -7.1],
  'australia':         [-25.3, 133.8],
  'new zealand':       [-40.9, 174.9],
  'kazakhstan':        [48.0, 68.0],
  'uzbekistan':        [41.4, 64.6],
  'czechia':           [49.8, 15.5],
  'czech republic':    [49.8, 15.5],
  'greece':            [39.1, 21.8],
  'portugal':          [39.4, -8.2],
  'hungary':           [47.2, 19.5],
  'romania':           [45.9, 24.9],
  'serbia':            [44.0, 21.0],
  'iceland':           [64.9, -18.7],
  'ireland':           [53.4, -8.2],
  'croatia':           [45.1, 15.2],
  'slovakia':          [48.7, 19.7],
  'bulgaria':          [42.7, 25.5],
  'lithuania':         [55.2, 23.9],
  'latvia':            [56.9, 24.6],
  'estonia':           [58.6, 25.0],
  'belarus':           [53.7, 27.9],
  'moldova':           [47.4, 28.4],
  'albania':           [41.2, 20.2],
  'north macedonia':   [41.6, 21.7],
  'bosnia':            [43.9, 17.7],
  'montenegro':        [42.7, 19.4],
  'luxembourg':        [49.8, 6.1],
  'malta':             [35.9, 14.5],
  'cyprus':            [35.1, 33.4],
  'georgia':           [42.3, 43.4],
  'armenia':           [40.1, 45.0],
  'qatar':             [25.4, 51.2],
  'kuwait':            [29.3, 47.5],
  'bahrain':           [26.0, 50.5],
  'oman':              [21.5, 55.9],
  'jordan':            [30.6, 36.2],
  'lebanon':           [33.9, 35.5],
  'afghanistan':       [33.9, 67.7],
  'myanmar':           [17.1, 96.0],
  'cambodia':          [12.6, 104.9],
  'mongolia':          [46.9, 103.8],
  'nepal':             [28.4, 84.1],
  'sri lanka':         [7.9, 80.8],
  'north korea':       [40.3, 127.5],
  'taiwan':            [23.7, 121.0],
  'singapore':         [1.4, 103.8],
  'brunei':            [4.5, 114.7],
  'timor-leste':       [-8.9, 125.7],
  'papua new guinea':  [-6.3, 143.9],
  'fiji':              [-17.7, 178.1],
  'solomon islands':   [-9.6, 160.2],
  'vanuatu':           [-15.4, 166.9],
  'samoa':             [-13.8, -172.1],
  'american samoa':    [-14.3, -170.0],
  'tonga':             [-21.2, -175.2],
  'nauru':             [-0.5, 166.9],
  'kiribati':          [1.9, -157.4],
  'tuvalu':            [-7.1, 177.1],
  'tokelau':           [-9.2, -171.8],
  'cook islands':      [-21.2, -159.8],
  'niue':              [-19.1, -169.9],
  'marshall islands':  [7.1, 171.2],
  'micronesia':        [6.9, 158.2],
  'palau':             [7.5, 134.6],
  'federated states of micronesia': [6.9, 158.2],
  'new caledonia':     [-20.9, 165.6],
  'french polynesia':  [-17.7, -149.4],
  'guam':              [13.4, 144.8],
  'cuba':              [22.0, -79.5],
  'haiti':             [19.0, -72.3],
  'dominican republic':[18.7, -70.2],
  'jamaica':           [18.1, -77.3],
  'puerto rico':       [18.2, -66.6],
  'trinidad and tobago':[10.7, -61.2],
  'barbados':          [13.2, -59.6],
  'bahamas':           [25.0, -77.4],
  'belize':            [17.2, -88.5],
  'honduras':          [15.2, -86.2],
  'el salvador':       [13.8, -88.9],
  'guatemala':         [15.8, -90.2],
  'panama':            [8.5, -80.8],
  'paraguay':          [-23.4, -58.4],
  'uruguay':           [-32.5, -55.8],
  'bolivia':           [-16.3, -63.6],
  'ecuador':           [-1.8, -78.2],
  'guyana':            [4.9, -58.9],
  'suriname':          [3.9, -56.0],
  'maldives':          [3.2, 73.2],
  'bhutan':            [27.5, 90.4],
  'eritrea':           [15.2, 39.8],
  'djibouti':          [11.8, 42.6],
  'somalia':           [5.2, 46.2],
  'south sudan':       [6.9, 31.3],
  'central african republic': [6.6, 20.9],
  'democratic republic of congo': [-2.9, 23.7],
  'democratic republic of the congo': [-2.9, 23.7],
  'republic of congo': [-0.2, 15.8],
  'cameroon':          [3.9, 11.5],
  'ivory coast':       [7.5, -5.5],
  'côte d\'ivoire':    [7.5, -5.5],
  'burkina faso':      [12.4, -1.6],
  'mali':              [17.6, -2.0],
  'niger':             [17.6, 8.1],
  'chad':              [15.5, 18.7],
  'senegal':           [14.5, -14.5],
  'guinea':            [9.9, -11.4],
  'zimbabwe':          [-19.0, 29.2],
  'zambia':            [-13.1, 27.9],
  'angola':            [-11.2, 17.9],
  'namibia':           [-22.0, 17.1],
  'botswana':          [-22.3, 24.7],
  'mozambique':        [-18.7, 35.5],
  'madagascar':        [-18.8, 46.9],
  'mauritius':         [-20.3, 57.6],
  'libya':             [26.3, 17.2],
  'algeria':           [28.0, 1.7],
  'tunisia':           [34.0, 9.0],
  'sudan':             [15.6, 32.5],
};

// Color palette for pin markers
const PIN_COLORS = [
  '#6C5CE7','#D85A30','#1D9E75','#378ADD','#BA7517',
  '#E84393','#00B894','#E17055','#0984E3','#6C5CE7',
];


export interface MapMarker {
  label: string;
  value: number;
  unit: string;
  x: number;
  y: number;
  color: string;
  pct: number;
  radius: number;
}

@Component({
  selector: 'app-card-map',
  templateUrl: './card-map.component.html',
  styleUrls: ['./card-map.component.scss'],
})
export class CardMapComponent implements OnChanges {
  @Input() card!: WeirdCard;
  @Input() size: 'feed' | 'full' | 'alt' = 'feed';
  @Input() mapStyle: MapStyle = 'choropleth';

  accent = '#6C5CE7';
  gradFrom = '#f5f3ff';
  gradTo   = '#ffffff';

  countries: CountryFeature[] = [];
  markers: MapMarker[] = [];
  unmapped: Array<{ label: string; value: number; unit: string; pct: number; color: string }> = [];
  valueMap: Map<number, number> = new Map();
  maxValue = 1;
  private topoLoaded = false;

  // Choropleth focuses on the strongest few countries: coloring 12 tiny nations
  // reads as noise, so we highlight the top N by value and let the rest fade to
  // a neutral base. TOP_N also fixes rows arriving out of order (we sort here).
  private readonly TOP_N = 5;
  topRows: CardRow[] = [];
  scaleMin = 0;
  scaleMax = 1;

  private readonly MAX_LAT = 82;
  private readonly MIN_LAT = -60;
  private readonly SVG_W = 960;
  private readonly SVG_H = 500;
  private readonly mercMax = Math.log(Math.tan(Math.PI / 4 + this.MAX_LAT * Math.PI / 360));
  private readonly mercMin = Math.log(Math.tan(Math.PI / 4 + this.MIN_LAT * Math.PI / 360));

  constructor(
    private http: HttpClient,
    private sanitizer: DomSanitizer,
    private topoService: WorldTopoService,
  ) {}

  ngOnChanges(): void {
    const h = (this.card?.uiMeta?.accentColor ?? '').trim();
    this.accent   = (ACCENT_COLORS as readonly string[]).includes(h) ? h : ACCENT_COLORS[0];
    this.gradFrom = this.card?.uiMeta?.gradientFrom || '#f5f3ff';
    this.gradTo   = this.card?.uiMeta?.gradientTo   || '#ffffff';
    this.buildTop();
    this.buildValueMap();
    this.buildMarkers();
    if (!this.topoLoaded) this.loadTopo();
  }

  /** Top N rows by value, highest first — the ranked list under the map. */
  private buildTop(): void {
    this.topRows = [...(this.card?.rows ?? [])]
      .filter(r => typeof r.value === 'number' && !isNaN(r.value))
      .sort((a, b) => b.value - a.value)
      .slice(0, this.TOP_N);
  }

  private rowId(row: CardRow): number | undefined {
    // `extra` is only an ISO id when it's a clean integer in the ISO 3166 range
    // (1–894). It often carries a note instead ("2023 estimate"), and a loose
    // parseInt would read that as 2023 and match no country — the long-standing
    // reason choropleth fills never appeared. Fall back to the label lookup.
    const raw = (row.extra ?? '').trim();
    const isoId = /^\d{1,3}$/.test(raw) ? parseInt(raw, 10) : NaN;
    if (!isNaN(isoId) && isoId > 0 && isoId <= 894) return isoId;
    return NAME_TO_ID[(row.label || '').toLowerCase().trim()];
  }

  private buildValueMap(): void {
    // Color EVERY country that has data — a full choropleth. The scale spans
    // the whole dataset's range so the shading is meaningful end to end; the
    // top-N list under the map is a separate, curated view.
    this.valueMap = new Map();
    for (const row of (this.card?.rows ?? [])) {
      const id = this.rowId(row);
      if (id !== undefined) this.valueMap.set(id, row.value);
    }
    const vals = Array.from(this.valueMap.values());
    this.scaleMax = vals.length ? Math.max(...vals) : 1;
    this.scaleMin = vals.length ? Math.min(...vals) : 0;
  }

  private buildMarkers(): void {
    const rows = this.card?.rows ?? [];
    this.maxValue = Math.max(...rows.map(r => r.value), 1);
    const total = rows.reduce((s, r) => s + r.value, 0);
    const MAX_RADIUS = this.size === 'alt' ? 18 : 30;
    const MIN_RADIUS = this.size === 'alt' ? 4 : 6;

    this.markers = [];
    this.unmapped = [];

    rows.forEach((row, i) => {
      const key = row.label.toLowerCase().trim();
      const coords = COUNTRY_COORDS[key];
      const color = PIN_COLORS[i % PIN_COLORS.length];
      const pct = total > 0 ? Math.round((row.value / total) * 100) : 0;
      const unit = row.unit || this.card?.metric?.unit || '';

      if (coords) {
        const [svgX, svgY] = this.project(coords[1], coords[0]);
        const ratio = row.value / this.maxValue;
        this.markers.push({
          label: row.label, value: row.value, unit,
          x: svgX, y: svgY, color, pct,
          radius: Math.max(MIN_RADIUS, Math.round(ratio * MAX_RADIUS)),
        });
      } else {
        // Check if it has a TopoJSON entry (choropleth can show it)
        const isoId = row.extra ? parseInt(row.extra, 10) : NaN;
        const id = !isNaN(isoId) ? isoId : NAME_TO_ID[key];
        if (!id) {
          this.unmapped.push({ label: row.label, value: row.value, unit, pct, color });
        }
      }
    });
  }

  private async loadTopo(): Promise<void> {
    try {
      this.countries = await this.topoService.getCountries(
        (lon, lat) => this.project(lon, lat)
      );
      this.topoLoaded = true;
    } catch (e) {
      console.error('Failed to load world map topo', e);
    }
  }

  project(lon: number, lat: number): [number, number] {
    const safeLat = Math.max(-89.9, Math.min(89.9, lat));
    const x = ((lon + 180) / 360) * this.SVG_W;
    const mercY = Math.log(Math.tan(Math.PI / 4 + safeLat * Math.PI / 360));
    const y = (1 - (mercY - this.mercMin) / (this.mercMax - this.mercMin)) * this.SVG_H;
    return [x, y];
  }

  // ── Multi-hue color scale (Red → Yellow → Green choropleth) ───────────────
  // A perceptual heat ramp like a standard world-atlas choropleth: low values
  // read red/orange, mid yellow, high green. Fixed data-viz palette (not the
  // card accent) so the shading is comparable across every map.
  private readonly SCALE_STOPS = ['#d73027', '#fc8d59', '#fee08b', '#91cf60', '#1a9850'];

  private ramp(t: number): [number, number, number] {
    const stops = this.SCALE_STOPS.map(h => this.parseHex(h));
    const n = stops.length - 1;
    const s = Math.max(0, Math.min(1, t)) * n;
    const i = Math.min(n - 1, Math.floor(s));
    return this.lerp(stops[i], stops[i + 1], s - i);
  }

  scaleColor(value: number): string {
    const span = this.scaleMax - this.scaleMin;
    const t = span > 0 ? (value - this.scaleMin) / span : 1;
    return this.rgbStr(this.ramp(t));
  }

  countryFill(id: number): string {
    const v = this.valueMap.get(id);
    if (v === undefined) return 'rgba(0,0,0,0.05)';   // no data → neutral base
    return this.scaleColor(v);
  }

  /** CSS gradient for the horizontal legend bar (left = low, right = high). */
  get scaleGradientH(): string {
    return 'linear-gradient(to right,' + this.SCALE_STOPS.join(',') + ')';
  }

  /** Tick marks up the legend — min & max endpoints plus round interior steps. */
  get scaleTicks(): Array<{ label: string; pct: number }> {
    const min = this.scaleMin, max = this.scaleMax;
    if (!(max > min)) return [{ label: this.fmt(max), pct: 50 }];
    const out: Array<{ label: string; pct: number }> = [{ label: this.fmt(min), pct: 0 }];
    const step = this.niceStep((max - min) / 3);
    for (let v = Math.ceil(min / step) * step; v < max - step * 0.25; v += step) {
      const pct = ((v - min) / (max - min)) * 100;
      if (pct > 8 && pct < 92) out.push({ label: this.fmt(v), pct });
    }
    out.push({ label: this.fmt(max), pct: 100 });
    return out;
  }

  private niceStep(raw: number): number {
    if (raw <= 0) return 1;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / mag;
    const nice = n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10;
    return nice * mag;
  }

  private lerp(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
    const k = Math.max(0, Math.min(1, t));
    return [
      Math.round(a[0] + (b[0] - a[0]) * k),
      Math.round(a[1] + (b[1] - a[1]) * k),
      Math.round(a[2] + (b[2] - a[2]) * k),
    ];
  }
  private parseHex(hex: string): [number, number, number] {
    return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  }
  private rgbStr([r, g, b]: [number, number, number]): string { return `rgb(${r},${g},${b})`; }

  /** True when at least one country in the data can be drawn on the map. */
  get mapHasGeo(): boolean {
    return this.valueMap.size > 0;
  }

  /** The ranked list shown under the map — top N (fewer on tiny tiles). */
  get listRows(): CardRow[] {
    return this.topRows.slice(0, this.size === 'alt' ? 3 : this.TOP_N);
  }

  fmt(v: number): string {
    if (Math.abs(v) >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1) + 'B';
    if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
    if (Math.abs(v) >= 1_000) return (v / 1_000).toFixed(v >= 10_000 ? 0 : 1) + 'K';
    return v.toLocaleString();
  }

  // True when not a single row matched a country — e.g. the AI mis-tagged a
  // non-geographic breakdown (companies, products...) as a map card. Showing
  // an empty world map in that case is pure wasted space, so the template
  // hides the map graphic and falls back to just the ranked list.
  get allUnmapped(): boolean {
    return this.markers.length === 0 && this.unmapped.length > 0;
  }

  get unit(): string {
    return this.card?.rows?.[0]?.unit || this.card?.metric?.unit || '';
  }

  // The pins/bubbles legend lists the leaders, not every country — with 30-40
  // rows the full list is unreadable. Cap at 10 (4 on tiny preview tiles). The
  // map still shows ALL pins (those iterate `markers` directly), unchanged.
  get legendRows(): MapMarker[] {
    return this.markers.slice(0, this.size === 'alt' ? 4 : 10);
  }

  hexToRgb(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r},${g},${b}`;
  }
}
