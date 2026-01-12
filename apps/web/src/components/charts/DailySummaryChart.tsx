import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { getSummary } from '../../utils/DailySummaryUtil';

// 이 데이터를 어떻게 가져올지도 고민해야 함
// 데이터를 얼마나 가져올지 UI도 고민해야 함
const data = getSummary();

const gradientOffset = () => {
  const dataMax = Math.max(
    ...data.map((d) => d.productiveMinutes - d.wastedMinutes),
  );
  const dataMin = Math.min(
    ...data.map((d) => d.productiveMinutes - d.wastedMinutes),
  );

  if (dataMax <= 0) {
    return 0;
  }
  if (dataMin >= 0) {
    return 1;
  }

  return dataMax / (dataMax - dataMin);
};

const off = gradientOffset();

export const DailySummaryChart = () => {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={data}
        margin={{
          top: 5,
          right: 30,
          left: 20,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar name="생산 시간" dataKey="productiveMinutes" fill="#a7ffa7" />
        <Bar
          name="소비 시간"
          dataKey={(d) => d.wastedMinutes * -1}
          fill="#ffc4c4"
        />

        <defs>
          <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="1">
            <stop offset={off} stopColor="green" stopOpacity={1} />
            <stop offset={off} stopColor="red" stopOpacity={1} />
          </linearGradient>
        </defs>
        <Area
          name="합계 시간"
          dataKey={(d) => d.productiveMinutes - d.wastedMinutes}
          fill="url(#splitColor)"
          stroke="url(#splitColor)"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
};
