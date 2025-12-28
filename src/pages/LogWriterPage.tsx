import { Bell, Timer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';

import { DayNavigator } from '../components/days/DayNavigator';
import { SoundSettingsDialog } from '../components/dialogs/SoundSettingsDialog';
import { TextLogContainer } from '../components/texts/TextLogContainer';
import { Area_AvailableRestTimeChart } from '../features/AvailableRestTimeChartArea';
import { Area_ProductivePaceChart } from '../features/ProductivePaceChartArea';
import { ThemeSelector } from '../features/theme/ThemeSelector';
import { useRestNotification } from '../hooks/useRestNotification';
import { RootState } from '../store';

export const LogWriterPage = () => {
  // 휴식 알림 시스템 활성화
  useRestNotification();

  const [isSoundSettingsOpen, setIsSoundSettingsOpen] = useState(false);
  const [remainingTime, setRemainingTime] = useState<string>('');
  const [isOvertime, setIsOvertime] = useState(false);

  // 바로 다음 컴포넌트이니 직접 주입, redux 의존성 낮추기 위함.
  const logsForCharts = useSelector(
    (state: RootState) => state.logs.logsForCharts,
  );

  const { currentDate } = useSelector((state: RootState) => state.logs);
  const currentNotification = useSelector(
    (state: RootState) => state.restNotification.currentNotification,
  );

  // 잔여 시간 계산 및 업데이트
  useEffect(() => {
    if (!currentNotification) {
      setRemainingTime('');
      setIsOvertime(false);
      return;
    }

    const updateRemainingTime = () => {
      const { startTime, durationMinutes } = currentNotification;
      const endTime = startTime + durationMinutes * 60 * 1000;
      const now = Date.now();
      const remaining = endTime - now;

      const isNegative = remaining < 0;
      setIsOvertime(isNegative);

      const absRemaining = Math.abs(remaining);
      const minutes = Math.floor(absRemaining / 60000);
      const seconds = Math.floor((absRemaining % 60000) / 1000);

      const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      setRemainingTime(isNegative ? `-${timeStr}` : timeStr);
    };

    updateRemainingTime();
    const interval = setInterval(updateRemainingTime, 1000);

    return () => clearInterval(interval);
  }, [currentNotification]);

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
          <ThemeSelector />
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
    </div>
  );
};
