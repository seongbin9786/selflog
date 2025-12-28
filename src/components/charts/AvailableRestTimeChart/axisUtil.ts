import { ChartDataPoint } from './dataPoint';

export function getNormalizedYAxisTicks(data: ChartDataPoint[]) {
  if (data.length === 0) {
    return { domain: [0, 0], ticks: [0] };
  }

  // 1. 데이터 범위 파악
  const values = data.map((d) => d.need);
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);

  // 2. 여유 공간 추가 (고점/저점 라벨이 잘리지 않도록)
  const range = maxValue - minValue;
  const padding = Math.max(range * 0.2, 20);

  // 3. 50 단위로 반올림하여 깔끔한 범위 계산
  const TICK_STEP = 50;
  const minWithPadding =
    Math.floor((minValue - padding) / TICK_STEP) * TICK_STEP;
  const maxWithPadding =
    Math.ceil((maxValue + padding) / TICK_STEP) * TICK_STEP;

  // 4. 0을 무조건 포함
  const domainMin = Math.min(0, minWithPadding);
  const domainMax = Math.max(0, maxWithPadding);

  // 5. 50 단위 눈금 생성
  const ticks: number[] = [];
  for (let value = domainMin; value <= domainMax; value += TICK_STEP) {
    ticks.push(value);
  }

  return { domain: [domainMin, domainMax], ticks };
}

const X_AXIS_PADDING = 30; // 분 단위

export function getMinMaxXAxisDomain(data: ChartDataPoint[]): {
  minXAxisDomain: number;
  maxXAxisDomain: number;
} {
  if (data.length === 0) {
    return {
      minXAxisDomain: 8 * 60 - X_AXIS_PADDING,
      maxXAxisDomain: 27 * 60 + X_AXIS_PADDING,
    }; // 기본값: 08:00 ~ 27:00
  }

  let min = data[0].offset;
  let max = data[0].offset;

  for (const point of data) {
    if (point.offset < min) min = point.offset;
    if (point.offset > max) max = point.offset;
  }

  return {
    minXAxisDomain: min - X_AXIS_PADDING,
    maxXAxisDomain: max + X_AXIS_PADDING,
  };
}
