import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { minutesToTimeString } from '../../utils/DateUtil';
import { Log } from '../../utils/PaceUtil';

interface ProductivePaceChartProps {
  data: Log[];
  totalAvg: number;
  todayAvg: number;
  targetPace: number;
}

export const ProductivePaceChart = ({
  data,
  totalAvg,
  todayAvg,
  targetPace,
}: ProductivePaceChartProps) => {
  return (
    <ResponsiveContainer className="min-h-0">
      <AreaChart
        data={data}
        margin={{
          top: 10,
          right: 30,
          left: 0,
          bottom: 0,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="offset"
          type="number"
          tick={{ fontSize: 16 }}
          tickFormatter={minutesToTimeString}
          domain={[8 * 60, 27 * 60]}
        />
        <YAxis
          domain={[0, 60]}
          allowDataOverflow={true}
          tick={{ fontSize: 16 }}
        />
        <Tooltip labelFormatter={minutesToTimeString} />
        <ReferenceLine
          y={targetPace}
          stroke="red"
          label={{ value: `목표: ${targetPace}min/h`, fontSize: 16 }}
        />
        <ReferenceLine
          y={totalAvg}
          stroke="blue"
          label={{
            value: `[미지원] 전체 평균(${totalAvg}min/h)`,
            fontSize: 16,
          }}
        />
        <ReferenceLine
          y={todayAvg}
          stroke="green"
          label={{ value: `오늘 평균(${todayAvg}min/h)`, fontSize: 16 }}
        />
        <Area
          type="monotone"
          dataKey={(o) => o.pace}
          unit="min/h"
          stroke="darkgreen"
          fill="green"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};
