import { calculateHashSync } from '../utils/HashUtil';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface ServerLogResponse {
  success: boolean;
  data?: {
    userId: string;
    date: string;
    content: string;
    contentHash: string;
    parentHash: string | null;
    updatedAt: string;
    version: number;
  };
}

export interface BackupItem {
  userId: string;
  backupId: string;
  date: string;
  content: string;
  originalUpdatedAt?: string;
  originalVersion?: number;
  backedUpAt: string;
}

type ServerLogData = NonNullable<ServerLogResponse['data']>;
type PartialServerLogData = Partial<ServerLogData>;

const isString = (value: unknown): value is string => typeof value === 'string';

const normalizeServerLog = (
  date: string,
  payload: unknown,
): ServerLogData | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const raw = payload as PartialServerLogData;
  const content = isString(raw.content) ? raw.content : '';
  const rawContentHash = isString(raw.contentHash) ? raw.contentHash : null;
  const hasContentHash = !!rawContentHash && rawContentHash.length > 0;

  // API 기본 응답({ date, content: '' })은 서버 데이터 없음으로 간주
  if (!hasContentHash && content.length === 0 && !isString(raw.updatedAt)) {
    return null;
  }

  const contentHash = hasContentHash
    ? rawContentHash
    : calculateHashSync(content);

  return {
    userId: isString(raw.userId) ? raw.userId : '',
    date: isString(raw.date) && raw.date.length > 0 ? raw.date : date,
    content,
    contentHash,
    parentHash: isString(raw.parentHash) ? raw.parentHash : null,
    updatedAt: isString(raw.updatedAt)
      ? raw.updatedAt
      : new Date().toISOString(),
    version: typeof raw.version === 'number' ? raw.version : 0,
  };
};

export async function saveLogToServer(
  date: string,
  content: string,
  contentHash: string,
  parentHash: string | null,
): Promise<ServerLogResponse | null> {
  const token = localStorage.getItem('token');
  if (!token) {
    console.log('[LogService] No token found - skipping server sync');
    return null;
  }
  console.log('[LogService] Saving to server:', {
    date,
    contentHash,
    parentHash,
  });

  try {
    const response = await fetch(`${API_URL}/raw-logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ date, content, contentHash, parentHash }),
    });
    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
      console.error('Failed to save log to server:', response.statusText);
      return null;
    }
    const result = await response.json();
    console.log('[LogService] Server save response:', result);
    return result;
  } catch (error) {
    console.error('Failed to save log to server:', error);
    return null;
  }
}

export async function getLogBackupsFromServer(
  date: string,
): Promise<BackupItem[]> {
  const token = localStorage.getItem('token');
  if (!token) return [];

  try {
    const response = await fetch(`${API_URL}/raw-logs/${date}/backups`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('token');
      }
      return [];
    }
    const result = await response.json();
    return result.data || [];
  } catch (error) {
    console.error('Failed to fetch backups from server:', error);
    return [];
  }
}

export async function getLogFromServer(
  date: string,
): Promise<ServerLogResponse['data'] | null> {
  const token = localStorage.getItem('token');
  if (!token) {
    console.log('[LogService] No token found - skipping server fetch');
    return null;
  }
  console.log('[LogService] Fetching from server:', { date });

  try {
    const response = await fetch(`${API_URL}/raw-logs/${date}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('token');
      }
      return null;
    }
    const result = (await response.json()) as
      | unknown
      | { data?: unknown; success?: boolean };
    const payload =
      result && typeof result === 'object' && 'data' in result
        ? (result as { data?: unknown }).data
        : result;

    const normalized = normalizeServerLog(date, payload);
    console.log('[LogService] Server fetch response:', payload);
    return normalized;
  } catch (error) {
    console.error('Failed to fetch log from server:', error);
    return null;
  }
}

export async function login(
  username: string,
  password: string,
): Promise<{ access_token: string } | null> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    throw new Error('Login failed');
  }
  return response.json();
}

export async function signup(
  username: string,
  password: string,
): Promise<void> {
  const response = await fetch(`${API_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    throw new Error('Signup failed');
  }
}

export async function bulkSaveLogsToServer(
  logs: {
    date: string;
    content: string;
    contentHash: string;
    parentHash: string | null;
  }[],
): Promise<{
  success: boolean;
  data: {
    date: string;
    content: string;
    contentHash: string;
    parentHash: string | null;
    updatedAt: string;
  }[];
} | null> {
  const token = localStorage.getItem('token');
  if (!token) return null;

  try {
    const response = await fetch(`${API_URL}/raw-logs/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ logs }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('token');
      }
      return null;
    }

    return response.json();
  } catch (error) {
    console.error('Failed to bulk save logs to server:', error);
    return null;
  }
}
