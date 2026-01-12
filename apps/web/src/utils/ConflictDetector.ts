/**
 * 충돌 감지 유틸리티
 */

export type ConflictResult =
  | { type: 'NO_CONFLICT_SAME' }
  | { type: 'FAST_FORWARD'; useServer: true }
  | { type: 'LOCAL_AHEAD'; uploadLocal: true }
  | { type: 'CONFLICT_DIVERGED'; requireUserChoice: true };

export interface VersionNode {
  contentHash: string;
  parentHash: string | null;
}

/**
 * Linked list 기반 충돌 감지
 *
 * @param local - 로컬 버전 정보
 * @param server - 서버 버전 정보
 * @returns 충돌 감지 결과
 */
export function detectConflict(
  local: VersionNode,
  server: VersionNode,
): ConflictResult {
  // Case 1: 동일한 내용 (해시 일치)
  if (local.contentHash === server.contentHash) {
    return { type: 'NO_CONFLICT_SAME' };
  }

  // Case 2: Fast-forward (서버가 로컬의 다음 버전)
  // server.parentHash === local.contentHash
  if (server.parentHash === local.contentHash) {
    return { type: 'FAST_FORWARD', useServer: true };
  }

  // Case 3: Local ahead (로컬이 서버의 다음 버전)
  // local.parentHash === server.contentHash
  if (local.parentHash === server.contentHash) {
    return { type: 'LOCAL_AHEAD', uploadLocal: true };
  }

  // Case 4: Conflict (분기 발생 또는 연결 끊김)
  return { type: 'CONFLICT_DIVERGED', requireUserChoice: true };
}
