import {
  Area,
  AreaChart,
  CartesianGrid,
  Label,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { minutesToTimeString } from '../../utils/DateUtil';
import { Log } from '../../utils/PaceUtil';

interface AvailableRestTimeChartProps {
  logs: Log[];
}

const X_AXIS_PADDING = 30; // 분 단위

export const AvailableRestTimeChart = ({
  logs,
}: AvailableRestTimeChartProps) => {
  const data = logs.map(({ offset, productive, wasted }) => ({
    offset,
    productive,
    wasted,
    need: wasted - productive,
  }));

  const gradientOffset = calculateGradientOffset(data);
  const { highPoint, lowPoint } = findHighLowPoints(data);
  const yAxisConfig = getNormalizedYAxisTicks(data);
  const currentPointConfig = getCurrentPointConfig(data, highPoint, lowPoint);

  // X축 범위 계산: 데이터의 최소/최대 시각에 패딩 추가
  const { minOffset, maxOffset } = getMinMaxOffset(data);
  const customXAxisDomainForPaddingX = [
    minOffset - X_AXIS_PADDING,
    maxOffset + X_AXIS_PADDING,
  ];

  return (
    <ResponsiveContainer className="min-h-0">
      <AreaChart
        data={data}
        margin={{
          top: 30,
          right: 30,
          left: 0,
          bottom: 30,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="offset"
          type="number"
          tick={{ fontSize: 16 }}
          tickFormatter={minutesToTimeString}
          domain={customXAxisDomainForPaddingX}
        />
        <YAxis
          tick={{ fontSize: 16 }}
          domain={yAxisConfig.domain}
          ticks={yAxisConfig.ticks}
        />
        <Tooltip labelFormatter={minutesToTimeString} />
        <defs>
          <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="1">
            <stop offset={gradientOffset} stopColor="red" stopOpacity={1} />
            <stop offset={gradientOffset} stopColor="green" stopOpacity={1} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="need"
          unit="min"
          stroke="#000"
          fill="url(#splitColor)"
        />
        {highPoint && (
          <ReferenceDot
            x={highPoint.offset}
            y={highPoint.need}
            r={5}
            fill="red"
            stroke="white"
            strokeWidth={2}
          >
            <Label
              value={formatMinutesWithSign(highPoint.need)}
              position="top"
              fill="red"
              fontSize={14}
              fontWeight="bold"
            />
          </ReferenceDot>
        )}
        {lowPoint && (
          <ReferenceDot
            x={lowPoint.offset}
            y={lowPoint.need}
            r={5}
            fill="green"
            stroke="white"
            strokeWidth={2}
          >
            <Label
              value={formatMinutesWithSign(lowPoint.need)}
              position="bottom"
              fill="green"
              fontSize={14}
              fontWeight="bold"
            />
          </ReferenceDot>
        )}
        {currentPointConfig.shouldShow && currentPointConfig.point && (
          <ReferenceDot
            x={currentPointConfig.point.offset}
            y={currentPointConfig.point.need}
            r={6}
            fill={currentPointConfig.color}
            stroke="white"
            strokeWidth={2}
          >
            <Label
              value={formatMinutesWithSign(currentPointConfig.point.need)}
              position={currentPointConfig.position}
              fill={currentPointConfig.color}
              fontSize={14}
              fontWeight="bold"
            />
          </ReferenceDot>
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
};

type ChartDataPoint = {
  offset: number;
  productive: number;
  wasted: number;
  need: number;
};

function calculateGradientOffset(data: ChartDataPoint[]): number {
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

function findHighLowPoints(data: ChartDataPoint[]) {
  if (data.length === 0) {
    return { highPoint: null, lowPoint: null };
  }

  const highPoint = data.reduce((max, point) =>
    point.need > max.need ? point : max,
  );
  const lowPoint = data.reduce((min, point) =>
    point.need < min.need ? point : min,
  );

  return { highPoint, lowPoint };
}

function formatMinutesWithSign(minutes: number): string {
  const absMinutes = Math.abs(minutes);
  return minutesToTimeString(absMinutes);
}

function isSamePoint(
  point1: ChartDataPoint | null,
  point2: ChartDataPoint | null,
): boolean {
  if (!point1 || !point2) return false;
  return point1.offset === point2.offset;
}

function getMinMaxOffset(data: ChartDataPoint[]): {
  minOffset: number;
  maxOffset: number;
} {
  if (data.length === 0) {
    return { minOffset: 8 * 60, maxOffset: 27 * 60 }; // 기본값: 08:00 ~ 27:00
  }

  let min = data[0].offset;
  let max = data[0].offset;

  for (const point of data) {
    if (point.offset < min) min = point.offset;
    if (point.offset > max) max = point.offset;
  }

  return { minOffset: min, maxOffset: max };
}

type CurrentPointConfig = {
  point: ChartDataPoint | null;
  shouldShow: boolean;
  color: 'red' | 'green';
  position: 'top' | 'bottom';
};

function getCurrentPointConfig(
  data: ChartDataPoint[],
  highPoint: ChartDataPoint | null,
  lowPoint: ChartDataPoint | null,
): CurrentPointConfig {
  const point = data.length > 0 ? data[data.length - 1] : null;

  if (!point) {
    return {
      point: null,
      shouldShow: false,
      color: 'red',
      position: 'top',
    };
  }

  const shouldShow =
    !isSamePoint(point, highPoint) && !isSamePoint(point, lowPoint);
  const color = point.need >= 0 ? 'red' : 'green';
  const position = point.need >= 0 ? 'top' : 'bottom';

  return { point, shouldShow, color, position };
}

function getNormalizedYAxisTicks(data: ChartDataPoint[]) {
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
