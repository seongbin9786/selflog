import { ChartDataPoint } from './dataPoint';

export function calculateGradientOffset(data: ChartDataPoint[]): number {
  const dataMax = Math.max(...data.map((i) => i.need));
  const dataMin = Math.min(...data.map((i) => i.need));

  if (dataMax <= 0) {
    return 0;
  }
  if (dataMin >= 0) {
    return 1;
  }

  return dataMax / (dataMax - dataMin);
}
