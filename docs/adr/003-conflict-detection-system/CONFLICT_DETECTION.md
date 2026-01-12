# 충돌 탐지 시스템 (Conflict Detection System)

## 개요

본 시스템은 Git과 유사한 Linked List of Hashes 방식을 사용하여 로컬과 서버 간의 데이터 동기화 충돌을 감지합니다. 단순한 타임스탬프 비교가 아닌, 버전 체인을 추적하여 정확한 충돌 판단을 수행합니다.

## 핵심 개념

### 1. Content Hash

각 버전의 내용(content)에 대해 해시를 계산하여 고유 식별자로 사용합니다.

```typescript
contentHash = hash(content); // FNV-1a 알고리즘 사용
```

특징:

- 내용이 같으면 해시도 동일
- 내용이 조금이라도 다르면 해시도 다름
- 빠른 동등성 비교 가능

### 2. Parent Hash

이전 버전의 해시를 참조하여 버전 체인을 형성합니다.

```typescript
interface VersionNode {
  content: string;
  contentHash: string; // 현재 버전의 해시
  parentHash: string | null; // 이전 버전의 해시 (부모)
}
```

버전 체인 예시:

```
A (hash: "abc123", parent: null)
  ↓
B (hash: "def456", parent: "abc123")
  ↓
C (hash: "xyz789", parent: "def456")
```

### 3. Linked List 구조

각 버전이 부모를 가리키는 단방향 연결 리스트를 형성합니다.

```
null ← A ← B ← C ← D (latest)
```

## 충돌 감지 알고리즘

### 케이스 1: 동일 내용 (No Conflict)

```
localHash === serverHash
```

판정: 충돌 없음 (동일한 버전)

예시:

```
로컬:  A (hash: "abc123")
서버:  A (hash: "abc123")

→ 동일 → 아무 작업 불필요
```

---

### 케이스 2: Fast-Forward (No Conflict)

```
serverParentHash === localHash
```

판정: 서버가 로컬의 직계 후손 (Fast-forward 가능)

처리: 서버 버전 사용

예시:

```
로컬:  A (hash: "abc123", parent: null)
서버:  B (hash: "def456", parent: "abc123")

serverParent ("abc123") === localHash ("abc123")
→ 서버가 로컬의 다음 버전
→ Fast-forward: 로컬을 B로 업데이트
```

시퀀스:

```
1. 로컬: A
2. 다른 기기에서: A → B 수정 후 서버 저장
3. 로컬: 서버에서 B 가져옴
4. 확인: B.parent === A.hash → Fast-forward 가능
5. 로컬 = B (충돌 없음)
```

---

### 케이스 3: Local Ahead (No Conflict)

```
localParentHash === serverHash
```

판정: 로컬이 서버의 직계 후손

처리: 로컬 버전을 서버에 업로드

예시:

```
로컬:  B (hash: "def456", parent: "abc123")
서버:  A (hash: "abc123", parent: null)

localParent ("abc123") === serverHash ("abc123")
→ 로컬이 서버의 다음 버전
→ 로컬 업로드
```

시퀀스:

```
1. 서버: A
2. 로컬 (오프라인): A → B 수정
3. 로컬 (온라인): 서버 확인
4. 확인: B.parent === A.hash → Local ahead
5. 서버에 B 업로드 (충돌 없음)
```

---

### 케이스 4: Diverged - Conflict

```
서버와 로컬이 같은 조상에서 분기
또는 연결 관계가 없음
```

판정: 충돌! (사용자 선택 필요)

예시 1: 공통 조상에서 분기

```
        A (hash: "abc123")
       ↙ ↘
로컬: B    C :서버
(def456) (xyz789)

B.parent === A.hash ("abc123")
C.parent === A.hash ("abc123")

BUT:
- C.parent ≠ B.hash
- B.parent ≠ C.hash

→ 공통 조상 A에서 분기 → Conflict!
```

예시 2: 연결 끊김

```
로컬: B (hash: "def456", parent: "zzz999")
서버: C (hash: "xyz789", parent: "www888")

parent가 서로를 가리키지 않음
→ Conflict!
```

시퀀스:

```
1. 초기 서버: A
2. 클라이언트 1 (오프라인): A → B 수정
3. 클라이언트 2: A → C 수정 후 서버 저장
4. 서버: C
5. 클라이언트 1 (온라인): 서버 확인
6. 확인:
   - C.parent ("abc123") ≠ B.hash ("def456")
   - B.parent ("abc123") ≠ C.hash ("xyz789")
   → Conflict 감지!
7. 사용자에게 선택 UI 표시
```

---

## 왜 updatedAt만으로는 부족한가?

### updatedAt의 문제점

```
시나리오:
1. 서버: "A" (10:00)
2. 클라 1: "A" (변경 없음, 10:05에 페이지 접속)
3. 클라 2: "A" → "C" (서버 저장, 10:03)

updatedAt 비교:
  local (10:05) > server (10:03)
  → 로컬 승리
  → "A" 선택
  → 서버의 "C"가 사라짐!
```

### Hash 기반의 해결

```
같은 시나리오:
1. 서버: "A" (hash: "abc")
2. 클라 1: "A" (hash: "abc", parent: null)
3. 클라 2: "C" (hash: "xyz", parent: "abc")

Hash 비교:
  local.hash ("abc") ≠ server.hash ("xyz")
  server.parent ("abc") === local.hash ("abc")
  → Fast-forward!
  → 서버 승리 ("C" 선택)
  → 데이터 보존!
```

## 데이터 구조

### 로컬 스토리지

```typescript
interface LocalLogData {
  content: string; // 내용
  contentHash: string; // 내용의 해시
  parentHash: string | null; // 부모 버전의 해시
  localUpdatedAt: string; // 로컬 수정 시간
}
```

저장 예시:

```json
{
  "content": "09:00 회의\n10:00 개발",
  "contentHash": "a1b2c3d4",
  "parentHash": "9f8e7d6c",
  "localUpdatedAt": "2026-01-12T10:05:00.000Z"
}
```

### 서버 DB (DynamoDB)

```typescript
interface LogItem {
  userId: string; // Partition Key
  date: string; // Sort Key
  content: string;
  contentHash: string;
  parentHash: string | null;
  updatedAt: string;
  version: number;
}
```

## API 명세

### POST /raw-logs

로그를 서버에 저장합니다.

Request:

```typescript
{
  date: string; // YYYY-MM-DD
  content: string;
  contentHash: string;
  parentHash: string | null; // 부모 해시
}
```

Response:

```typescript
{
  success: boolean;
  data: {
    userId: string;
    date: string;
    content: string;
    contentHash: string;
    parentHash: string | null;
    updatedAt: string;
    version: number;
  }
}
```

### GET /raw-logs/:date

특정 날짜의 로그를 가져옵니다.

Response:

```typescript
{
  userId: string;
  date: string;
  content: string;
  contentHash: string;
  parentHash: string | null;
  updatedAt: string;
  version: number;
}
```

## 충돌 해결 프로세스

### 1. 충돌 감지 시

시스템이 자동으로 `ConflictDialog`를 표시합니다.

```
┌─────────────────────────────────────────────────┐
│ 동시 수정 충돌 감지                              │
├─────────────────────────────────────────────────┤
│                                                 │
│  로컬 버전              서버 버전                │
│  2026-01-12 10:05      2026-01-12 10:03         │
│  ┌─────────────┐       ┌─────────────┐          │
│  │ 09:00 회의  │       │ 09:30 회의  │          │
│  │ 10:00 개발  │       │ 11:00 개발  │          │
│  └─────────────┘       └─────────────┘          │
│                                                 │
├─────────────────────────────────────────────────┤
│       [취소]  [로컬 사용]  [서버 사용]          │
└─────────────────────────────────────────────────┘
```

### 2. 사용자 선택

- 로컬 사용: 로컬 버전을 서버에 저장 (서버 버전 덮어쓰기)
- 서버 사용: 서버 버전으로 로컬 업데이트 (로컬 버전 버림)
- 취소: 충돌 상태 유지 (나중에 다시 선택)

### 3. 충돌 해결 후

선택한 버전이 새로운 체인으로 저장됩니다.

```
충돌 전:
    A
   ↙ ↘
  B   C

충돌 해결 (B 선택):
    A
   ↙ ↘
  B   C
  ↓
  D (해결됨)
```

## 구현 세부사항

### Hash 계산

FNV-1a 알고리즘 사용 (빠르고 효율적)

```typescript
function calculateHashSync(content: string): string {
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i);
    hash +=
      (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16);
}
```

### 로컬 저장 시 Parent 결정

```typescript
// 1. 서버에서 받은 경우 → 명시적 parentHash 사용
saveToStorage(date, content, { parentHash: serverHash });

// 2. 로컬 수정 시 → 기존 contentHash를 parent로
const existing = loadFromStorage(date);
const newHash = calculateHashSync(newContent);
if (newHash !== existing.contentHash) {
  parentHash = existing.contentHash; // 체인 생성
}
```

### 충돌 감지 로직 (의사코드)

```typescript
function detectConflict(local, server) {
  // Case 1: 동일
  if (local.hash === server.hash) {
    return "NO_CONFLICT_SAME";
  }

  // Case 2: Fast-forward
  if (server.parent === local.hash) {
    return "FAST_FORWARD";
  }

  // Case 3: Local ahead
  if (local.parent === server.hash) {
    return "LOCAL_AHEAD";
  }

  // Case 4: Conflict
  return "CONFLICT_DIVERGED";
}
```

## 제약사항 및 고려사항

### 1. 해시 충돌

FNV-1a는 빠르지만 SHA-256보다 충돌 확률이 높습니다.

- 실제 로그 데이터에서는 충돌 가능성 극히 낮음
- 필요 시 SHA-256으로 전환 가능 (비동기 처리 필요)

### 2. 마이그레이션

기존 데이터는 자동으로 마이그레이션됩니다:

- 기존 문자열 → JSON 변환
- 기존 JSON (hash 없음) → hash 계산 + parentHash: null

### 3. Merge 기능 없음

Git처럼 자동 merge는 지원하지 않습니다. 충돌 시 반드시 사용자가 하나를 선택해야 합니다.

### 4. 다중 분기 추적 제한

공통 조상은 추적하지 않고, 직계 부모만 추적합니다.

- Git의 `merge commit` (두 부모) 미지원
- 충돌 해결 시 선택한 쪽의 해시만 parent로 기록

## 테스트 시나리오

### 시나리오 1: 정상 동기화

```
1. A 작성 → 서버 저장
2. A → B 수정 → 서버 저장
3. 다른 기기에서 접속
4. 결과: B.parent === A.hash → Fast-forward → B 사용
```

### 시나리오 2: 오프라인 작업

```
1. 서버: A
2. 오프라인: A → B → C 수정
3. 온라인: 서버 확인
4. 결과: C.parent → B → A → Local ahead → C 업로드
```

### 시나리오 3: 충돌 발생

```
1. 서버: A
2. 클라 1 (오프라인): A → B
3. 클라 2: A → C → 서버 저장
4. 클라 1 (온라인): 서버 확인
5. 결과: B.parent === A, C.parent === A → Conflict!
6. 사용자 선택 → 해결
```

## 로깅 및 디버깅

콘솔에서 충돌 감지 상황을 확인할 수 있습니다:

```
[FAST-FORWARD] Server is ahead
  Local: abc12345
  Server: def67890 (parent: abc12345)

[LOCAL AHEAD] Pushing local to server
  Server: abc12345
  Local: def67890 (parent: abc12345)

[CONFLICT] Diverged from common ancestor
  Local: def67890 (parent: abc12345)
  Server: xyz00000 (parent: abc12345)
  Local time: 2026-01-12T10:05:00.000Z
  Server time: 2026-01-12T10:03:00.000Z
```

## 참고

- Git의 3-way merge와 유사하지만 자동 병합은 지원하지 않음
- 단순하고 예측 가능한 동작 우선
- 사용자 데이터 보호가 최우선 목표
