import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import {
  getDateStringDayAfter,
  getDateStringDayBefore,
  getTodayString,
} from '../utils/DateUtil';
import { createLogsFromString } from '../utils/LogConverter';
import { Log } from '../utils/PaceUtil';
import { loadFromStorage } from '../utils/StorageUtil';

export type ConflictState = {
  localContent: string;
  serverContent: string;
  baseContent: string;
  localUpdatedAt: string;
  serverUpdatedAt: string;
};

export type LogState = {
  currentDate: string;
  rawLogs: string;
  logsForCharts: Log[];
  syncStatus: 'idle' | 'pending' | 'syncing' | 'synced' | 'error';
  lastSyncedAt: string | null;
  isCurrentDateServerFetchComplete: boolean;
  conflict: ConflictState | null; // 충돌 상태
};

// reducer 바깥이어서 초기값 설정 구문이 순수하지 않아도 괜찮을 듯
const initialDate = getTodayString();
const initialLocalData = loadFromStorage(initialDate);

const initialState: LogState = {
  currentDate: initialDate,
  rawLogs: initialLocalData.content,
  logsForCharts: createLogsFromString(initialLocalData.content, initialDate),
  syncStatus: 'idle',
  lastSyncedAt: null,
  isCurrentDateServerFetchComplete: false,
  conflict: null,
};

export const LogSlice = createSlice({
  name: 'logs',
  initialState,
  reducers: {
    triggerCurrentDateFetch: (state) => {
      state.isCurrentDateServerFetchComplete = false;
    },
    goToToday: (state) => {
      state.currentDate = getTodayString();
      state.isCurrentDateServerFetchComplete = false;
    },
    goToPrevDate: (state) => {
      state.currentDate = getDateStringDayBefore(state.currentDate);
      state.isCurrentDateServerFetchComplete = false;
    },
    goToNextDate: (state) => {
      state.currentDate = getDateStringDayAfter(state.currentDate);
      state.isCurrentDateServerFetchComplete = false;
    },
    // 사용자 편집 전용 액션
    updateRawLog: (state, action: PayloadAction<string>) => {
      const newRawLogs = action.payload;
      const currentDate = state.currentDate;
      console.log(`[reducer] updateRawLog at ${currentDate}`);
      state.rawLogs = newRawLogs;
      state.logsForCharts = createLogsFromString(newRawLogs, currentDate);
      // If user types, we are pending sync
      if (state.syncStatus !== 'syncing') {
        state.syncStatus = 'pending';
      }
    },
    // 저장/동기화를 트리거하지 않는 hydrate 경로
    hydrateRawLog: (state, action: PayloadAction<string>) => {
      const content = action.payload;
      state.rawLogs = content;
      state.logsForCharts = createLogsFromString(content, state.currentDate);
    },
    // 30초 주기 차트 갱신용 (저장/동기화 금지)
    refreshDerivedLogs: (state) => {
      state.logsForCharts = createLogsFromString(
        state.rawLogs,
        state.currentDate,
      );
    },
    setSyncStatus: (state, action: PayloadAction<LogState['syncStatus']>) => {
      state.syncStatus = action.payload;
    },
    setLastSyncedAt: (state, action: PayloadAction<string>) => {
      state.lastSyncedAt = action.payload;
    },
    setCurrentDateServerFetchComplete: (
      state,
      action: PayloadAction<boolean>,
    ) => {
      state.isCurrentDateServerFetchComplete = action.payload;
    },
    setConflict: (state, action: PayloadAction<ConflictState | null>) => {
      state.conflict = action.payload;
    },
    resolveConflict: (
      state,
      action: PayloadAction<{ choice: 'local' | 'server' }>,
    ) => {
      if (!state.conflict) return;

      const content =
        action.payload.choice === 'local'
          ? state.conflict.localContent
          : state.conflict.serverContent;

      state.rawLogs = content;
      state.logsForCharts = createLogsFromString(content, state.currentDate);
      state.conflict = null;
    },
  },
});

export const {
  actions: {
    goToToday,
    goToPrevDate,
    goToNextDate,
    triggerCurrentDateFetch,
    updateRawLog,
    hydrateRawLog,
    refreshDerivedLogs,
    setSyncStatus,
    setLastSyncedAt,
    setCurrentDateServerFetchComplete,
    setConflict,
    resolveConflict,
  },
  reducer: LogsReducer,
} = LogSlice;
