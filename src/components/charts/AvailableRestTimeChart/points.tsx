import { Label, ReferenceDot } from 'recharts';

import { minutesToTimeString } from '../../../utils/DateUtil';
import type { ChartDataPoint } from './dataPoint';

export const getPoints = (data: ChartDataPoint[]) => {
  const { highPoint, lowPoint } = findHighLowPoints(data);
  const currentPointConfig = getCurrentPointConfig(data, highPoint, lowPoint);

  const points: JSX.Element[] = [];

  if (highPoint) {
    points.push(
      <ReferenceDot
        key="high"
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
      </ReferenceDot>,
    );
  }

  if (lowPoint) {
    points.push(
      <ReferenceDot
        key="low"
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
      </ReferenceDot>,
    );
  }

  if (currentPointConfig.shouldShow && currentPointConfig.point) {
    points.push(
      <ReferenceDot
        key="current"
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
      </ReferenceDot>,
    );
  }

  return points;
};

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

const NEAR_POINT_THRESHOLD = 6;

function isNearPoint(
  point1: ChartDataPoint | null,
  point2: ChartDataPoint | null,
): boolean {
  if (!point1 || !point2) {
    return false;
  }
  return Math.abs(point1.offset - point2.offset) < NEAR_POINT_THRESHOLD;
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
  const currPoint = data.length > 0 ? data[data.length - 1] : null;
  if (!currPoint) {
    return {
      point: null,
      shouldShow: false,
      color: 'red',
      position: 'top',
    };
  }

  const shouldShow =
    !isNearPoint(currPoint, highPoint) && !isNearPoint(currPoint, lowPoint);
  const color = currPoint.need >= 0 ? 'red' : 'green';
  const position = currPoint.need >= 0 ? 'top' : 'bottom';

  return { point: currPoint, shouldShow, color, position };
}
