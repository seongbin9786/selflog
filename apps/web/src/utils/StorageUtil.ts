import { calculateHashSync } from './HashUtil';

export interface LocalLogData {
  content: string;
  contentHash: string; // 현재 내용의 해시
  parentHash: string | null; // 이전 버전의 해시 (부모)
  localUpdatedAt: string; // 로컬에서 마지막 수정 시간
}

export const loadFromStorage = (key: string): LocalLogData => {
  const stored = localStorage.getItem(key);
  if (!stored) {
    const emptyHash = calculateHashSync('');
    return {
      content: '',
      contentHash: emptyHash,
      parentHash: null,
      localUpdatedAt: new Date().toISOString(),
    };
  }

  // 기존 문자열 데이터 마이그레이션
  try {
    const parsed = JSON.parse(stored) as Partial<LocalLogData>;

    // 새 형식 (contentHash, parentHash 있음)
    if (parsed.contentHash && parsed.localUpdatedAt) {
      return {
        content: parsed.content || '',
        contentHash: parsed.contentHash,
        parentHash: parsed.parentHash ?? null,
        localUpdatedAt: parsed.localUpdatedAt,
      };
    }

    // 구 형식 마이그레이션
    if (typeof parsed.content === 'string') {
      const hash = calculateHashSync(parsed.content);
      return {
        content: parsed.content,
        contentHash: hash,
        parentHash: null, // 기존 데이터는 부모 정보 없음
        localUpdatedAt: parsed.localUpdatedAt || new Date().toISOString(),
      };
    }
  } catch {
    // JSON 파싱 실패 = 기존 문자열 데이터
    const hash = calculateHashSync(stored);
    return {
      content: stored,
      contentHash: hash,
      parentHash: null,
      localUpdatedAt: new Date().toISOString(),
    };
  }

  // 폴백
  const emptyHash = calculateHashSync('');
  return {
    content: '',
    contentHash: emptyHash,
    parentHash: null,
    localUpdatedAt: new Date().toISOString(),
  };
};

export const saveToStorage = (
  key: string,
  content: string,
  options?: {
    parentHash?: string | null; // 부모 해시 (서버에서 받은 경우 명시)
  },
) => {
  const existing = loadFromStorage(key);
  const newHash = calculateHashSync(content);

  // parentHash 결정 로직:
  // 1. 명시적으로 제공된 경우 (서버에서 온 경우) → 사용
  // 2. 내용이 변경된 경우 → 기존 contentHash를 parent로
  // 3. 내용이 동일한 경우 → 기존 parentHash 유지
  let parentHash: string | null;
  if (options?.parentHash !== undefined) {
    parentHash = options.parentHash;
  } else if (newHash !== existing.contentHash) {
    parentHash = existing.contentHash;
  } else {
    parentHash = existing.parentHash;
  }

  const data: LocalLogData = {
    content,
    contentHash: newHash,
    parentHash,
    localUpdatedAt: new Date().toISOString(),
  };
  localStorage.setItem(key, JSON.stringify(data));
};

// Re-export LocalStorageManager from its new location
export { LocalStorageManager } from './LocalStorageManager';

const LOG_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * localStorage에서 모든 로그 데이터(날짜 키)를 삭제합니다.
 * 설정 및 기타 데이터는 유지됩니다.
 */
export const clearAllLogData = (): void => {
  const keysToDelete: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && LOG_DATE_REGEX.test(key)) {
      keysToDelete.push(key);
    }
  }

  keysToDelete.forEach((key) => localStorage.removeItem(key));
};
