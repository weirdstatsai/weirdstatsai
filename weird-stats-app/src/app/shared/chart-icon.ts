import { ChartType } from '../models/graph.model';

const CHART_TYPE_ICONS: Record<ChartType, string> = {
  bar: 'bar-chart-outline',
  line: 'trending-up-outline',
  scatter: 'analytics-outline',
  doughnut: 'pie-chart-outline',
  pie: 'pie-chart-outline',
  radar: 'radio-outline',
  bubble: 'ellipse-outline',
  polarArea: 'albums-outline',
};

export function chartTypeIcon(type: ChartType): string {
  return CHART_TYPE_ICONS[type] ?? 'bar-chart-outline';
}
