export type ChartType = 'bar' | 'line' | 'scatter' | 'doughnut' | 'pie' | 'radar' | 'bubble' | 'polarArea';

export interface GraphConfig {
  type: ChartType;
  data: {
    labels?: string[];
    datasets: {
      label: string;
      data: number[] | { x: number; y: number; r?: number }[];
      backgroundColor?: string | string[];
      borderColor?: string | string[];
      borderWidth?: number;
      fill?: boolean;
      tension?: number;
      pointRadius?: number;
      pointBackgroundColor?: string | string[];
    }[];
  };
  options?: Record<string, unknown>;
}

export interface GraphUiMeta {
  category: string;
  visualTheme: string;
  accentColor: string;
  backgroundPattern: string;
  icon: string;
  cardType: 'big-number' | 'chart-first' | 'ranking' | 'versus' | 'map-region' | 'timeline' | 'fact' | 'poll' | 'compact-chart';
  insightBadge: string;
  shareTitle: string;
}

export interface Graph {
  id: string;
  title: string;
  prompt: string;
  type: ChartType;
  config: GraphConfig;
  insight: string;
  tags: string[];
  createdAt: Date;
  saved: boolean;
  shared: boolean;
  weirdScore: number; // 1-10, how weird is this stat
  relatedSuggestions?: string[];
  alternatives?: Graph[];
  uiMeta?: GraphUiMeta;
}
