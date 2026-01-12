/**
 * 충돌 감지 통합 테스트
 * 실제 사용 시나리오를 시뮬레이션
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { detectConflict } from '../../utils/ConflictDetector';
import { calculateHashSync } from '../../utils/HashUtil';
import { loadFromStorage, saveToStorage } from '../../utils/StorageUtil';

describe('충돌 감지 통합 테스트', () => {
  const TEST_DATE = '2026-01-12';

  beforeEach(() => {
    localStorage.clear();
  });

  describe('시나리오 1: 단일 기기에서 순차 작업', () => {
    it('충돌 없이 버전 체인이 형성되어야 함', () => {
      // 1. 빈 상태로 시작
      const v0 = loadFromStorage(TEST_DATE);
      expect(v0.content).toBe('');

      // 2. 첫 작성
      const content1 = '09:00 회의';
      saveToStorage(TEST_DATE, content1);
      const v1 = loadFromStorage(TEST_DATE);
      expect(v1.content).toBe(content1);

      // 3. 수정
      const content2 = '09:00 회의\n10:00 개발';
      saveToStorage(TEST_DATE, content2);
      const v2 = loadFromStorage(TEST_DATE);
      expect(v2.content).toBe(content2);
      expect(v2.parentHash).toBe(v1.contentHash); // 체인 형성

      // 4. 또 수정
      const content3 = '09:00 회의\n10:00 개발\n11:00 점심';
      saveToStorage(TEST_DATE, content3);
      const v3 = loadFromStorage(TEST_DATE);
      expect(v3.content).toBe(content3);
      expect(v3.parentHash).toBe(v2.contentHash); // 체인 계속
    });
  });

  describe('시나리오 2: Fast-forward (정상 동기화)', () => {
    it('서버가 로컬의 다음 버전일 때 자동 업데이트', () => {
      // 1. 로컬: A 작성
      const contentA = '09:00 회의';
      saveToStorage(TEST_DATE, contentA);
      const localVersion = loadFromStorage(TEST_DATE);

      // 2. 서버에서 가져온 데이터: B (A의 다음 버전)
      const contentB = '09:00 회의\n10:00 개발';
      const hashB = calculateHashSync(contentB);
      const serverVersion = {
        content: contentB,
        contentHash: hashB,
        parentHash: localVersion.contentHash, // B의 부모 = A
      };

      // 3. 충돌 감지
      const conflict = detectConflict(localVersion, serverVersion);

      // 4. Fast-forward 감지
      expect(conflict.type).toBe('FAST_FORWARD');

      // 5. 서버 버전으로 업데이트
      saveToStorage(TEST_DATE, serverVersion.content, {
        parentHash: serverVersion.parentHash,
      });

      const updated = loadFromStorage(TEST_DATE);
      expect(updated.content).toBe(contentB);
      expect(updated.parentHash).toBe(localVersion.contentHash);
    });
  });

  describe('시나리오 3: Local ahead (오프라인 작업 후 업로드)', () => {
    it('로컬이 서버보다 앞설 때 업로드 가능', () => {
      // 1. 서버 상태: A
      const serverContent = '09:00 회의';
      const serverHash = calculateHashSync(serverContent);
      const serverVersion = {
        contentHash: serverHash,
        parentHash: null,
      };

      // 2. 로컬에서 A를 받아서 B로 수정 (오프라인)
      saveToStorage(TEST_DATE, serverContent, { parentHash: null });
      const contentB = '09:00 회의\n10:00 개발';
      saveToStorage(TEST_DATE, contentB);

      const localVersion = loadFromStorage(TEST_DATE);

      // 3. 충돌 감지
      const conflict = detectConflict(localVersion, serverVersion);

      // 4. Local ahead 감지
      expect(conflict.type).toBe('LOCAL_AHEAD');

      // 5. 로컬 버전을 서버에 업로드할 수 있음
      expect(localVersion.parentHash).toBe(serverHash);
    });
  });

  describe('시나리오 4: 충돌 발생 (동시 수정)', () => {
    it('공통 조상에서 분기 시 충돌 감지', () => {
      // 1. 초기 서버 상태: A
      const contentA = '09:00 회의';
      const hashA = calculateHashSync(contentA);

      // 2. 클라이언트 1: A → B (오프라인)
      saveToStorage(TEST_DATE, contentA, { parentHash: null });
      const contentB = '09:00 회의\n10:00 개발 (클라 1)';
      saveToStorage(TEST_DATE, contentB);
      const client1Version = loadFromStorage(TEST_DATE);

      // 3. 클라이언트 2: A → C (서버에 저장됨)
      const contentC = '09:00 회의\n10:00 개발 (클라 2)';
      const hashC = calculateHashSync(contentC);
      const serverVersion = {
        contentHash: hashC,
        parentHash: hashA, // C의 부모 = A
      };

      // 4. 클라이언트 1 온라인 복귀, 충돌 감지
      const conflict = detectConflict(client1Version, serverVersion);

      // 5. 충돌 확인
      expect(conflict.type).toBe('CONFLICT_DIVERGED');
      if (conflict.type === 'CONFLICT_DIVERGED') {
        expect(conflict.requireUserChoice).toBe(true);
      }

      // 6. 양쪽 모두 A에서 분기했음을 확인
      expect(client1Version.parentHash).toBe(hashA); // B.parent = A
      expect(serverVersion.parentHash).toBe(hashA); // C.parent = A
    });

    it('충돌 해결 후 새로운 버전 생성', () => {
      // (앞의 충돌 상황에서 계속)
      const contentB = '09:00 회의\n10:00 개발 (클라 1)';
      const hashB = calculateHashSync(contentB);

      // 1. 사용자가 클라 1 버전(B)을 선택
      const resolvedContent = contentB;

      // 2. 해결된 버전을 저장 (새 버전 D 생성)
      // D.parent = B (선택한 쪽)
      saveToStorage(TEST_DATE, resolvedContent, {
        parentHash: hashB,
      });

      const resolved = loadFromStorage(TEST_DATE);

      // 3. 새로운 버전이 생성됨
      expect(resolved.content).toBe(resolvedContent);
      expect(resolved.parentHash).toBe(hashB);
    });
  });

  describe('시나리오 5: 복잡한 버전 히스토리', () => {
    it('여러 번의 수정과 동기화', () => {
      // 1. 초기: 빈 상태
      const empty = loadFromStorage(TEST_DATE);
      const emptyHash = empty.contentHash;

      // 2. A 작성
      const contentA = 'A';
      saveToStorage(TEST_DATE, contentA);
      const vA = loadFromStorage(TEST_DATE);
      expect(vA.parentHash).toBe(emptyHash);

      // 3. A → B
      const contentB = 'AB';
      saveToStorage(TEST_DATE, contentB);
      const vB = loadFromStorage(TEST_DATE);
      expect(vB.parentHash).toBe(vA.contentHash);

      // 4. 서버에서 C를 받음 (C.parent = B)
      const contentC = 'ABC';
      const hashC = calculateHashSync(contentC);
      const serverC = {
        contentHash: hashC,
        parentHash: vB.contentHash,
      };

      const conflict1 = detectConflict(vB, serverC);
      expect(conflict1.type).toBe('FAST_FORWARD');

      // 5. C로 업데이트
      saveToStorage(TEST_DATE, contentC, { parentHash: vB.contentHash });
      const vC = loadFromStorage(TEST_DATE);

      // 6. C → D 로컬 수정
      const contentD = 'ABCD';
      saveToStorage(TEST_DATE, contentD);
      const vD = loadFromStorage(TEST_DATE);
      expect(vD.parentHash).toBe(vC.contentHash);

      // 7. 서버 확인: 여전히 C
      const conflict2 = detectConflict(vD, serverC);
      expect(conflict2.type).toBe('LOCAL_AHEAD');

      // 체인 확인: empty → A → B → C → D
      expect(vD.parentHash).toBe(hashC); // D → C
      expect(vC.parentHash).toBe(vB.contentHash); // C → B
      expect(vB.parentHash).toBe(vA.contentHash); // B → A
      expect(vA.parentHash).toBe(emptyHash); // A → empty
    });
  });

  describe('시나리오 6: 동일 내용 감지', () => {
    it('다른 경로로 도달해도 내용이 같으면 충돌 없음', () => {
      const content = '09:00 회의\n10:00 개발';
      const hash = calculateHashSync(content);

      // 로컬과 서버가 다른 부모를 가지지만 내용은 같음
      const local = {
        contentHash: hash,
        parentHash: 'parent-1',
      };

      const server = {
        contentHash: hash,
        parentHash: 'parent-2',
      };

      const conflict = detectConflict(local, server);

      // 내용이 같으므로 충돌 없음
      expect(conflict.type).toBe('NO_CONFLICT_SAME');
    });
  });

  describe('시나리오 7: 마이그레이션', () => {
    it('기존 문자열 데이터를 자동으로 마이그레이션', () => {
      // 1. 기존 형식으로 저장 (해시 없음)
      const oldContent = '09:00 회의';
      localStorage.setItem(TEST_DATE, oldContent);

      // 2. 로드 시 자동 마이그레이션
      const migrated = loadFromStorage(TEST_DATE);

      expect(migrated.content).toBe(oldContent);
      expect(migrated.contentHash).toBe(calculateHashSync(oldContent));
      expect(migrated.parentHash).toBeNull();

      // 3. 수정 시 체인 생성
      const newContent = '09:00 회의\n10:00 개발';
      saveToStorage(TEST_DATE, newContent);

      const updated = loadFromStorage(TEST_DATE);
      expect(updated.parentHash).toBe(migrated.contentHash);
    });

    it('기존 JSON 데이터(hash 없음)를 마이그레이션', () => {
      const oldData = {
        content: '09:00 회의',
        localUpdatedAt: '2026-01-12T10:00:00.000Z',
      };

      localStorage.setItem(TEST_DATE, JSON.stringify(oldData));

      const migrated = loadFromStorage(TEST_DATE);

      expect(migrated.content).toBe(oldData.content);
      expect(migrated.contentHash).toBe(calculateHashSync(oldData.content));
      expect(migrated.parentHash).toBeNull();
      expect(migrated.localUpdatedAt).toBe(oldData.localUpdatedAt);
    });
  });

  describe('엣지 케이스', () => {
    it('빈 문자열에서 내용 추가', () => {
      // 1. 빈 상태
      const empty = loadFromStorage(TEST_DATE);
      const emptyHash = empty.contentHash;

      // 2. 내용 추가
      const content = '09:00 회의';
      saveToStorage(TEST_DATE, content);

      const v1 = loadFromStorage(TEST_DATE);
      expect(v1.parentHash).toBe(emptyHash);
    });

    it('내용 삭제 (빈 문자열로)', () => {
      // 1. 내용 있음
      const content = '09:00 회의';
      saveToStorage(TEST_DATE, content);
      const v1 = loadFromStorage(TEST_DATE);

      // 2. 모두 삭제
      saveToStorage(TEST_DATE, '');
      const v2 = loadFromStorage(TEST_DATE);

      expect(v2.content).toBe('');
      expect(v2.parentHash).toBe(v1.contentHash);
    });

    it('같은 내용으로 여러 번 저장', () => {
      const content = '09:00 회의';

      saveToStorage(TEST_DATE, content);
      const v1 = loadFromStorage(TEST_DATE);

      // 같은 내용으로 다시 저장
      saveToStorage(TEST_DATE, content);
      const v2 = loadFromStorage(TEST_DATE);

      // parentHash 유지 (변경 없음)
      expect(v2.parentHash).toBe(v1.parentHash);
      expect(v2.contentHash).toBe(v1.contentHash);
    });
  });
});
