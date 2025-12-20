import { useSelector } from 'react-redux';

import { DayNavigator } from '../components/days/DayNavigator';
import { TextLogContainer } from '../components/texts/TextLogContainer';
import { Area_AvailableRestTimeChart } from '../features/AvailableRestTimeChartArea';
import { Area_ProductivePaceChart } from '../features/ProductivePaceChartArea';
import { RootState } from '../store';

export const LogWriterPage = () => {
  // 바로 다음 컴포넌트이니 직접 주입, redux 의존성 낮추기 위함.
  const logsForCharts = useSelector(
    (state: RootState) => state.logs.logsForCharts,
  );

  const { currentDate } = useSelector((state: RootState) => state.logs);

  return (
    <div className="mx-auto flex h-screen min-w-[400px] max-w-screen-xl flex-col p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xs font-bold sm:text-sm">
          [기록지] ({currentDate})
        </h1>
        <DayNavigator />
      </div>
      <div className="my-0 grid min-h-0 flex-1 grid-cols-1 grid-rows-4 p-4 sm:grid-cols-2 sm:grid-rows-2">
        <TextLogContainer />
        <div>hello</div>
        <Area_AvailableRestTimeChart logsForCharts={logsForCharts} />
        <Area_ProductivePaceChart logsForCharts={logsForCharts} />
      </div>
    </div>
  );
};
