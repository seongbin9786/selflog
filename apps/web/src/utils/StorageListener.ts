type StorageEventCallback = (log: string) => void;

type StorageEventListener = ((e: StorageEvent) => void) | null;

const STORAGE_EVENT = 'storage';

export class StorageListener {
  private eventListener: StorageEventListener = null;

  install(targetKey: string, callback: StorageEventCallback) {
    // 제거
    if (this.eventListener) {
      window.removeEventListener(STORAGE_EVENT, this.eventListener);
    }

    // 등록
    const listener = this.create(targetKey, callback);
    window.addEventListener(STORAGE_EVENT, listener);
    this.eventListener = listener;
  }

  // 단순 생성
  private create(targetKey: string, callback: StorageEventCallback) {
    const listener = (e: StorageEvent) => {
      const { key, newValue } = e;
      // 동일 key에 대해서만 처리
      if (key === targetKey) {
        callback(newValue ?? '');
      }
    };

    return listener;
  }
}
