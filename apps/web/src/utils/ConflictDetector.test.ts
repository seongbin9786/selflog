import { describe, expect, it } from 'vitest';

import { detectConflict, type VersionNode } from './ConflictDetector';

describe('ConflictDetector', () => {
  describe('detectConflict', () => {
    describe('케이스 1: 동일한 내용 (NO_CONFLICT_SAME)', () => {
      it('해시가 동일하면 충돌 없음', () => {
        const local: VersionNode = {
          contentHash: 'abc123',
          parentHash: null,
        };

        const server: VersionNode = {
          contentHash: 'abc123',
          parentHash: null,
        };

        const result = detectConflict(local, server);

        expect(result.type).toBe('NO_CONFLICT_SAME');
      });

      it('parentHash가 달라도 contentHash가 같으면 충돌 없음', () => {
        const local: VersionNode = {
          contentHash: 'abc123',
          parentHash: 'parent1',
        };

        const server: VersionNode = {
          contentHash: 'abc123',
          parentHash: 'parent2',
        };

        const result = detectConflict(local, server);

        expect(result.type).toBe('NO_CONFLICT_SAME');
      });
    });

    describe('케이스 2: Fast-Forward (FAST_FORWARD)', () => {
      it('서버가 로컬의 다음 버전이면 Fast-forward', () => {
        const local: VersionNode = {
          contentHash: 'abc123',
          parentHash: null,
        };

        const server: VersionNode = {
          contentHash: 'def456',
          parentHash: 'abc123', // 서버의 부모 = 로컬 해시
        };

        const result = detectConflict(local, server);

        expect(result.type).toBe('FAST_FORWARD');
        if (result.type === 'FAST_FORWARD') {
          expect(result.useServer).toBe(true);
        }
      });

      it('버전 체인: A(local) → B(server)', () => {
        const hashA = 'hash-A';
        const hashB = 'hash-B';

        const local: VersionNode = {
          contentHash: hashA,
          parentHash: null,
        };

        const server: VersionNode = {
          contentHash: hashB,
          parentHash: hashA,
        };

        const result = detectConflict(local, server);

        expect(result.type).toBe('FAST_FORWARD');
      });

      it('버전 체인: A → B(local) → C(server)', () => {
        const hashB = 'hash-B';
        const hashC = 'hash-C';

        const local: VersionNode = {
          contentHash: hashB,
          parentHash: 'hash-A',
        };

        const server: VersionNode = {
          contentHash: hashC,
          parentHash: hashB, // C의 부모 = B
        };

        const result = detectConflict(local, server);

        expect(result.type).toBe('FAST_FORWARD');
      });
    });

    describe('케이스 3: Local Ahead (LOCAL_AHEAD)', () => {
      it('로컬이 서버의 다음 버전이면 Local ahead', () => {
        const local: VersionNode = {
          contentHash: 'def456',
          parentHash: 'abc123', // 로컬의 부모 = 서버 해시
        };

        const server: VersionNode = {
          contentHash: 'abc123',
          parentHash: null,
        };

        const result = detectConflict(local, server);

        expect(result.type).toBe('LOCAL_AHEAD');
        if (result.type === 'LOCAL_AHEAD') {
          expect(result.uploadLocal).toBe(true);
        }
      });

      it('버전 체인: A(server) → B(local)', () => {
        const hashA = 'hash-A';
        const hashB = 'hash-B';

        const local: VersionNode = {
          contentHash: hashB,
          parentHash: hashA,
        };

        const server: VersionNode = {
          contentHash: hashA,
          parentHash: null,
        };

        const result = detectConflict(local, server);

        expect(result.type).toBe('LOCAL_AHEAD');
      });

      it('오프라인 작업 후 온라인: A(server) → B → C(local)', () => {
        const hashA = 'hash-A';
        const hashC = 'hash-C';

        const local: VersionNode = {
          contentHash: hashC,
          parentHash: 'hash-B', // C → B → A
        };

        const server: VersionNode = {
          contentHash: hashA,
          parentHash: null,
        };

        // 이 경우 C.parent(B) ≠ A → Conflict
        // 실제로는 B → A 체인을 추적할 수 없으므로 충돌로 감지됨
        // 단, 이 테스트는 단순화된 케이스 (직계 부모-자식 관계만)
        const result = detectConflict(local, server);

        expect(result.type).toBe('CONFLICT_DIVERGED');
        // 현재 구현은 직계 관계만 확인하므로 충돌로 감지
        // 더 복잡한 체인 추적은 향후 확장 가능
      });
    });

    describe('케이스 4: Conflict - 분기 발생 (CONFLICT_DIVERGED)', () => {
      it('공통 조상에서 분기하면 충돌', () => {
        const commonAncestor = 'hash-A';

        const local: VersionNode = {
          contentHash: 'hash-B',
          parentHash: commonAncestor,
        };

        const server: VersionNode = {
          contentHash: 'hash-C',
          parentHash: commonAncestor,
        };

        const result = detectConflict(local, server);

        expect(result.type).toBe('CONFLICT_DIVERGED');
        if (result.type === 'CONFLICT_DIVERGED') {
          expect(result.requireUserChoice).toBe(true);
        }
      });

      it('연결이 끊긴 경우 충돌', () => {
        const local: VersionNode = {
          contentHash: 'hash-B',
          parentHash: 'hash-X',
        };

        const server: VersionNode = {
          contentHash: 'hash-C',
          parentHash: 'hash-Y',
        };

        const result = detectConflict(local, server);

        expect(result.type).toBe('CONFLICT_DIVERGED');
      });

      it('양쪽 모두 부모가 null이지만 해시가 다른 경우 충돌', () => {
        const local: VersionNode = {
          contentHash: 'hash-B',
          parentHash: null,
        };

        const server: VersionNode = {
          contentHash: 'hash-C',
          parentHash: null,
        };

        const result = detectConflict(local, server);

        expect(result.type).toBe('CONFLICT_DIVERGED');
      });
    });

    describe('실제 시나리오', () => {
      it('시나리오 1: 정상 동기화 (Fast-forward)', () => {
        // 1. 초기: A
        // 2. 다른 기기: A → B
        // 3. 현재 기기: A에서 B 받음

        const local: VersionNode = {
          contentHash: 'abc123',
          parentHash: null,
        };

        const server: VersionNode = {
          contentHash: 'def456',
          parentHash: 'abc123',
        };

        const result = detectConflict(local, server);

        expect(result.type).toBe('FAST_FORWARD');
        // → 서버 버전 사용, 충돌 없음
      });

      it('시나리오 2: 오프라인 작업 후 업로드 (Local ahead)', () => {
        // 1. 서버: A
        // 2. 오프라인: A → B 작성
        // 3. 온라인: 서버에 B 업로드

        const local: VersionNode = {
          contentHash: 'def456',
          parentHash: 'abc123',
        };

        const server: VersionNode = {
          contentHash: 'abc123',
          parentHash: null,
        };

        const result = detectConflict(local, server);

        expect(result.type).toBe('LOCAL_AHEAD');
        // → 로컬 버전 업로드, 충돌 없음
      });

      it('시나리오 3: 동시 수정 (Conflict!)', () => {
        // 1. 초기 서버: A
        // 2. 클라 1: A → B (오프라인)
        // 3. 클라 2: A → C (서버 저장)
        // 4. 클라 1: 온라인 복귀

        const commonAncestor = 'abc123';

        const local: VersionNode = {
          contentHash: 'def456', // B
          parentHash: commonAncestor,
        };

        const server: VersionNode = {
          contentHash: 'xyz789', // C
          parentHash: commonAncestor,
        };

        const result = detectConflict(local, server);

        expect(result.type).toBe('CONFLICT_DIVERGED');
        // → 사용자 선택 필요!
      });

      it('시나리오 4: 이미 동기화됨 (Same)', () => {
        // 1. 서버: A
        // 2. 로컬: A (이미 같음)

        const local: VersionNode = {
          contentHash: 'abc123',
          parentHash: null,
        };

        const server: VersionNode = {
          contentHash: 'abc123',
          parentHash: null,
        };

        const result = detectConflict(local, server);

        expect(result.type).toBe('NO_CONFLICT_SAME');
        // → 아무 작업 불필요
      });

      it('시나리오 5: 서버가 여러 버전 앞서 있음 (Fast-forward)', () => {
        // 1. 로컬: A
        // 2. 서버: A → B → C → D
        // 3. 서버의 D.parent = C (C는 중간 버전)

        const local: VersionNode = {
          contentHash: 'hash-A',
          parentHash: null,
        };

        const server: VersionNode = {
          contentHash: 'hash-D',
          parentHash: 'hash-C',
        };

        const result = detectConflict(local, server);

        // D.parent(C) ≠ A.hash → 충돌
        // 현재 구현은 직계만 확인하므로 충돌 감지
        expect(result.type).toBe('CONFLICT_DIVERGED');

        // 실제로는 체인을 따라가면 A → B → C → D이므로
        // Fast-forward 가능하지만, 현재 구현은 직계만 확인
        // 향후 개선 가능
      });
    });

    describe('엣지 케이스', () => {
      it('로컬 parentHash가 null, 서버는 값 있음', () => {
        const local: VersionNode = {
          contentHash: 'hash-B',
          parentHash: null,
        };

        const server: VersionNode = {
          contentHash: 'hash-C',
          parentHash: 'hash-A',
        };

        const result = detectConflict(local, server);

        expect(result.type).toBe('CONFLICT_DIVERGED');
      });

      it('서버 parentHash가 null, 로컬은 값 있음', () => {
        const local: VersionNode = {
          contentHash: 'hash-B',
          parentHash: 'hash-A',
        };

        const server: VersionNode = {
          contentHash: 'hash-C',
          parentHash: null,
        };

        const result = detectConflict(local, server);

        expect(result.type).toBe('CONFLICT_DIVERGED');
      });

      it('양쪽 모두 parentHash가 null이고 해시가 같음', () => {
        const local: VersionNode = {
          contentHash: 'hash-A',
          parentHash: null,
        };

        const server: VersionNode = {
          contentHash: 'hash-A',
          parentHash: null,
        };

        const result = detectConflict(local, server);

        expect(result.type).toBe('NO_CONFLICT_SAME');
      });

      it('빈 문자열 해시도 처리 가능', () => {
        const emptyHash = '';

        const local: VersionNode = {
          contentHash: emptyHash,
          parentHash: null,
        };

        const server: VersionNode = {
          contentHash: emptyHash,
          parentHash: null,
        };

        const result = detectConflict(local, server);

        expect(result.type).toBe('NO_CONFLICT_SAME');
      });
    });
  });
});
