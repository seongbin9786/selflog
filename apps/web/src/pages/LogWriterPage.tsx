import { Bell, Timer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { AuthHeader } from '../components/auth/AuthHeader';
import { ConflictDialog } from '../components/common/ConflictDialog';
import { DataManagementButton } from '../components/dataManagement/DataManagementButton';
import { DayNavigator } from '../components/days/DayNavigator';
import { TextLogContainer } from '../components/texts/TextLogContainer';
import { Area_AvailableRestTimeChart } from '../features/AvailableRestTimeChartArea';
import { DataManagementDialog } from '../features/dataManagement/DataManagementDialog';
import { Area_ProductivePaceChart } from '../features/ProductivePaceChartArea';
import {
  useRemainingTime,
  useRestNotification,
} from '../features/restNotification';
import { SoundSettingsDialog } from '../features/soundSettings';
import { ThemeSelector } from '../features/theme/ThemeSelector';
import { RootState } from '../store';
import { triggerCurrentDateFetch } from '../store/logs';

export const LogWriterPage = () => {
  // 휴식 알림 시스템 활성화
  useRestNotification();
  const dispatch = useDispatch();

  const [isSoundSettingsOpen, setIsSoundSettingsOpen] = useState(false);
  const [isDataManagementOpen, setIsDataManagementOpen] = useState(false);

  // 바로 다음 컴포넌트이니 직접 주입, redux 의존성 낮추기 위함.
  const logsForCharts = useSelector(
    (state: RootState) => state.logs.logsForCharts,
  );

  const { currentDate } = useSelector((state: RootState) => state.logs);
  const currentNotification = useSelector(
    (state: RootState) => state.restNotification.currentNotification,
  );
  const isAuthenticated = useSelector(
    (state: RootState) => state.auth.isAuthenticated,
  );

  // 로그인 상태에서 현재 날짜를 서버와 즉시 동기화
  useEffect(() => {
    if (isAuthenticated) {
      dispatch(triggerCurrentDateFetch());
    }
  }, [dispatch, isAuthenticated]);

  // 잔여 시간 계산
  const { remainingTime, isOvertime } = useRemainingTime(currentNotification);

  return (
    <div className="mx-auto flex h-screen min-w-[400px] max-w-screen-xl flex-col p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xs font-bold sm:text-sm">
            [기록지] ({currentDate})
          </h1>
          {currentNotification && (
            <div
              className={`badge badge-lg gap-2 ${isOvertime ? 'badge-error animate-pulse' : 'badge-success'}`}
            >
              <Timer size={16} />
              잔여 휴식 시간: {remainingTime}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <DayNavigator />
          <button
            type="button"
            className="btn btn-circle btn-ghost"
            onClick={() => setIsSoundSettingsOpen(true)}
            title="알림음 설정"
          >
            <Bell size={16} />
          </button>

          <DataManagementButton onClick={() => setIsDataManagementOpen(true)} />
          <ThemeSelector />
          <AuthHeader />
        </div>
      </div>
      <div className="my-0 grid min-h-0 flex-1 grid-cols-1 grid-rows-4 p-4 sm:grid-cols-2 sm:grid-rows-2">
        <TextLogContainer />
        <div>hello</div>
        <Area_AvailableRestTimeChart logsForCharts={logsForCharts} />
        <Area_ProductivePaceChart logsForCharts={logsForCharts} />
      </div>

      <SoundSettingsDialog
        isOpen={isSoundSettingsOpen}
        onClose={() => setIsSoundSettingsOpen(false)}
      />
      <DataManagementDialog
        isOpen={isDataManagementOpen}
        onClose={() => setIsDataManagementOpen(false)}
      />
      <ConflictDialog />
    </div>
  );
};
