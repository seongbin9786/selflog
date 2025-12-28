import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { AUDIO_CONSTRAINTS } from '../../constants/sound';
import { RootState } from '../../store';
import { clearRestNotification } from '../../store/restNotification';
import { playBeeps } from '../../utils/soundUtil';
import {
  calculateEndTime,
  calculateOneMinuteBefore,
} from '../../utils/timeCalculator';

/**
 * 휴식 시간 알림을 관리하는 hook
 */
export const useRestNotification = () => {
  const dispatch = useDispatch();
  const currentNotification = useSelector(
    (state: RootState) => state.restNotification.currentNotification,
  );
  const { selectedSound, customSoundData, infiniteRepeat } = useSelector(
    (state: RootState) => state.soundSettings,
  );
  const repeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!currentNotification) {
      return;
    }

    const { startTime, durationMinutes } = currentNotification;

    // 시간 계산
    const oneMinuteBeforeMs = calculateOneMinuteBefore(durationMinutes);
    const endTimeMs = calculateEndTime(durationMinutes);

    const now = Date.now();
    const elapsed = now - startTime;

    const timers: NodeJS.Timeout[] = [];

    // 1분 전 알림 설정
    if (oneMinuteBeforeMs > 0 && elapsed < oneMinuteBeforeMs) {
      const timeout = setTimeout(() => {
        console.log('휴식 종료 1분 전 알림');
        playBeeps(2, selectedSound, customSoundData);
      }, oneMinuteBeforeMs - elapsed);
      timers.push(timeout);
    }

    // 종료 시각 알림 설정
    if (elapsed < endTimeMs) {
      const timeout = setTimeout(() => {
        console.log('휴식 종료 알림');
        playBeeps(3, selectedSound, customSoundData);

        // 무한 반복이 활성화되어 있으면 계속 반복
        if (infiniteRepeat) {
          repeatIntervalRef.current = setInterval(() => {
            console.log('휴식 종료 알림 (반복)');
            playBeeps(3, selectedSound, customSoundData);
          }, AUDIO_CONSTRAINTS.REPEAT_INTERVAL_MS);
        } else {
          dispatch(clearRestNotification());
        }
      }, endTimeMs - elapsed);
      timers.push(timeout);
    } else {
      // 이미 종료 시각이 지났으면 알림 제거
      dispatch(clearRestNotification());
    }

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      if (repeatIntervalRef.current) {
        clearInterval(repeatIntervalRef.current);
        repeatIntervalRef.current = null;
      }
    };
  }, [
    currentNotification,
    dispatch,
    selectedSound,
    customSoundData,
    infiniteRepeat,
  ]);
};
