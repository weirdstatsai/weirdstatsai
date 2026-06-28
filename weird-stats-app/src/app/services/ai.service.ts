import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Graph, GraphConfig, GraphUiMeta, ChartType } from '../models/graph.model';
import { environment } from '../../environments/environment';

interface BackendUiMeta {
  category: string;
  visualTheme: string;
  accentColor: string;
  backgroundPattern: string;
  icon: string;
  cardType: string;
  insightBadge: string;
  shareTitle: string;
}

interface BackendChartResponse {
  id?: string;
  title: string;
  type: ChartType;
  theme: string;
  labels: string[];
  datasets: { label: string; data: any[] }[];
  insight: string;
  tags: string[];
  weirdScore: number;
  uiMeta?: BackendUiMeta;
  prompt?: string;
  createdAt?: string;
  suggestions?: string[];
  alternatives?: BackendChartResponse[];
}

const PALETTE = {
  purple: ['#534AB7', '#7F77DD', '#AFA9EC', '#CECBF6', '#EEEDFE'],
  teal:   ['#0F6E56', '#1D9E75', '#5DCAA5', '#9FE1CB', '#E1F5EE'],
  coral:  ['#993C1D', '#D85A30', '#F0997B', '#F5C4B3', '#FAECE7'],
  amber:  ['#854F0B', '#BA7517', '#EF9F27', '#FAC775', '#FAEEDA'],
  pink:   ['#993556', '#D4537E', '#ED93B1', '#F4C0D1', '#FBEAF0'],
  blue:   ['#185FA5', '#378ADD', '#85B7EB', '#B5D4F4', '#E6F1FB'],
};

const ALL_COLORS = [
  PALETTE.purple[0], PALETTE.teal[0], PALETTE.coral[0],
  PALETTE.amber[1], PALETTE.blue[0], PALETTE.pink[0],
  PALETTE.purple[2], PALETTE.teal[2], PALETTE.coral[2],
];

@Injectable({ providedIn: 'root' })
export class AiService {

  constructor(private http: HttpClient) {}

  generateGraph(prompt: string, preferredType?: ChartType): Observable<Graph> {
    return this.http
      .post<BackendChartResponse>(`${environment.apiUrl}/api/generate`, {
        prompt,
        preferredType,
      })
      .pipe(
        map(res => this.graphFromResponse(prompt, res)),
        catchError(() => {
          // Backend/agent unreachable - fall back to a fully local mock.
          return new Observable<Graph>(observer => {
            const delay = 600 + Math.random() * 400;
            setTimeout(() => {
              try {
                observer.next(this.buildGraph(prompt, preferredType));
                observer.complete();
              } catch (e) {
                observer.error(e);
              }
            }, delay);
          });
        }),
      );
  }

  // Build alternative chart "takes" for an EXISTING graph (loaded from store).
  // Reuses the graph's own labels/values so the alternatives stay relevant.
  buildAlternativesFor(graph: Graph): Graph[] {
    const data: any = graph.config?.data ?? {};
    const labels: string[] = data.labels ?? [];
    const values: number[] = (data.datasets?.[0]?.data ?? []) as number[];
    const theme = this.detectTheme(graph.prompt.toLowerCase());
    // Include the graph's current type as the first take so the user can
    // always switch back, then add other chart-type alternatives.
    const current: Graph = { ...graph, alternatives: undefined };
    return [current, ...this.altsFromData(graph.prompt, graph.type, theme, labels, values)];
  }

  private graphFromResponse(prompt: string, res: BackendChartResponse): Graph {
    const main = this.singleGraphFromResponse(prompt, res);
    if (res.alternatives && res.alternatives.length) {
      main.alternatives = res.alternatives.slice(0, 3).map(a => this.singleGraphFromResponse(prompt, a));
    } else {
      // Reuse the main chart's own labels/values so the alternatives stay relevant.
      const labels = res.labels ?? [];
      const values = (res.datasets[0]?.data ?? []) as number[];
      main.alternatives = this.altsFromData(prompt, main.type, res.theme, labels, values);
    }
    return main;
  }

  private singleGraphFromResponse(prompt: string, res: BackendChartResponse): Graph {
    const labels = res.labels;
    const rawData = res.datasets[0]?.data ?? [];
    // For scatter/bubble the AI returns {x,y} or {x,y,r} objects directly
    const isXY = res.type === 'scatter' || res.type === 'bubble';
    const values = isXY ? [] : (rawData as number[]);
    const config = isXY
      ? this.buildXYConfig(res.type, res.theme, rawData as any[])
      : this.buildConfig(res.type, res.theme, labels, values);

    return {
      id: res.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: res.title,
      prompt: res.prompt ?? prompt,
      type: res.type,
      config,
      insight: res.insight,
      tags: res.tags,
      createdAt: res.createdAt ? new Date(res.createdAt) : new Date(),
      saved: false,
      shared: false,
      weirdScore: res.weirdScore,
      uiMeta: res.uiMeta as GraphUiMeta | undefined,
    };
  }

  // Build 2 alternative chart "takes" reusing the SAME labels + values as the
  // main chart, just rendered with different chart types — keeps them relevant.
  private altsFromData(
    prompt: string,
    excludeType: ChartType,
    theme: string,
    labels: string[],
    values: number[],
  ): Graph[] {
    const lower = prompt.toLowerCase();
    // If the main chart had no label/value pairs (e.g. scatter/bubble), fall
    // back to themed mock data so we still have something to show.
    if (!labels.length || !values.length) {
      const d = this.themeData[theme] ?? this.themeData['general'];
      labels = d.labels;
      values = d.values;
    }

    const pool: ChartType[] = ['bar', 'line', 'doughnut', 'radar', 'polarArea'];
    const chosen = pool
      .filter(t => t !== excludeType)
      .sort(() => Math.random() - 0.5)
      .slice(0, 2);

    return chosen.map(type => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: this.buildTitle(prompt, type),
      prompt,
      type,
      config: this.buildConfig(type, theme, labels, values),
      insight: this.buildInsight(theme, type, lower),
      tags: this.buildTags(lower),
      createdAt: new Date(),
      saved: false,
      shared: false,
      weirdScore: this.calcWeirdScore(lower),
    }));
  }

  private buildGraph(prompt: string, preferredType?: ChartType): Graph {
    const lower = prompt.toLowerCase();
    const type: ChartType = preferredType ?? this.detectType(lower);
    const theme = this.detectTheme(lower);
    const d = this.themeData[theme] ?? this.themeData['general'];
    const values = d.values.map(v => v + Math.floor((Math.random() - 0.5) * 12));
    const config = this.buildConfig(type, theme, d.labels, values);
    const title = this.buildTitle(prompt, type);
    const insight = this.buildInsight(theme, type, lower);
    const tags = this.buildTags(lower);
    const weirdScore = this.calcWeirdScore(lower);

    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      prompt,
      type,
      config,
      insight,
      tags,
      createdAt: new Date(),
      saved: false,
      shared: false,
      weirdScore,
      alternatives: this.altsFromData(prompt, type, theme, d.labels, values),
    };
  }

  // ── Type detection ───────────────────────────────────────────
  private detectType(s: string): ChartType {
    if (/pie|donut|doughnut|portion|share|breakdown|percent/.test(s)) return 'doughnut';
    if (/radar|spider|web|skill|comparison/.test(s)) return 'radar';
    if (/bubble/.test(s)) return 'bubble';
    if (/polar/.test(s)) return 'polarArea';
    if (/scatter|correlation|vs\.?|versus|relationship/.test(s)) return 'scatter';
    if (/trend|over time|by year|by month|history|growth|decline|line/.test(s)) return 'line';
    return 'bar';
  }

  // ── Theme detection ──────────────────────────────────────────
  private detectTheme(s: string): string {
    if (/coffee|caffeine|drink|beer|wine|alcohol/.test(s)) return 'coffee';
    if (/sleep|nap|rest|tired|insomnia/.test(s)) return 'sleep';
    if (/cat|dog|pet|animal|zoo/.test(s)) return 'animals';
    if (/country|world|global|nation|continent/.test(s)) return 'countries';
    if (/movie|film|cinema|actor|director/.test(s)) return 'movies';
    if (/music|song|album|band|spotify/.test(s)) return 'music';
    if (/sport|game|score|team|player|nba|nfl/.test(s)) return 'sports';
    if (/money|income|salary|wage|gdp|economy/.test(s)) return 'economy';
    if (/tech|app|software|code|computer|internet/.test(s)) return 'tech';
    if (/food|eat|diet|meal|burger|pizza/.test(s)) return 'food';
    if (/health|medical|hospital|disease|sick/.test(s)) return 'health';
    if (/weather|rain|temperature|climate|sun/.test(s)) return 'weather';
    return 'general';
  }

  // ── Data generators per theme ────────────────────────────────
  private themeData: Record<string, { labels: string[]; values: number[] }> = {
    coffee:   { labels: ['0 cups', '1 cup', '2 cups', '3 cups', '4 cups', '5+ cups'], values: [34, 62, 81, 89, 78, 55] },
    sleep:    { labels: ['<5h', '5h', '6h', '7h', '8h', '9h', '>10h'], values: [28, 42, 65, 95, 88, 70, 45] },
    animals:  { labels: ['Cats', 'Dogs', 'Fish', 'Birds', 'Rabbits', 'Reptiles'], values: [46, 69, 52, 38, 27, 14] },
    countries:{ labels: ['USA', 'China', 'Japan', 'Germany', 'UK', 'Brazil', 'India'], values: [82, 77, 89, 85, 80, 63, 71] },
    movies:   { labels: ['Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi', 'Romance'], values: [88, 74, 66, 52, 79, 61] },
    music:    { labels: ['Pop', 'Hip-Hop', 'Rock', 'Electronic', 'Jazz', 'Classical'], values: [91, 84, 72, 67, 45, 38] },
    sports:   { labels: ['Football', 'Basketball', 'Soccer', 'Tennis', 'Baseball', 'Golf'], values: [79, 75, 88, 62, 58, 44] },
    economy:  { labels: ['2018', '2019', '2020', '2021', '2022', '2023'], values: [65, 72, 41, 58, 76, 84] },
    tech:     { labels: ['Mobile', 'Desktop', 'Tablet', 'Smart TV', 'Wearable', 'IoT'], values: [87, 76, 52, 43, 38, 31] },
    food:     { labels: ['Pizza', 'Burger', 'Tacos', 'Sushi', 'Pasta', 'Salad'], values: [82, 79, 74, 71, 68, 45] },
    health:   { labels: ['Exercise', 'Diet', 'Sleep', 'Stress', 'Genetics', 'Social'], values: [78, 82, 73, 65, 58, 69] },
    weather:  { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], values: [12, 14, 24, 42, 65, 78, 85, 83, 70, 52, 30, 15] },
    general:  { labels: ['Category A', 'Category B', 'Category C', 'Category D', 'Category E', 'Category F'], values: [65, 78, 52, 84, 71, 60] },
  };

  private buildConfig(type: ChartType, theme: string, labels: string[], values: number[]): GraphConfig {
    switch (type) {
      case 'bar': return this.barConfig(labels, values, theme);
      case 'line': return this.lineConfig(labels, values, theme);
      case 'scatter': return this.scatterConfig(theme);
      case 'doughnut': return this.doughnutConfig(labels, values, theme);
      case 'pie': return this.doughnutConfig(labels, values, theme, 'pie');
      case 'radar': return this.radarConfig(labels, values, theme);
      case 'bubble': return this.bubbleConfig(theme);
      case 'polarArea': return this.polarConfig(labels, values, theme);
      default: return this.barConfig(labels, values, theme);
    }
  }

  private barConfig(labels: string[], values: number[], theme: string): GraphConfig {
    const color = this.themeColor(theme);
    return {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Value',
          data: values,
          backgroundColor: values.map((_, i) => i % 2 === 0 ? color[0] : color[2]),
          borderColor: color[0],
          borderWidth: 0,
          borderRadius: 6,
        } as any],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 } } },
          y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 11 } } },
        },
      },
    };
  }

  private lineConfig(labels: string[], values: number[], theme: string): GraphConfig {
    const color = this.themeColor(theme);
    return {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Trend',
          data: values,
          borderColor: color[0],
          backgroundColor: color[0] + '22',
          borderWidth: 2.5,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: color[0],
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 } } },
          y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 11 } } },
        },
      },
    };
  }

  private scatterConfig(theme: string): GraphConfig {
    const color = this.themeColor(theme);
    const points = Array.from({ length: 20 }, (_, i) => ({
      x: Math.round(10 + Math.random() * 80),
      y: Math.round(20 + Math.random() * 70 + i * 0.6),
    }));
    return {
      type: 'scatter',
      data: {
        datasets: [{
          label: 'Data points',
          data: points,
          backgroundColor: color[0] + 'BB',
          pointRadius: 7,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 11 } } },
          y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 11 } } },
        },
      },
    };
  }

  private doughnutConfig(labels: string[], values: number[], theme: string, type: ChartType = 'doughnut'): GraphConfig {
    return {
      type,
      data: {
        labels: labels.slice(0, 6),
        datasets: [{
          label: 'Share',
          data: values.slice(0, 6),
          backgroundColor: ALL_COLORS.slice(0, 6),
          borderWidth: 2,
          borderColor: '#f4f5f8',
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 10, boxWidth: 12 } },
        },
        cutout: type === 'doughnut' ? '60%' : undefined,
      },
    };
  }

  private radarConfig(labels: string[], values: number[], theme: string): GraphConfig {
    const color = this.themeColor(theme);
    return {
      type: 'radar',
      data: {
        labels: labels.slice(0, 6),
        datasets: [{
          label: 'Score',
          data: values.slice(0, 6),
          borderColor: color[0],
          backgroundColor: color[0] + '33',
          borderWidth: 2,
          pointBackgroundColor: color[0],
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          r: {
            ticks: { font: { size: 10 }, backdropColor: 'transparent' },
            grid: { color: 'rgba(0,0,0,0.08)' },
            pointLabels: { font: { size: 11 } },
          },
        },
      },
    };
  }

  private bubbleConfig(theme: string): GraphConfig {
    const color = this.themeColor(theme);
    const points = Array.from({ length: 12 }, () => ({
      x: Math.round(10 + Math.random() * 80),
      y: Math.round(10 + Math.random() * 80),
      r: Math.round(4 + Math.random() * 18),
    }));
    return {
      type: 'bubble',
      data: {
        datasets: [{
          label: 'Bubble',
          data: points,
          backgroundColor: color[0] + '99',
          borderColor: color[0],
          borderWidth: 1,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: 'rgba(0,0,0,0.05)' } },
          y: { grid: { color: 'rgba(0,0,0,0.05)' } },
        },
      },
    };
  }

  private buildXYConfig(type: ChartType, theme: string, data: any[]): GraphConfig {
    const color = this.themeColor(theme);
    return {
      type,
      data: {
        datasets: [{
          label: 'Data',
          data,
          backgroundColor: color[0] + '99',
          borderColor: color[0],
          borderWidth: 1,
          pointRadius: type === 'scatter' ? 7 : undefined,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: 'rgba(0,0,0,0.05)' } },
          y: { grid: { color: 'rgba(0,0,0,0.05)' } },
        },
      },
    };
  }

  private polarConfig(labels: string[], values: number[], theme: string): GraphConfig {
    return {
      type: 'polarArea',
      data: {
        labels: labels.slice(0, 6),
        datasets: [{
          label: 'Value',
          data: values.slice(0, 6),
          backgroundColor: ALL_COLORS.slice(0, 6).map(c => c + 'CC'),
          borderWidth: 1,
          borderColor: '#fff',
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 8, boxWidth: 12 } },
        },
      },
    };
  }

  private themeColor(theme: string): string[] {
    const map: Record<string, string[]> = {
      coffee: PALETTE.amber,
      sleep:  PALETTE.purple,
      animals: PALETTE.teal,
      countries: PALETTE.blue,
      movies: PALETTE.coral,
      music:  PALETTE.pink,
      sports: PALETTE.teal,
      economy: PALETTE.blue,
      tech:   PALETTE.purple,
      food:   PALETTE.coral,
      health: PALETTE.teal,
      weather: PALETTE.blue,
      general: PALETTE.purple,
    };
    return map[theme] ?? PALETTE.purple;
  }

  // ── Title / insight / tags ───────────────────────────────────
  private buildTitle(prompt: string, type: ChartType): string {
    const clean = prompt.trim();
    if (clean.length <= 60) return this.capitalize(clean);
    return this.capitalize(clean.slice(0, 57)) + '…';
  }

  private capitalize(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  private insightTemplates: Record<string, string[]> = {
    coffee: [
      'Peak performance hits at 3–4 cups — after that, the jitters take over.',
      'There\'s a sweet spot around 3 cups where productivity and chaos are perfectly balanced.',
    ],
    sleep: [
      '7 hours appears to be the magic number — both fewer and more show similar drop-offs.',
      'Contrary to hustle culture, sleeping more than 6 hours actually correlates with better outcomes.',
    ],
    animals: [
      'Dog owners report 23% higher outdoor activity, yet cats dominate internet traffic.',
      'Fish ownership is wildly underrated — silent, low-maintenance, and weirdly calming.',
    ],
    countries: [
      'There\'s a surprising consistency across nations that defies most cultural stereotypes.',
      'The outliers here tell a more interesting story than the averages.',
    ],
    movies: [
      'Action dominates, yet critical darlings are almost always dramas. The gap is real.',
      'Horror fans are the most loyal genre audience by a significant margin.',
    ],
    general: [
      'Category D is the unexpected overperformer — no obvious reason, just pure data.',
      'The gap between the top and bottom is larger than intuition would suggest.',
      'If you squint at this chart, you can almost see a pattern. Almost.',
    ],
  };

  private buildInsight(theme: string, type: ChartType, prompt: string): string {
    const templates = this.insightTemplates[theme] ?? this.insightTemplates['general'];
    const base = templates[Math.floor(Math.random() * templates.length)];
    const scatterSuffix = type === 'scatter' ? ' The correlation coefficient is a suspiciously round 0.74.' : '';
    return base + scatterSuffix;
  }

  private buildTags(s: string): string[] {
    const tags: string[] = [];
    if (/weird|strange|bizarre|odd|unusual|spurious/.test(s)) tags.push('weird');
    if (/correlation|vs|versus|relationship/.test(s)) tags.push('correlation');
    if (/country|world|global|nation/.test(s)) tags.push('global');
    if (/science|study|research|data/.test(s)) tags.push('data');
    if (/trend|growth|decline|over time/.test(s)) tags.push('trend');
    if (tags.length === 0) tags.push('stats');
    return tags.slice(0, 3);
  }

  private calcWeirdScore(s: string): number {
    let score = 3;
    if (/weird|bizarre|strange|spurious|random|coincidence/.test(s)) score += 4;
    if (/nicolas cage|toilet|pizza|moon|cheese|pigeon/.test(s)) score += 3;
    if (/correlation|vs|versus/.test(s)) score += 2;
    if (/country|world|global/.test(s)) score += 1;
    return Math.min(score, 10);
  }

  getSuggestions(): string[] {
    return [
      'Nicolas Cage movies vs swimming pool drownings per year',
      'Correlation between country name length and GDP per capita',
      'Coffee consumption by programming language',
      'Sleep hours vs life satisfaction by age group',
      'Dog ownership rate vs national happiness index',
      'Number of Ikea stores vs divorce rate by country',
      'Pizza consumption trend over the last 20 years',
      'Productivity by time of day for different professions',
      'Cat videos watched vs work-from-home adoption',
      'Ice cream sales vs shark attacks by month',
    ];
  }
}
