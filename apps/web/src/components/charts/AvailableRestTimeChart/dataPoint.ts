import { Log } from '../../../utils/PaceUtil';

export interface ChartDataPoint {
  offset: number;
  productive: number;
  wasted: number;
  need: number;
}

export const getChartDataPoints = (logs: Log[]): ChartDataPoint[] => {
  return logs.map(({ offset, productive, wasted }) => ({
    offset,
    productive,
    wasted,
    need: wasted - productive,
  }));
};
