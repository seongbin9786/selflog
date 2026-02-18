# 에디터 동기화 안정화 재설계 제안

## 1. 문제 정의

백엔드 동기화 도입 이후 에디터가 불안정해진 핵심 원인은 **사용자 편집, 하이드레이션, 복원, 타이머 갱신이 하나의 액션/경로로 섞여** 저장 및 서버 동기화가 무차별적으로 발생하기 때문입니다.  
이 구조에서는 동기화 루프와 레이스가 쉽게 생기며, 사용자는 데이터 유실 위험을 체감하게 됩니다.

---

## 2. 확인된 구조적 원인

1. `storage` 이벤트 payload가 에디터 raw 텍스트로 직접 유입됨
   - wrapper JSON이 textarea로 들어와 파싱 오염/재저장 루프 유발 가능

2. `updateRawLog` 단일 액션 과부하
   - 사용자 타이핑/날짜 이동 hydrate/히스토리 복원/30초 갱신이 같은 동기화 파이프를 통과

3. 날짜 이동 시 hydrate와 업로드 예약이 결합됨
   - 서버 fetch 이전에 stale 로컬이 업로드될 수 있는 레이스 존재

4. 30초 주기 갱신이 저장/동기화 경로를 계속 타는 문제
   - 실시간 차트 갱신 목적이 불필요한 네트워크/저장 트래픽으로 변질

5. 서버 overwrite 허용(조건부 쓰기 부재)
   - 클라이언트 충돌/레이스를 서버가 최종 방어하지 못함

---

## 3. 재설계 목표

1. **데이터 유실 방지 우선**
2. **도메인 경계 명확화** (editor/store vs storage payload)
3. **동기화 경로 단일화** (명확한 상태기계 + 큐)
4. **서버 CAS 기반의 최종 일관성 보장**

---

## 4. 근본 설계

### 4.1 액션 의미 분리

`updateRawLog`를 다음 의도 기반 액션으로 분리합니다.

- `userEditedRawLog(content)`  
- `hydrateRawLogFromStorage(content)`  
- `hydrateRawLogFromServer(content, meta)`  
- `restoreRawLog(content)`  
- `refreshDerivedLogs()`  

정책:

- 서버 동기화/저장은 `userEditedRawLog`만 트리거
- hydrate/restore/refresh는 **저장/동기화 금지**

### 4.2 Storage 경계 고정 (StorageRepo 도입)

`StorageRepo`를 통해 localStorage wrapper를 단일 책임으로 처리합니다.

- `read(date): LogicalLog` -> plain content 반환
- `write(date, logicalLog, meta)` -> wrapper 직렬화 저장

규칙:

- reducer/component는 plain text만 다룸
- localStorage 원문(JSON 문자열)을 reducer로 직접 전달 금지
- `storage` 이벤트 수신 시 `newValue` 직접 사용 금지, `StorageRepo.read(date)`만 사용

### 4.3 Sync Engine 상태기계 도입

날짜별 head 기준으로 단일 큐를 운용합니다.

- 상태: `idle -> dirty -> syncing -> synced | conflict | error`
- hydrate 진행 중 업로드 게이트(`hydrating=true`) 적용
- 동일 날짜에 대해 동시 다발 요청 금지(serialize)

### 4.4 서버 CAS(Compare-And-Set) 필수화

클라이언트는 저장 시 `expectedContentHash`(또는 `expectedVersion`)를 전달합니다.

- 일치 시 저장 성공
- 불일치 시 `409 Conflict` 반환

백엔드는 조건부 쓰기(예: DynamoDB `ConditionExpression`)로 현재 head 검증 후에만 업데이트해야 합니다.

### 4.5 충돌 처리 규약

409 응답 시:

1. 서버 최신본 fetch
2. 로컬 스냅샷과 비교 UI 노출
3. 사용자 선택(로컬/서버/머지) 저장

충돌 해결 결과도 새 revision으로 저장해 이력 보존합니다.

---

## 5. 긴급 안정화(즉시 적용 권장)

1. 30초 타이머의 `updateRawLog` 제거 -> `refreshDerivedLogs`로 대체
2. 날짜 이동/복원 경로에서 서버 업로드 트리거 차단
3. `storage` 이벤트에서 wrapper raw 전달 금지
4. 로그인 직후 초기 fetch 완료 전 업로드 게이트
5. 임시 운영 가이드: 한 탭 편집 + 작업 전 수동 백업(export)

---

## 6. 단계별 실행 계획

### Phase 1 (Frontend 안정화)

- 액션 분리
- middleware 트리거 조건 재정의
- `StorageRepo` 도입
- `storage` 이벤트 경계 수정
- `refreshDerivedLogs` 분리

### Phase 2 (Backend 정합성 강화)

- CAS API 추가 (`expectedContentHash`/`expectedVersion`)
- 409 conflict 표준 응답 스키마 확정
- 클라이언트 409 핸들링 연결

### Phase 3 (운영 신뢰성 강화)

- sync telemetry (conflict rate, retry, overwrite 시도)
- 복원/백업 UX 개선
- 머지 프리뷰(선택 기능) 검토

---

## 7. 수용 기준(Definition of Done)

- 멀티탭 편집 시 textarea에 wrapper JSON이 절대 노출되지 않는다.
- 날짜 이동 hydrate가 자동 재저장/재동기화를 유발하지 않는다.
- 30초 실시간 갱신이 저장/네트워크를 발생시키지 않는다.
- 충돌 시 서버 CAS가 overwrite를 차단하고 409를 반환한다.
- 충돌 해결 후에도 기존/신규 이력이 모두 추적 가능하다.
- 백업 export/import round-trip에서 logical content가 보존된다.

---

## 8. 기대 효과

1. 동기화 루프/레이스로 인한 에디터 폭주 현상 제거
2. 데이터 유실 가능성 실질적 감소(클라이언트 + 서버 이중 보호)
3. 로그인 후 편집에 대한 심리적 불안 해소
4. 향후 기능 확장(멀티기기/히스토리/머지) 기반 확보

