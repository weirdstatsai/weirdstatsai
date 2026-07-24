import { Component, Input } from '@angular/core';
import { WeirdCard } from '../../models/weird-card.model';
import { RankStyle } from '../cards/card-ranking/card-ranking.component';
import { KpiStyle } from '../cards/card-kpi/card-kpi.component';
import { TableStyle } from '../cards/card-table/card-table.component';
import { VersusStyle } from '../cards/card-versus/card-versus.component';
import { MapStyle } from '../cards/card-map/card-map.component';
import { FactStyle } from '../cards/card-fact/card-fact.component';

const RANK_STYLES: RankStyle[] = ['bars', 'pill', 'percent', 'vertical', 'circular', 'sparkline', 'list'];
const KPI_STYLES: KpiStyle[] = [
  'default', 'circular', 'comparison', 'hero',
  'sparkline', 'progress', 'gauge', 'delta',
];
const TABLE_STYLES: TableStyle[] = ['pill', 'bars', 'rows'];
const VERSUS_STYLES: VersusStyle[] = ['default', 'mirror', 'progress', 'winner'];
const MAP_STYLES: MapStyle[] = ['choropleth', 'pins', 'bubbles'];
const FACT_STYLE_KEYS: FactStyle[] = ['poster', 'editorial', 'split'];

@Component({
  selector: 'app-weird-card',
  templateUrl: './weird-card.component.html',
  styleUrls: ['./weird-card.component.scss'],
})
export class WeirdCardComponent {
  @Input() card!: WeirdCard;
  @Input() size: 'feed' | 'full' | 'alt' = 'feed';
  /** Offscreen capture frames pass false so no draw-on lands mid-flight. */
  @Input() animate = true;

  // Whichever alternative style the owner picked (stored in uiMeta.selectedStyle
  // when they browsed alternatives on the card-detail page) is what the feed
  // renders — falls back to each card component's own default otherwise.
  private get selectedStyle(): string | undefined {
    return this.card?.uiMeta?.selectedStyle;
  }

  // A chart with exactly two time-points (e.g. 1,114 -> 1,864) can be shown as a
  // comparison KPI. Offered as an alternative on the card-detail page.
  private get is2PointChart(): boolean {
    return this.card?.cardType === 'chart'
      && this.card.datasets?.[0]?.data?.length === 2
      && this.card.labels?.length === 2;
  }

  get renderChartAsComparison(): boolean {
    return this.is2PointChart && this.selectedStyle === 'comparison';
  }

  /** Which of the two points is the "current" one. The data isn't guaranteed to
   *  be oldest-first, so infer recency from the labels; default to the 2nd. */
  private get latestIdx(): number {
    const labels = (this.card.labels || []).slice(0, 2).map(l => (l || '').toLowerCase());
    const now = labels.findIndex(l => /\b(now|today|current|present|latest)\b/.test(l));
    if (now >= 0) return now;
    const ago = labels.findIndex(l => /ago|prev|previous|\bthen\b|past|before|earlier/.test(l));
    if (ago >= 0) return ago === 0 ? 1 : 0;
    const yr = labels.map(l => { const m = l.match(/(?:19|20)\d{2}/); return m ? +m[0] : NaN; });
    if (!isNaN(yr[0]) && !isNaN(yr[1]) && yr[0] !== yr[1]) return yr[1] > yr[0] ? 1 : 0;
    return 1;
  }

  /** Map the chart's two points into a comparison-KPI card: the current point is
   *  the hero value, the other is the labelled benchmark. */
  get comparisonCard(): WeirdCard {
    const data = this.card.datasets[0].data;
    const labels = this.card.labels;
    const cur = this.latestIdx;
    const past = cur === 0 ? 1 : 0;
    const name = this.card.metric?.name || this.card.title;
    const unit = this.card.metric?.unit || '';
    return {
      ...this.card,
      metric: { ...this.card.metric, name, unit, value: data[cur] },
      rows: [
        { rank: null, label: name, value: data[cur], unit, extra: '' },
        { rank: null, label: labels[past], value: data[past], unit, extra: '' },
      ],
    };
  }

  get rankStyle(): RankStyle {
    const s = this.selectedStyle;
    return (s && RANK_STYLES.includes(s as RankStyle)) ? (s as RankStyle) : 'bars';
  }

  get kpiStyle(): KpiStyle {
    // Data requirements (benchmark, series, percent) are enforced inside
    // CardKpiComponent.effStyle, which demotes unsupported picks to 'default' —
    // here we only need to whitelist known style keys.
    const s = this.selectedStyle;
    return (s && KPI_STYLES.includes(s as KpiStyle)) ? (s as KpiStyle) : 'default';
  }

  get tableStyle(): TableStyle {
    const s = this.selectedStyle;
    return (s && TABLE_STYLES.includes(s as TableStyle)) ? (s as TableStyle) : 'pill';
  }

  get versusStyle(): VersusStyle {
    const s = this.selectedStyle;
    return (s && VERSUS_STYLES.includes(s as VersusStyle)) ? (s as VersusStyle) : 'default';
  }

  get mapStyle(): MapStyle {
    const s = this.selectedStyle;
    return (s && MAP_STYLES.includes(s as MapStyle)) ? (s as MapStyle) : 'choropleth';
  }

  get factStyle(): FactStyle {
    const s = this.selectedStyle;
    return (s && FACT_STYLE_KEYS.includes(s as FactStyle)) ? (s as FactStyle) : 'poster';
  }
}
