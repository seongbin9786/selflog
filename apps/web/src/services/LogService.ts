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
    const data = await response.json();
    console.log('[LogService] Server fetch response:', data);
    return data;
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
