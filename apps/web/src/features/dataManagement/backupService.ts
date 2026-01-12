import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

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

export const importBackup = async (file: File): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const backupRaw = JSON.parse(content);

        let logs: Record<string, string> = {};
        let settings: Record<string, string> = {};

        // Check if it's new format or legacy format
        if (backupRaw.logs && backupRaw.settings) {
          logs = backupRaw.logs;
          settings = backupRaw.settings;
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

        // Apply logs
        Object.entries(logs).forEach(([key, value]) => {
          if (LOG_DATE_REGEX.test(key) && value) {
            localStorage.setItem(key, value);
          }
        });

        // Apply settings
        Object.entries(settings).forEach(([key, value]) => {
          if (value && SETTING_KEYS.includes(key)) {
            localStorage.setItem(key, value);
          }
        });

        resolve(true);
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
