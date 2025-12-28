import type { TypedStartListening } from '@reduxjs/toolkit';
import { createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';

import { loadFromStorage, saveToStorage } from '../utils/StorageUtil';
import type { AppDispatch, RootState } from '.';
import { goToNextDate, goToPrevDate, goToToday, updateRawLog } from './logs';

/**
 * RawLog를 Storage에 저장하고 불러오는 Middleware
 * 부작용이므로 Middleware에서 구현
 */
export const RawLogStorageSyncMiddleware = createListenerMiddleware();

// 굳이 필요한 Type 정의...
export type AppStartListening = TypedStartListening<RootState, AppDispatch>;

const startAppListening =
  RawLogStorageSyncMiddleware.startListening as AppStartListening;

// localstorage에 저장
startAppListening({
  actionCreator: updateRawLog,
  effect: (action, middleareAPI) => {
    const { currentDate } = middleareAPI.getState().logs;
    const nextRawLogs = action.payload;
    saveToStorage(currentDate, nextRawLogs);
    console.log(`[middleware] saved at ${currentDate}`);
  },
});

// localstorage에서 불러오기
startAppListening({
  matcher: isAnyOf(goToToday, goToPrevDate, goToNextDate),
  // 이게 언제 실행 되는 거야?
  effect: (_, middleareAPI) => {
    const { currentDate: changedDate } = middleareAPI.getState().logs;
    /*
    bug fix:
      이전 날짜로 가면, 하루 더 전 날짜로 이동함
      다음 날짜로 가면, 하루 더 후 날짜로 이동함
      원인: effect가 실행되는 때에는 이미 state가 반영된 후인 듯

      따라서 추가로 getNextDate(currentDate); 하는 경우 잘못된 날짜의 데이터로 덮어씌어진다.
    */
    const RawLogForChangedDate = loadFromStorage(changedDate);
    middleareAPI.dispatch(updateRawLog(RawLogForChangedDate));
    console.log(`[middleware] loaded, dispatched update at ${changedDate}`);
  },
});
