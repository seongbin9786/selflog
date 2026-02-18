import type { TypedStartListening } from '@reduxjs/toolkit';
import { createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';

import { getLogFromServer, saveLogToServer } from '../services/LogService';
import { detectConflict } from '../utils/ConflictDetector';
import { calculateHashSync } from '../utils/HashUtil';
import { loadFromStorage, saveToStorage } from '../utils/StorageUtil';
import type { AppDispatch, RootState } from '.';
import { loginSuccess } from './auth';
import {
  goToNextDate,
  goToPrevDate,
  goToToday,
  hydrateRawLog,
  resolveConflict,
  setConflict,
  setCurrentDateServerFetchComplete,
  setLastSyncedAt,
  setSyncStatus,
  triggerCurrentDateFetch,
  updateRawLog,
} from './logs';

/**
 * RawLog를 Storage에 저장하고 불러오는 Middleware
 * 부작용이므로 Middleware에서 구현
 */
export const RawLogStorageSyncMiddleware = createListenerMiddleware();

// 굳이 필요한 Type 정의...
export type AppStartListening = TypedStartListening<RootState, AppDispatch>;

const startAppListening =
  RawLogStorageSyncMiddleware.startListening as AppStartListening;

const shortHash = (value: string | null | undefined): string =>
  typeof value === 'string' ? value.substring(0, 8) : 'null';

// localstorage에 저장 & 배업 (Server Sync with Debounce)
startAppListening({
  actionCreator: updateRawLog,
  effect: async (action, listenerApi) => {
    // 1. Local Storage Save (Immediate) - 로컬 수정만 반영
    const { currentDate } = listenerApi.getState().logs;
    const nextRawLogs = action.payload;
    saveToStorage(currentDate, nextRawLogs);
    console.log(`[middleware] saved to local storage at ${currentDate}`);

    // 2. Server Sync (Debounced)
    listenerApi.cancelActiveListeners();

    try {
      await listenerApi.delay(300);

      const token = localStorage.getItem('token');
      if (!token) {
        listenerApi.dispatch(setSyncStatus('idle'));
        return;
      }

      // 로그인 직후/날짜 이동 직후 서버 fetch가 끝나기 전에는 업로드 금지
      const { isCurrentDateServerFetchComplete } = listenerApi.getState().logs;
      if (!isCurrentDateServerFetchComplete) {
        console.log(
          '[middleware] skip upload until current date server fetch completes',
        );
        return;
      }

      listenerApi.dispatch(setSyncStatus('syncing'));

      const localData = loadFromStorage(currentDate);
      const result = await saveLogToServer(
        currentDate,
        nextRawLogs,
        localData.contentHash,
        localData.parentHash,
      );

      if (result && result.success) {
        listenerApi.dispatch(setSyncStatus('synced'));
        if (result.data?.updatedAt) {
          listenerApi.dispatch(setLastSyncedAt(result.data.updatedAt));
          // 서버 저장 성공 시 parentHash를 서버의 contentHash로 업데이트
          // (서버가 새로운 부모가 됨)
          saveToStorage(currentDate, nextRawLogs, {
            parentHash: result.data.contentHash,
          });
        }
      } else {
        listenerApi.dispatch(setSyncStatus('error'));
      }
    } catch (error) {
      if ((error as { code: string }).code === 'listener-cancelled') {
        // Debounce cancelled, ignore
        return;
      }
      console.error('Sync failed:', error);
      listenerApi.dispatch(setSyncStatus('error'));
    }
  },
});

// localstorage에서 불러오기 & Server Fetch
startAppListening({
  matcher: isAnyOf(
    goToToday,
    goToPrevDate,
    goToNextDate,
    loginSuccess,
    triggerCurrentDateFetch,
  ),
  effect: async (_, listenerApi) => {
    listenerApi.dispatch(setCurrentDateServerFetchComplete(false));
    const { currentDate: changedDate } = listenerApi.getState().logs;

    // 1. Local Load
    const localData = loadFromStorage(changedDate);
    listenerApi.dispatch(hydrateRawLog(localData.content));
    console.log(
      `[middleware] loaded from local, dispatched hydrate at ${changedDate}`,
    );

    // 2. Server Fetch
    listenerApi.dispatch(setSyncStatus('syncing'));
    try {
      const serverLog = await getLogFromServer(changedDate);

      if (!serverLog) {
        // 서버에 데이터 없음
        listenerApi.dispatch(setSyncStatus('idle'));
        listenerApi.dispatch(setCurrentDateServerFetchComplete(true));
        return;
      }

      const {
        contentHash: localHash,
        parentHash: localParent,
        content: localContent,
        localUpdatedAt,
      } = localData;
      const {
        contentHash: serverHash,
        parentHash: serverParent,
        content: serverContent,
        updatedAt: serverUpdatedAt,
      } = serverLog;

      // Linked list 기반 충돌 감지
      const conflictResult = detectConflict(
        { contentHash: localHash, parentHash: localParent },
        { contentHash: serverHash, parentHash: serverParent },
      );

      switch (conflictResult.type) {
        case 'NO_CONFLICT_SAME':
          console.log('[NO CONFLICT] Same content (hash match)');
          listenerApi.dispatch(setLastSyncedAt(serverUpdatedAt));
          saveToStorage(changedDate, serverContent, {
            parentHash: serverParent,
          });
          listenerApi.dispatch(setSyncStatus('synced'));
          listenerApi.dispatch(setCurrentDateServerFetchComplete(true));
          return;

        case 'FAST_FORWARD':
          console.log(
            `[FAST-FORWARD] Server is ahead\n` +
              `  Local: ${shortHash(localHash)}\n` +
              `  Server: ${shortHash(serverHash)} (parent: ${shortHash(serverParent)})`,
          );
          listenerApi.dispatch(hydrateRawLog(serverContent));
          listenerApi.dispatch(setLastSyncedAt(serverUpdatedAt));
          saveToStorage(changedDate, serverContent, {
            parentHash: serverParent,
          });
          listenerApi.dispatch(setSyncStatus('synced'));
          listenerApi.dispatch(setCurrentDateServerFetchComplete(true));
          return;

        case 'LOCAL_AHEAD': {
          console.log(
            `[LOCAL AHEAD] Pushing local to server\n` +
              `  Server: ${shortHash(serverHash)}\n` +
              `  Local: ${shortHash(localHash)} (parent: ${shortHash(localParent)})`,
          );
          const result = await saveLogToServer(
            changedDate,
            localContent,
            localHash,
            localParent,
          );
          if (result?.success && result.data?.updatedAt) {
            listenerApi.dispatch(setLastSyncedAt(result.data.updatedAt));
            saveToStorage(changedDate, localContent, {
              parentHash: result.data.contentHash,
            });
            listenerApi.dispatch(setSyncStatus('synced'));
            listenerApi.dispatch(setCurrentDateServerFetchComplete(true));
          } else {
            listenerApi.dispatch(setSyncStatus('error'));
          }
          return;
        }

        case 'CONFLICT_DIVERGED':
          console.warn(
            `[CONFLICT] Diverged from common ancestor\n` +
              `  Local: ${shortHash(localHash)} (parent: ${shortHash(localParent)})\n` +
              `  Server: ${shortHash(serverHash)} (parent: ${shortHash(serverParent)})\n` +
              `  Local time: ${localUpdatedAt}\n` +
              `  Server time: ${serverUpdatedAt}`,
          );
          listenerApi.dispatch(
            setConflict({
              localContent,
              serverContent,
              baseContent: '', // linked list 방식에서는 baseContent가 명확하지 않음
              localUpdatedAt,
              serverUpdatedAt,
            }),
          );
          listenerApi.dispatch(setSyncStatus('error'));
          listenerApi.dispatch(setCurrentDateServerFetchComplete(true));
          return;
      }
    } catch (e) {
      console.error(e);
      listenerApi.dispatch(setSyncStatus('error'));
    }
  },
});

// 충돌 해결 후 서버에 저장
startAppListening({
  actionCreator: resolveConflict,
  effect: async (action, listenerApi) => {
    const { currentDate, conflict } = listenerApi.getState().logs;

    if (!conflict) {
      console.error('No conflict to resolve');
      return;
    }

    const selectedContent =
      action.payload.choice === 'local'
        ? conflict.localContent
        : conflict.serverContent;

    console.log(
      `[CONFLICT RESOLVED] User chose: ${action.payload.choice}, saving to server`,
    );

    // 선택한 내용을 서버에 저장
    // 새로운 버전으로 저장 (양쪽 해시를 무시하고 새 체인 시작)
    listenerApi.dispatch(setSyncStatus('syncing'));
    try {
      const localData = loadFromStorage(currentDate);
      const newHash = calculateHashSync(selectedContent);

      // 충돌 해결 시에는 양쪽 parentHash를 기록할 수 없으므로
      // 선택한 쪽의 해시를 parent로 사용
      const parentHash =
        action.payload.choice === 'local'
          ? localData.contentHash
          : conflict.serverContent
            ? calculateHashSync(conflict.serverContent)
            : null;

      const result = await saveLogToServer(
        currentDate,
        selectedContent,
        newHash,
        parentHash,
      );

      if (result?.success && result.data?.updatedAt) {
        listenerApi.dispatch(setLastSyncedAt(result.data.updatedAt));
        saveToStorage(currentDate, selectedContent, {
          parentHash: result.data.contentHash,
        });
        listenerApi.dispatch(setSyncStatus('synced'));
      } else {
        listenerApi.dispatch(setSyncStatus('error'));
      }
    } catch (error) {
      console.error('Failed to save conflict resolution:', error);
      listenerApi.dispatch(setSyncStatus('error'));
    }
  },
});
