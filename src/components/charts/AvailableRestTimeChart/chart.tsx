import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { minutesToTimeString } from '../../../utils/DateUtil';
import { Log } from '../../../utils/PaceUtil';
import { getMinMaxXAxisDomain, getNormalizedYAxisTicks } from './axisUtil';
import { getChartDataPoints } from './dataPoint';
import { calculateGradientOffset } from './offsetUtil';
import { getPoints } from './points';

interface AvailableRestTimeChartProps {
  logs: Log[];
}

export const AvailableRestTimeChart = ({
  logs,
}: AvailableRestTimeChartProps) => {
  const data = getChartDataPoints(logs);
  const gradientOffset = calculateGradientOffset(data);
  const yAxisConfig = getNormalizedYAxisTicks(data);

  // X축 범위 계산: 데이터의 최소/최대 시각에 패딩 추가
  const { minXAxisDomain, maxXAxisDomain } = getMinMaxXAxisDomain(data);

  const gradientId = 'availableRestTimeSplitColor';

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
          domain={[minXAxisDomain, maxXAxisDomain]}
        />
        <YAxis
          tick={{ fontSize: 16 }}
          domain={yAxisConfig.domain}
          ticks={yAxisConfig.ticks}
          tickFormatter={(value) => `${value}`}
        />
        <Tooltip
          labelFormatter={minutesToTimeString}
          formatter={(value: any) => [`${value}분`, '초과 휴식']}
        />
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset={gradientOffset} stopColor="red" stopOpacity={1} />
            <stop offset={gradientOffset} stopColor="green" stopOpacity={1} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="need"
          unit="min"
          stroke="#000"
          fill={`url(#${gradientId})`}
        />
        {getPoints(data)}
      </AreaChart>
    </ResponsiveContainer>
  );
};
