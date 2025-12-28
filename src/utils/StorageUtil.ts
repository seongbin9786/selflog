export const loadFromStorage = (key: string) => localStorage.getItem(key) || '';

export const saveToStorage = (key: string, data: string) =>
  localStorage.setItem(key, data);

// Re-export LocalStorageManager from its new location
export { LocalStorageManager } from './LocalStorageManager';
