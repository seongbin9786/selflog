import { AvailableRestTimeChart } from '../components/charts/AvailableRestTimeChart';
import { TimeSummary } from '../components/texts/TimeSummary';
import { Log } from '../utils/PaceUtil';

/**
 * AvailableRestTime 차트 + 같이 표시 될 시간 정보를 포함하는 영역
 */
export const Area_AvailableRestTimeChart = ({
  logsForCharts,
}: {
  logsForCharts: Log[];
}) => (
  <div className="flex flex-col gap-2">
    <div className="h-10">
      <h1 className="text-sm font-bold">[초과 휴식 시간]</h1>
      <TimeSummary logs={logsForCharts} />
    </div>
    <AvailableRestTimeChart logs={logsForCharts} />
  </div>
);
