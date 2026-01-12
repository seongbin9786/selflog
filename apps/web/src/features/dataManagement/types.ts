export interface BackupData {
  version: number;
  exportedAt: string;
  logs: Record<string, string>; // date key -> raw log string
  settings: {
    soundSettings?: string;
    targetPace?: string;
    [key: string]: string | undefined;
  };
}

export const BACKUP_VERSION = 1;
