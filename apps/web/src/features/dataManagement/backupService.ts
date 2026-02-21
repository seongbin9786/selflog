import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

import { bulkSaveLogsToServer } from '../../services/LogService';
import { calculateHashSync } from '../../utils/HashUtil';
import {
  clearAllLogData,
  loadFromStorage,
  saveToStorage,
} from '../../utils/StorageUtil';
import { BACKUP_VERSION, BackupData } from './types';

const LOG_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const SETTING_KEYS = ['soundSettings', 'targetPace', 'app-theme'];
const DEFAULT_BACKUP_SOUND_TYPES = new Set(['beep', 'bell', 'chime']);
const SOUND_SETTINGS_KEY = 'soundSettings';
const STORAGE_WRAPPER_KEYS = new Set([
  'content',
  'contentHash',
  'parentHash',
  'localUpdatedAt',
]);
const MAX_UNWRAP_DEPTH = 10;

const hasLogContent = (value: string): boolean => value.length > 0;

const sanitizeSoundSettingsForBackup = (raw: string): string | null => {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const record = parsed as Record<string, unknown>;
    const selectedSound =
      typeof record.selectedSound === 'string' &&
      DEFAULT_BACKUP_SOUND_TYPES.has(record.selectedSound)
        ? record.selectedSound
        : 'beep';
    const infiniteRepeat =
      typeof record.infiniteRepeat === 'boolean' ? record.infiniteRepeat : true;

    return JSON.stringify({
      selectedSound,
      customSoundData: null,
      customSoundName: null,
      infiniteRepeat,
    });
  } catch {
    return null;
  }
};

const unwrapStorageWrapperOnce = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    return raw;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return raw;
    }

    const record = parsed as Record<string, unknown>;
    if (typeof record.content !== 'string') {
      return raw;
    }

    const keys = Object.keys(record);
    if (
      keys.length === 0 ||
      !keys.every((key) => STORAGE_WRAPPER_KEYS.has(key))
    ) {
      return raw;
    }

    return record.content;
  } catch {
    return raw;
  }
};

const normalizeLogContent = (raw: string): string => {
  let current = raw;
  for (let i = 0; i < MAX_UNWRAP_DEPTH; i++) {
    const unwrapped = unwrapStorageWrapperOnce(current);
    if (unwrapped === current) {
      return current;
    }
    current = unwrapped;
  }
  return current;
};

export const createBackup = (): BackupData => {
  const logEntries: Array<[string, string]> = [];
  const settings: Record<string, string> = {};

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;

    if (LOG_DATE_REGEX.test(key)) {
      const content = normalizeLogContent(loadFromStorage(key).content);
      if (hasLogContent(content)) {
        logEntries.push([key, content]);
      }
    } else if (SETTING_KEYS.includes(key)) {
      const rawValue = localStorage.getItem(key);
      if (rawValue === null) continue;

      if (key === SOUND_SETTINGS_KEY) {
        const sanitized = sanitizeSoundSettingsForBackup(rawValue);
        if (sanitized) {
          settings[key] = sanitized;
        }
        continue;
      }

      settings[key] = rawValue;
    }
  }

  logEntries.sort(([a], [b]) => a.localeCompare(b));
  const logs = Object.fromEntries(logEntries);

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    logs,
    settings,
  };
};

export const downloadBackupInfo = (backup: BackupData) => {
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  saveAs(
    blob,
    `my-commit-backup-${new Date().toISOString().slice(0, 10)}.json`,
  );
};

type ImportBackupReport = {
  fileName: string;
  fileSize: number;
  totalLogs: number;
  appliedLogs: number;
  skippedEmptyLogs: number;
  appliedSettings: string[];
  failedLogs: string[];
};

const matchesStoredContent = (stored: string | null, expected: string) => {
  if (stored === null) return false;
  if (stored === expected) return true;
  try {
    const parsed = JSON.parse(stored) as { content?: unknown };
    return typeof parsed.content === 'string' && parsed.content === expected;
  } catch {
    return false;
  }
};

/**
 * Migrates legacy backup format to the new BackupData format.
 * Legacy format: flat object with date keys and settings mixed at the same level
 * New format: { version, exportedAt, logs: {...}, settings: {...} }
 */
const migrateLegacyBackup = (
  data: Record<string, unknown>,
): BackupData | null => {
  // 신형 포맷:
  // 1) 완전한 형태 { version, exportedAt, logs, settings }
  // 2) 축약 형태 { logs, settings? } 도 허용
  if ('logs' in data && typeof data.logs === 'object' && data.logs !== null) {
    const rawLogs = data.logs as Record<string, unknown>;
    const logs: Record<string, string> = {};

    Object.entries(rawLogs).forEach(([key, value]) => {
      if (LOG_DATE_REGEX.test(key) && typeof value === 'string') {
        logs[key] = value;
      }
    });

    const rawSettings =
      'settings' in data && typeof data.settings === 'object' && data.settings
        ? (data.settings as Record<string, unknown>)
        : {};
    const settings: Record<string, string> = {};
    Object.entries(rawSettings).forEach(([key, value]) => {
      if (typeof value === 'string' && SETTING_KEYS.includes(key)) {
        settings[key] = value;
      }
    });

    return {
      version: typeof data.version === 'number' ? data.version : BACKUP_VERSION,
      exportedAt:
        typeof data.exportedAt === 'string'
          ? data.exportedAt
          : new Date().toISOString(),
      logs,
      settings,
    };
  }

  // Check if this looks like a legacy format (has date keys at root level)
  const hasDateKeys = Object.keys(data).some((key) => LOG_DATE_REGEX.test(key));
  if (!hasDateKeys) {
    return null; // Neither new nor legacy format
  }

  // Migrate legacy format
  const logs: Record<string, string> = {};
  const settings: Record<string, string> = {};

  Object.entries(data).forEach(([key, value]) => {
    if (typeof value !== 'string') return;

    if (LOG_DATE_REGEX.test(key)) {
      logs[key] = value;
    } else if (SETTING_KEYS.includes(key)) {
      settings[key] = value;
    }
  });

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    logs,
    settings,
  };
};

interface BulkLogInput {
  date: string;
  content: string;
  contentHash: string;
  parentHash: string | null;
}

/**
 * 백업 파일에서 데이터를 복구합니다.
 * 로그인 상태(토큰 있음)면 서버에 동기화하고, 비로그인이면 로컬에만 저장합니다.
 *
 * @param file - 백업 JSON 파일
 * @returns 복구 리포트
 */
export const importBackup = async (file: File): Promise<ImportBackupReport> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const rawData = JSON.parse(content) as Record<string, unknown>;

        // Try to migrate if it's a legacy format
        const backup = migrateLegacyBackup(rawData);

        if (!backup || !backup.logs) {
          throw new Error('Invalid backup format');
        }

        const token = localStorage.getItem('token');
        const logEntries = Object.entries(backup.logs)
          .filter(([key]) => LOG_DATE_REGEX.test(key))
          .map(
            ([date, content]) => [date, normalizeLogContent(content)] as const,
          )
          .sort(([a], [b]) => a.localeCompare(b));
        const emptyLogs = logEntries.filter(([, value]) => !value);

        // 1. 기존 로그 데이터 삭제 (For both sync and local modes, to ensure clean state)
        // 기존 HEAD는 selective update였지만, main은 clean & replace 방식이었음.
        // 일관성을 위해 clearAllLogData 사용.
        clearAllLogData();

        if (token) {
          // 로그인 상태: 서버 동기화 모드 (Bulk API 사용)
          console.log(
            '[importBackup] Logged in - syncing with server (bulk)',
            logEntries.length,
            'logs',
          );

          // 2. Bulk API로 모든 로그를 한 번에 업로드
          const bulkLogs: BulkLogInput[] = logEntries.map(
            ([date, logContent]) => ({
              date,
              content: logContent,
              contentHash: calculateHashSync(logContent),
              parentHash: null, // 새로운 체인 시작
            }),
          );

          const result = await bulkSaveLogsToServer(bulkLogs);

          // 3. 서버 응답으로 localStorage 저장
          if (result?.success && result.data) {
            const serverDataMap = new Map(
              result.data.map((item: { date: string; contentHash: string }) => [
                item.date,
                item.contentHash,
              ]),
            );

            logEntries.forEach(([date, logContent]) => {
              const serverHash = serverDataMap.get(date);
              if (serverHash) {
                saveToStorage(date, logContent, { parentHash: serverHash });
              } else {
                saveToStorage(date, logContent);
              }
            });
          } else {
            // 서버 저장 실패 시 로컬에만 저장
            logEntries.forEach(([date, logContent]) => {
              saveToStorage(date, logContent);
            });
          }
        } else {
          // 비로그인 상태: 로컬 저장만
          console.log('[importBackup] Not logged in - saving to local only');

          logEntries.forEach(([date, logContent]) => {
            saveToStorage(date, logContent);
          });
        }

        // Apply settings
        const appliedSettings: string[] = [];
        Object.entries(backup.settings).forEach(([key, value]) => {
          if (value && SETTING_KEYS.includes(key)) {
            localStorage.setItem(key, value);
            appliedSettings.push(key);
          }
        });

        const failedLogs: string[] = [];
        logEntries
          .filter(([, value]) => value)
          .forEach(([key, value]) => {
            const stored = localStorage.getItem(key);
            if (!matchesStoredContent(stored, String(value))) {
              failedLogs.push(key);
            }
          });

        const report: ImportBackupReport = {
          fileName: file.name,
          fileSize: file.size,
          totalLogs: logEntries.length,
          appliedLogs: logEntries.length - emptyLogs.length,
          skippedEmptyLogs: emptyLogs.length,
          appliedSettings,
          failedLogs,
        };

        if (failedLogs.length > 0) {
          console.error('[importBackup] verification failed:', report);
          throw new Error('Import verification failed');
        }

        console.log('[importBackup] report:', report);
        resolve(report);
      } catch (err) {
        console.error(err);
        reject(err);
      }
    };
    reader.readAsText(file);
  });
};

interface LogExportRow {
  Date: string;
  Content: string;
}

export const exportLogsToExcel = () => {
  const allLogs: LogExportRow[] = [];

  // Collect all data
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && LOG_DATE_REGEX.test(key)) {
      const rawLog = normalizeLogContent(loadFromStorage(key).content);
      // Simple parsing or raw dump? Let's parse simple line based if possible, or just raw.
      // Requirements say "Excel (Spreadsheet)". Better to have readable format.
      // But currently raw log is just text. Parsing logic is in `logs.ts`.
      // For now, let's dump date and raw text content, and maybe simple line split.

      allLogs.push({
        Date: key,
        Content: rawLog,
      });
    }
  }

  // Sort by date
  allLogs.sort((a, b) => a.Date.localeCompare(b.Date));

  const ws = XLSX.utils.json_to_sheet(allLogs);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Logs');

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const data = new Blob([excelBuffer], { type: 'application/octet-stream' });
  saveAs(data, `my-commit-logs-${new Date().toISOString().slice(0, 10)}.xlsx`);
};

export const fetchAndDownloadServerBackup = async (token: string) => {
  const response = await fetch(`${import.meta.env.VITE_API_URL}/raw-logs`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch server logs');
  }

  const result = await response.json();
  const serverLogs = result.data as Array<{ date: string; content: string }>;
  const sortedServerLogs = [...serverLogs]
    .filter(({ content }) => hasLogContent(content))
    .sort((a, b) => a.date.localeCompare(b.date));

  const backupData: BackupData = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    logs: sortedServerLogs.reduce(
      (acc: Record<string, string>, log: { date: string; content: string }) => {
        acc[log.date] = log.content;
        return acc;
      },
      {},
    ),
    settings: {}, // Server backup currently only includes logs
  };

  const blob = new Blob([JSON.stringify(backupData, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  saveAs(
    blob,
    `my-commit-server-backup-${new Date().toISOString().slice(0, 10)}.json`,
  );
};
