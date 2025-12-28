import { useEffect, useState } from 'react';

import type { RestNotification } from '../../types/sound';
import { calculateRemainingTime } from '../../utils/timeCalculator';

/**
 * 잔여 휴식 시간을 계산하고 실시간으로 업데이트하는 Hook
 */
export const useRemainingTime = (
  currentNotification: RestNotification | null,
) => {
  const [remainingTime, setRemainingTime] = useState<string>('');
  const [isOvertime, setIsOvertime] = useState(false);

  useEffect(() => {
    if (!currentNotification) {
      setRemainingTime('');
      setIsOvertime(false);
      return;
    }

    const updateTime = () => {
      const { startTime, durationMinutes } = currentNotification;
      const timeInfo = calculateRemainingTime(startTime, durationMinutes);

      setIsOvertime(timeInfo.isOvertime);
      setRemainingTime(timeInfo.formatted);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, [currentNotification]);

  return {
    remainingTime,
    isOvertime,
  };
};
