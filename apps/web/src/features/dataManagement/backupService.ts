import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

import { bulkSaveLogsToServer } from '../../services/LogService';
import { calculateHashSync } from '../../utils/HashUtil';
import { BACKUP_VERSION, BackupData } from './types';

const LOG_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const SETTING_KEYS = ['soundSettings', 'targetPace', 'app-theme'];

export const createBackup = (): BackupData => {
  const logs: Record<string, string> = {};
  const settings: Record<string, string> = {};

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;

    if (LOG_DATE_REGEX.test(key)) {
      logs[key] = localStorage.getItem(key) || '';
    } else if (SETTING_KEYS.includes(key)) {
      settings[key] = localStorage.getItem(key) || '';
    }
  }

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
  saveAs(blob, `my-time-backup-${new Date().toISOString().slice(0, 10)}.json`);
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

export const importBackup = async (file: File): Promise<ImportBackupReport> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const backupRaw = JSON.parse(content);

        let logs: Record<string, string> = {};
        let settings: Record<string, string> = {};
        let isLegacyFormat = true;

        // Check if it's new format or legacy format
        if (backupRaw.logs && backupRaw.settings) {
          logs = backupRaw.logs;
          settings = backupRaw.settings;
          isLegacyFormat = false;
        } else {
          // Legacy format (flat localStorage dump)
          Object.entries(backupRaw).forEach(([key, value]) => {
            if (LOG_DATE_REGEX.test(key)) {
              logs[key] = String(value);
            } else if (SETTING_KEYS.includes(key)) {
              settings[key] = String(value);
            }
          });
        }

        if (
          Object.keys(logs).length === 0 &&
          Object.keys(settings).length === 0
        ) {
          throw new Error('No valid data found in backup file');
        }

        // Clear existing date logs before applying backup
        const existingLogKeys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && LOG_DATE_REGEX.test(key)) {
            existingLogKeys.push(key);
          }
        }
        existingLogKeys.forEach((key) => localStorage.removeItem(key));

        // Apply logs
        const logEntries = Object.entries(logs).filter(([key]) =>
          LOG_DATE_REGEX.test(key),
        );
        const emptyLogs = logEntries.filter(([, value]) => !value);

        const serverSyncedDates = new Set<string>();
        if (isLegacyFormat) {
          const payload = logEntries
            .filter(([, value]) => value)
            .map(([date, value]) => ({
              date,
              content: String(value),
              contentHash: calculateHashSync(String(value)),
              parentHash: null,
            }));

          if (payload.length > 0) {
            const result = await bulkSaveLogsToServer(payload);
            if (result?.success && result.data) {
              result.data.forEach((item) => {
                localStorage.setItem(
                  item.date,
                  JSON.stringify({
                    content: item.content,
                    contentHash: item.contentHash,
                    parentHash: item.parentHash,
                    localUpdatedAt: item.updatedAt,
                  }),
                );
                serverSyncedDates.add(item.date);
              });
            }
          }
        }

        logEntries.forEach(([key, value]) => {
          if (!value || serverSyncedDates.has(key)) {
            return;
          }
          localStorage.setItem(key, String(value));
        });

        // Apply settings
        const appliedSettings: string[] = [];
        Object.entries(settings).forEach(([key, value]) => {
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
      const rawLog = localStorage.getItem(key) || '';
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
  saveAs(data, `my-time-logs-${new Date().toISOString().slice(0, 10)}.xlsx`);
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
  const serverLogs = result.data;

  const backupData: BackupData = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    logs: serverLogs.reduce(
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
    `my-time-server-backup-${new Date().toISOString().slice(0, 10)}.json`,
  );
};
