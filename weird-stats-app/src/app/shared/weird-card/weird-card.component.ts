import { Component, Input } from '@angular/core';
import { WeirdCard } from '../../models/weird-card.model';
import { RankStyle } from '../cards/card-ranking/card-ranking.component';
import { KpiStyle } from '../cards/card-kpi/card-kpi.component';
import { TableStyle } from '../cards/card-table/card-table.component';
import { VersusStyle } from '../cards/card-versus/card-versus.component';
import { MapStyle } from '../cards/card-map/card-map.component';

const RANK_STYLES: RankStyle[] = ['bars', 'pill', 'percent', 'vertical', 'circular', 'sparkline'];
const KPI_STYLES: KpiStyle[] = ['default', 'circular', 'comparison', 'hero'];
const TABLE_STYLES: TableStyle[] = ['pill', 'bars', 'rows'];
const VERSUS_STYLES: VersusStyle[] = ['default', 'mirror', 'progress', 'winner'];
const MAP_STYLES: MapStyle[] = ['choropleth', 'pins', 'bubbles'];

@Component({
  selector: 'app-weird-card',
  templateUrl: './weird-card.component.html',
  styleUrls: ['./weird-card.component.scss'],
})
export class WeirdCardComponent {
  @Input() card!: WeirdCard;
  @Input() size: 'feed' | 'full' | 'alt' = 'feed';
  @Input() fontSize: 'small' | 'medium' | 'large' = 'medium';

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

  /** Map the chart's two points into a comparison-KPI card: latest = the hero
   *  value, earliest = the labelled benchmark. */
  get comparisonCard(): WeirdCard {
    const data = this.card.datasets[0].data;
    const labels = this.card.labels;
    const name = this.card.metric?.name || this.card.title;
    const unit = this.card.metric?.unit || '';
    return {
      ...this.card,
      metric: { ...this.card.metric, name, unit, value: data[1] },
      rows: [
        { rank: null, label: name, value: data[1], unit, extra: '' },
        { rank: null, label: labels[0], value: data[0], unit, extra: '' },
      ],
    };
  }

  get rankStyle(): RankStyle {
    const s = this.selectedStyle;
    return (s && RANK_STYLES.includes(s as RankStyle)) ? (s as RankStyle) : 'bars';
  }

  get kpiStyle(): KpiStyle {
    const s = this.selectedStyle;
    const style = (s && KPI_STYLES.includes(s as KpiStyle)) ? (s as KpiStyle) : 'default';
    // Comparison needs a genuine second value; without one it would fabricate a
    // benchmark, so fall back to the clean single-value default.
    if (style === 'comparison' && this.card?.rows?.[1]?.value == null) return 'default';
    return style;
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
}
