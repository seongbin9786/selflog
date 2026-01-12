import { beforeEach, describe, expect, it } from 'vitest';

import { calculateHashSync } from './HashUtil';
import { loadFromStorage, saveToStorage } from './StorageUtil';

describe('StorageUtil', () => {
  beforeEach(() => {
    // localStorage 초기화
    localStorage.clear();
  });

  describe('loadFromStorage', () => {
    it('빈 키로 로드 시 빈 데이터를 반환해야 함', () => {
      const data = loadFromStorage('2026-01-12');

      expect(data.content).toBe('');
      expect(data.contentHash).toBe(calculateHashSync(''));
      expect(data.parentHash).toBeNull();
      expect(data.localUpdatedAt).toBeDefined();
    });

    it('저장된 데이터를 올바르게 로드해야 함', () => {
      const testDate = '2026-01-12';
      const testContent = 'Test content';

      saveToStorage(testDate, testContent);
      const loaded = loadFromStorage(testDate);

      expect(loaded.content).toBe(testContent);
      expect(loaded.contentHash).toBe(calculateHashSync(testContent));
      expect(loaded.localUpdatedAt).toBeDefined();
    });

    it('기존 문자열 데이터를 마이그레이션해야 함', () => {
      const testDate = '2026-01-12';
      const oldContent = 'Old string data';

      // 기존 형식으로 직접 저장
      localStorage.setItem(testDate, oldContent);

      const loaded = loadFromStorage(testDate);

      expect(loaded.content).toBe(oldContent);
      expect(loaded.contentHash).toBe(calculateHashSync(oldContent));
      expect(loaded.parentHash).toBeNull();
    });

    it('기존 JSON 데이터(hash 없음)를 마이그레이션해야 함', () => {
      const testDate = '2026-01-12';
      const oldData = {
        content: 'Old JSON data',
        localUpdatedAt: '2026-01-12T10:00:00.000Z',
      };

      localStorage.setItem(testDate, JSON.stringify(oldData));

      const loaded = loadFromStorage(testDate);

      expect(loaded.content).toBe(oldData.content);
      expect(loaded.contentHash).toBe(calculateHashSync(oldData.content));
      expect(loaded.parentHash).toBeNull();
      expect(loaded.localUpdatedAt).toBe(oldData.localUpdatedAt);
    });

    it('잘못된 JSON은 문자열로 처리해야 함', () => {
      const testDate = '2026-01-12';
      const invalidJson = '{invalid json}';

      localStorage.setItem(testDate, invalidJson);

      const loaded = loadFromStorage(testDate);

      expect(loaded.content).toBe(invalidJson);
      expect(loaded.contentHash).toBe(calculateHashSync(invalidJson));
    });
  });

  describe('saveToStorage', () => {
    it('데이터를 올바르게 저장해야 함', () => {
      const testDate = '2026-01-12';
      const testContent = 'Test content';

      saveToStorage(testDate, testContent);

      const stored = localStorage.getItem(testDate);
      expect(stored).toBeDefined();

      const parsed = JSON.parse(stored!);
      expect(parsed.content).toBe(testContent);
      expect(parsed.contentHash).toBe(calculateHashSync(testContent));
      // 빈 상태에서 시작하므로 빈 문자열의 해시가 parent
      expect(parsed.parentHash).toBe(calculateHashSync(''));
      expect(parsed.localUpdatedAt).toBeDefined();
    });

    it('내용 변경 시 기존 해시를 parent로 설정해야 함', () => {
      const testDate = '2026-01-12';
      const content1 = 'First content';
      const content2 = 'Second content';

      // 첫 번째 저장
      saveToStorage(testDate, content1);
      const firstHash = calculateHashSync(content1);

      // 두 번째 저장 (내용 변경)
      saveToStorage(testDate, content2);

      const loaded = loadFromStorage(testDate);

      expect(loaded.content).toBe(content2);
      expect(loaded.contentHash).toBe(calculateHashSync(content2));
      expect(loaded.parentHash).toBe(firstHash); // 이전 해시가 parent
    });

    it('내용이 동일하면 parentHash를 유지해야 함', () => {
      const testDate = '2026-01-12';
      const content = 'Same content';

      // 첫 번째 저장
      saveToStorage(testDate, content);
      const firstLoad = loadFromStorage(testDate);

      // 같은 내용으로 다시 저장
      saveToStorage(testDate, content);
      const secondLoad = loadFromStorage(testDate);

      expect(secondLoad.parentHash).toBe(firstLoad.parentHash);
    });

    it('명시적 parentHash를 제공하면 사용해야 함', () => {
      const testDate = '2026-01-12';
      const content = 'Test content';
      const explicitParent = 'abc123';

      saveToStorage(testDate, content, { parentHash: explicitParent });

      const loaded = loadFromStorage(testDate);

      expect(loaded.parentHash).toBe(explicitParent);
    });

    it('버전 체인을 올바르게 형성해야 함', () => {
      const testDate = '2026-01-12';
      const contentA = 'Version A';
      const contentB = 'Version B';
      const contentC = 'Version C';

      // A → B → C 체인 생성
      saveToStorage(testDate, contentA);
      const hashA = calculateHashSync(contentA);

      saveToStorage(testDate, contentB);
      const hashB = calculateHashSync(contentB);
      const loadedB = loadFromStorage(testDate);

      expect(loadedB.parentHash).toBe(hashA); // B.parent = A

      saveToStorage(testDate, contentC);
      const loadedC = loadFromStorage(testDate);

      expect(loadedC.parentHash).toBe(hashB); // C.parent = B
    });

    it('서버에서 받은 데이터는 parentHash를 명시적으로 설정해야 함', () => {
      const testDate = '2026-01-12';
      const serverContent = 'Server content';
      const serverParent = 'server-parent-hash';

      saveToStorage(testDate, serverContent, {
        parentHash: serverParent,
      });

      const loaded = loadFromStorage(testDate);

      expect(loaded.content).toBe(serverContent);
      expect(loaded.parentHash).toBe(serverParent);
    });

    it('null parentHash를 명시적으로 설정할 수 있어야 함', () => {
      const testDate = '2026-01-12';
      const content1 = 'Content 1';
      const content2 = 'Content 2';

      // 첫 번째 저장
      saveToStorage(testDate, content1);

      // 두 번째 저장 (parentHash를 null로 명시)
      saveToStorage(testDate, content2, { parentHash: null });

      const loaded = loadFromStorage(testDate);

      expect(loaded.content).toBe(content2);
      expect(loaded.parentHash).toBeNull();
    });
  });

  describe('버전 체인 시나리오', () => {
    it('시나리오 1: 로컬에서만 작업', () => {
      const date = '2026-01-12';

      // 1. 빈 상태
      const v0 = loadFromStorage(date);
      expect(v0.content).toBe('');
      const hash0 = v0.contentHash;

      // 2. 첫 작성
      saveToStorage(date, 'A');
      const v1 = loadFromStorage(date);
      expect(v1.content).toBe('A');
      expect(v1.parentHash).toBe(hash0);
      const hash1 = v1.contentHash;

      // 3. 수정
      saveToStorage(date, 'AB');
      const v2 = loadFromStorage(date);
      expect(v2.content).toBe('AB');
      expect(v2.parentHash).toBe(hash1);

      // 4. 다시 수정
      saveToStorage(date, 'ABC');
      const v3 = loadFromStorage(date);
      expect(v3.content).toBe('ABC');
      expect(v3.parentHash).toBe(v2.contentHash);
    });

    it('시나리오 2: 서버에서 받은 후 수정', () => {
      const date = '2026-01-12';
      const serverContent = 'Server data';
      const serverHash = calculateHashSync(serverContent);
      const serverParent = 'server-parent-123';

      // 1. 서버에서 받은 데이터 저장
      saveToStorage(date, serverContent, { parentHash: serverParent });
      const v1 = loadFromStorage(date);
      expect(v1.content).toBe(serverContent);
      expect(v1.parentHash).toBe(serverParent);

      // 2. 로컬에서 수정
      saveToStorage(date, 'Modified');
      const v2 = loadFromStorage(date);
      expect(v2.content).toBe('Modified');
      expect(v2.parentHash).toBe(serverHash); // 서버 해시가 parent
    });

    it('시나리오 3: Fast-forward 시뮬레이션', () => {
      const date = '2026-01-12';

      // 로컬: A
      saveToStorage(date, 'A');
      const localHash = calculateHashSync('A');

      // 서버: B (parent: A.hash)
      const serverContent = 'B';
      const serverParent = localHash;

      // Fast-forward: 서버 데이터로 업데이트
      saveToStorage(date, serverContent, { parentHash: serverParent });

      const loaded = loadFromStorage(date);
      expect(loaded.content).toBe('B');
      expect(loaded.parentHash).toBe(localHash); // B.parent = A.hash
    });
  });

  describe('엣지 케이스', () => {
    it('매우 긴 텍스트도 처리해야 함', () => {
      const testDate = '2026-01-12';
      const longContent = 'A'.repeat(100000);

      saveToStorage(testDate, longContent);
      const loaded = loadFromStorage(testDate);

      expect(loaded.content).toBe(longContent);
      expect(loaded.contentHash).toBeDefined();
    });

    it('특수문자가 포함된 내용도 처리해야 함', () => {
      const testDate = '2026-01-12';
      const content = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`"\'';

      saveToStorage(testDate, content);
      const loaded = loadFromStorage(testDate);

      expect(loaded.content).toBe(content);
    });

    it('여러 날짜의 데이터를 독립적으로 관리해야 함', () => {
      const date1 = '2026-01-12';
      const date2 = '2026-01-13';
      const content1 = 'Content for date 1';
      const content2 = 'Content for date 2';

      saveToStorage(date1, content1);
      saveToStorage(date2, content2);

      const loaded1 = loadFromStorage(date1);
      const loaded2 = loadFromStorage(date2);

      expect(loaded1.content).toBe(content1);
      expect(loaded2.content).toBe(content2);
      expect(loaded1.contentHash).not.toBe(loaded2.contentHash);
    });
  });
});
