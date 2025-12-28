import type { RemainingTimeInfo } from '../types/sound';

/**
 * 잔여 시간을 계산하고 포맷팅합니다.
 * @param startTime 시작 시간 (timestamp)
 * @param durationMinutes 지속 시간 (분)
 * @returns 잔여 시간 정보
 */
export const calculateRemainingTime = (
  startTime: number,
  durationMinutes: number,
): RemainingTimeInfo => {
  const endTime = startTime + durationMinutes * 60 * 1000;
  const now = Date.now();
  const remaining = endTime - now;

  const isOvertime = remaining < 0;
  const absRemaining = Math.abs(remaining);
  const minutes = Math.floor(absRemaining / 60000);
  const seconds = Math.floor((absRemaining % 60000) / 1000);

  const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const formatted = isOvertime ? `-${timeStr}` : timeStr;

  return {
    remaining,
    isOvertime,
    formatted,
  };
};

/**
 * 종료 1분 전 알림 시간을 계산합니다.
 * @param durationMinutes 지속 시간 (분)
 * @returns 1분 전 시간 (밀리초)
 */
export const calculateOneMinuteBefore = (durationMinutes: number): number => {
  const ONE_MINUTE_MS = 60 * 1000;
  return durationMinutes * ONE_MINUTE_MS - ONE_MINUTE_MS;
};

/**
 * 종료 시각을 계산합니다.
 * @param durationMinutes 지속 시간 (분)
 * @returns 종료 시각 (밀리초)
 */
export const calculateEndTime = (durationMinutes: number): number => {
  return durationMinutes * 60 * 1000;
};
