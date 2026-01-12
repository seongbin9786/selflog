import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface FlowStatusChartProps {
  data: {
    name: string;
    giveup: number;
    boring: number;
    tryAgain: number;
    totalSurrender: number;
    totalTryAgain: number;
  }[];
  ratio: {
    totalSurrenderRatio: number;
    actualSurrenderRatio: number;
    totalTryAgainRatio: number;
  };
}

export const FlowStatusChart = ({ data, ratio }: FlowStatusChartProps) => {
  const lastMinute = data[data.length - 1];
  const { totalSurrender, totalTryAgain } = lastMinute;
  const actualSurrender = totalSurrender + totalTryAgain;
  const { totalSurrenderRatio, actualSurrenderRatio, totalTryAgainRatio } =
    ratio;

  return (
    <div className="h-full w-full">
      <div style={{ display: 'flex', gap: 4 }}>
        <span style={{ color: 'blue' }}>
          포기: {totalSurrender} (상위 {totalSurrenderRatio}%)
        </span>
        <span style={{ color: 'red' }}>
          실질 포기: {actualSurrender} (상위 {actualSurrenderRatio}%)
        </span>
        <span style={{ color: 'green' }}>
          재시도: {totalTryAgain * -1} (상위 {totalTryAgainRatio}%)
        </span>
      </div>
      <ResponsiveContainer width="80%" height="70%">
        <ComposedChart
          stackOffset="sign"
          width={500}
          height={300}
          data={data}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <ReferenceLine y={0} stroke="#000" />
          <Bar stackId="1" dataKey="giveup" name="어려움" fill="red" />
          <Bar stackId="1" dataKey="boring" name="지루함" fill="gray" />
          <Line
            type="monotone"
            dataKey="totalSurrender"
            name="누적 포기"
            stroke="orange"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey={(o) => o.totalSurrender + o.totalTryAgain}
            name="누적 실질 포기"
            stroke="red"
            dot={false}
          />
          <Bar stackId="1" dataKey="tryAgain" name="재시도" fill="green" />
          <Line
            type="monotone"
            dataKey="totalTryAgain"
            name="누적 재시도"
            stroke="green"
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};
