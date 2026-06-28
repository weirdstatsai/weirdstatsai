import { Component, Input } from '@angular/core';
import { ChartType, GraphConfig } from '../../models/graph.model';

@Component({
  selector: 'app-mini-chart',
  templateUrl: './mini-chart.component.html',
  styleUrls: ['./mini-chart.component.scss'],
})
export class MiniChartComponent {
  type: ChartType = 'bar';
  barHeights: number[] = [];
  linePoints = '';
  areaPoints = '';
  ringDashArray = '';

  private static readonly RING_CIRCUMFERENCE = 2 * Math.PI * 16;

  @Input() set config(value: GraphConfig | undefined) {
    if (!value) return;
    this.type = value.type;
    this.compute(value);
  }

  private compute(config: GraphConfig): void {
    const series = this.numericSeries(config);

    if (this.type === 'line' || this.type === 'scatter' || this.type === 'bubble') {
      this.computeLine(series);
    } else if (this.type === 'doughnut' || this.type === 'pie' || this.type === 'radar' || this.type === 'polarArea') {
      this.computeRing(series);
    } else {
      this.computeBars(series);
    }
  }

  private numericSeries(config: GraphConfig): number[] {
    const data = config.data.datasets[0]?.data ?? [];
    return data.map(d => (typeof d === 'number' ? d : d.y));
  }

  private computeBars(series: number[]): void {
    const max = Math.max(...series, 1);
    this.barHeights = series.slice(0, 6).map(v => Math.max((v / max) * 28, 4));
  }

  private computeLine(series: number[]): void {
    const max = Math.max(...series);
    const min = Math.min(...series);
    const range = max - min || 1;
    const step = series.length > 1 ? 56 / (series.length - 1) : 0;

    const points = series
      .map((v, i) => `${4 + i * step},${38 - ((v - min) / range) * 32}`)
      .join(' ');

    this.linePoints = points;
    this.areaPoints = `4,40 ${points} 60,40`;
  }

  private computeRing(series: number[]): void {
    const total = series.reduce((sum, v) => sum + v, 0) || 1;
    const percent = series.length ? series[0] / total : 0.5;
    const filled = MiniChartComponent.RING_CIRCUMFERENCE * percent;
    this.ringDashArray = `${filled} ${MiniChartComponent.RING_CIRCUMFERENCE}`;
  }
}
