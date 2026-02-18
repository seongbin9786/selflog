# 에디터 구현 스펙 문서 (현재 상태 전수 점검)

## 1) 범위와 커버리지

이 문서는 `apps/web`의 `/`(Log Writer 페이지) 에디터 구현을 코드 기준으로 점검한 결과다.

포함 범위:

- 화면 구성, 입력 UX, 키보드 흐름, 커맨드 입력
- raw 로그 문법과 파싱/변환 파이프라인
- Redux 상태 전이와 부수효과
- 로컬 저장 포맷과 마이그레이션
- 서버 동기화, 충돌 감지/해결
- 백업/복구/히스토리 복원 경로
- 에디터 액션으로 유발되는 휴식 알림 플로우

주요 확인 파일:

- `apps/web/src/pages/LogWriterPage.tsx:21`
- `apps/web/src/components/texts/TextLogContainer.tsx:29`
- `apps/web/src/features/RawLogEditor.ts:10`
- `apps/web/src/utils/timeUtils.ts:19`
- `apps/web/src/utils/TimeFormatConverter.ts:41`
- `apps/web/src/utils/TimeRangeFormatter.ts:1`
- `apps/web/src/utils/LogConverter.ts:85`
- `apps/web/src/utils/PaceUtil.ts:19`
- `apps/web/src/store/logs.ts:33`
- `apps/web/src/store/RawLogStorageSyncMiddleware.ts:33`
- `apps/web/src/utils/StorageUtil.ts:10`
- `apps/web/src/utils/StorageListener.ts:7`
- `apps/web/src/services/LogService.ts:26`
- `apps/web/src/utils/ConflictDetector.ts:23`
- `apps/web/src/features/dataManagement/backupService.ts:12`
- `apps/web/src/features/dataManagement/LogHistoryView.tsx:14`
- `apps/web/src/components/CommandPalette/CommandPalette.tsx:20`
- `apps/web/src/utils/commandEvents.ts:3`
- `apps/web/src/components/dialogs/RestTimeInputDialog.tsx:12`
- `apps/web/src/store/restNotification.ts:13`
- `apps/web/src/features/restNotification/useRestNotification.ts:16`

관련 테스트:

- `apps/web/src/utils/timeUtils.test.ts:10`
- `apps/web/src/utils/StorageUtil.test.ts:12`
- `apps/web/src/__tests__/integration/ConflictDetection.integration.test.ts:12`

---

## 2) 시스템 개요

### 2.1 실행 흐름(요약)

1. 사용자가 `TextLogContainer`에서 raw 로그를 편집한다.
2. `updateRawLog` 액션이 Redux로 디스패치된다.
3. `logs` slice가 다음을 갱신한다.
   - `rawLogs`
   - `logsForCharts` (`createLogsFromString` 파생값)
   - `syncStatus` (`syncing`이 아니면 `pending`)
4. listener middleware가 `updateRawLog`를 받아 다음을 수행한다.
   - 로컬 즉시 저장(`saveToStorage`)
   - 2초 디바운스 후(로그인 상태일 때) 서버 저장(`saveLogToServer`)
5. 차트/요약/휴식 UI는 `logsForCharts`와 알림 상태를 소비한다.

### 2.2 핵심 데이터 형태

- 에디터 원본 텍스트: `rawLogs: string` (`apps/web/src/store/logs.ts:22`)
- 차트 파생 시리즈: `logsForCharts: Log[]` (`apps/web/src/utils/PaceUtil.ts:1`)
- 날짜별 로컬 저장 객체:
  - `{ content, contentHash, parentHash, localUpdatedAt }`
  - (`apps/web/src/utils/StorageUtil.ts:3`)

---

## 3) 스펙 인벤토리 (현재 동작 + 구현 방식 + 개선안)

## A. 화면 구성 및 진입점

### A-1. Log Writer 페이지 구조

- 현재 스펙:
  - `/` 경로에서 헤더 컨트롤, 텍스트 에디터, 차트 영역, 다이얼로그를 렌더링한다.
- 구현 방식:
  - `LogWriterPage`가 `DayNavigator`, `TextLogContainer`, 차트 영역, 사운드/데이터/인증/테마/충돌 UI를 조합한다 (`apps/web/src/pages/LogWriterPage.tsx:42`).
  - 그리드에 임시 `<div>hello</div>`가 남아있다 (`apps/web/src/pages/LogWriterPage.tsx:75`).
- 개선 제안:
  - 임시 영역 제거 또는 명시적인 패널로 교체.
  - 그리드 슬롯 계약(필수/선택 패널)을 문서화해 레이아웃 드리프트 방지.

### A-2. 동기화 상태 노출 방식

- 현재 스펙:
  - 동기화 상태는 전용 인디케이터가 아닌 데이터 버튼 아이콘/토스트로 노출된다.
- 구현 방식:
  - `DataManagementButton`이 `syncStatus`를 반영한다 (`apps/web/src/components/dataManagement/DataManagementButton.tsx:13`).
  - `SyncStatusIndicator`는 구현되어 있으나 실제 사용처가 없다 (`apps/web/src/components/common/SyncStatusIndicator.tsx:13`).
- 개선 제안:
  - 동기화 상태 UI를 1개 컴포넌트로 단일화.
  - 미사용 컴포넌트 제거 또는 실제 배치.

## B. 에디터 입력 규약

### B-1. textarea 직접 편집

- 현재 스펙:
  - textarea는 Redux `rawLogs` 완전 제어형이다.
  - 변경 시마다 `updateRawLog(nextRawLog)`를 디스패치한다.
- 구현 방식:
  - `value={rawLogs}` + `onChange -> setRawLogs -> dispatch(updateRawLog)` (`apps/web/src/components/texts/TextLogContainer.tsx:318`, `apps/web/src/components/texts/TextLogContainer.tsx:85`).
- 개선 제안:
  - 액션 출처를 분리(`user_typing`, `hydrate_from_storage`, `hydrate_from_server`, `restore`)해 같은 액션이 모든 부수효과를 타지 않게 개선.

### B-2. 빠른 입력(토글 + 시간 + 활동명)

- 현재 스펙:
  - 미니 폼으로 로그 추가 가능.
  - 활동명 필수, 시간은 선택 입력, 생산/소비 토글 지원.
- 구현 방식:
  - `appendLog`에서 검증 후 라인 생성/삽입 (`apps/web/src/components/texts/TextLogContainer.tsx:98`).
  - 토글 UI는 `ProductiveToggle` (`apps/web/src/components/texts/ProductiveToggle.tsx:11`).
- 개선 제안:
  - 검증/삽입 로직을 순수 함수 서비스로 분리하고 단위 테스트 강화.

### B-3. 활동명 빈 입력 검증

- 현재 스펙:
  - 활동명이 비어 있으면 저장하지 않고 입력 칸 shake + 포커스 이동.
- 구현 방식:
  - `if (!quickInput.trim()) { shakeQuickInput(); focus; return; }` (`apps/web/src/components/texts/TextLogContainer.tsx:99`).
  - shake 훅/스타일 (`apps/web/src/hooks/useShake.ts:5`, `apps/web/src/App.css:32`).
- 개선 제안:
  - 시각 효과 외에 텍스트 에러 메시지 제공(접근성 개선).

### B-4. 시간 입력 파싱 규칙

- 현재 스펙:
  - 허용:
    - `HH:mm`
    - 숫자 축약 입력(`930 -> 09:30`, `9 -> 09:00`)
    - 24시간 초과 표기(`25:30`, `260:00`)
  - 거부:
    - 비숫자/잘못된 콜론 형식/분 59 초과
- 구현 방식:
  - `parseTimeInput` (`apps/web/src/utils/timeUtils.ts:44`).
  - 테스트로 동작 검증 (`apps/web/src/utils/timeUtils.test.ts:10`).
- 개선 제안:
  - 시간 상한 정책을 명시(무제한 유지 또는 상한 도입).

### B-5. 시간 입력 실패 처리

- 현재 스펙:
  - 비어있지 않은 시간 입력이 invalid면 저장 차단 + shake + 포커스 복귀.
- 구현 방식:
  - `if (timeInput.trim() !== '' && !parsedTime) ...` (`apps/web/src/components/texts/TextLogContainer.tsx:106`).
- 개선 제안:
  - 입력 힌트(`HH:mm`, `930`, `25:10`)를 필드 근처에 고정 노출.

### B-6. 시간 미입력 시 기본 시각

- 현재 스펙:
  - 시간 미입력 시 `현재시각(최대 로그시각 보정)`을 사용.
- 구현 방식:
  - `timeStr = parsedTime || currentTimeConsideringMaxTime` (`apps/web/src/components/texts/TextLogContainer.tsx:115`).
  - 보정 함수 `getCurrentTimeStringConsideringMaxTime` (`apps/web/src/utils/timeUtils.ts:19`).
- 개선 제안:
  - 제출 시점 기준으로 기본 시각을 1회 고정해, 렌더 시점/클럭 변화 레이스를 최소화.

### B-7. 정렬 삽입 vs 끝 추가

- 현재 스펙:
  - 수동 시간 입력: 시간순 삽입.
  - 자동 현재시각: 끝에 추가.
- 구현 방식:
  - `addLogEntry(hasTimeInput)` 분기 (`apps/web/src/features/RawLogEditor.ts:26`).
  - `insertLogInOrder` 역순 스캔/스플라이스 (`apps/web/src/features/RawLogEditor.ts:46`).
- 개선 제안:
  - 삽입 전 빈 줄/후행 개행 정규화.
  - 동시간대/비정상 라인 혼재 케이스 테스트 추가.

### B-8. 작성 단계 로그 라인 문법

- 현재 스펙:
  - 작성 라인 포맷: `[HH:mm] (+|-) text`.
- 구현 방식:
  - `createLogItem` (`apps/web/src/features/RawLogEditor.ts:10`).
- 개선 제안:
  - 문법 상수를 단일 모듈로 모아 작성/파싱 코드가 공유하도록 정리.

### B-9. 키보드 동작

- 현재 스펙:
  - Enter로 추가 실행.
  - IME 조합 중 Enter는 무시.
- 구현 방식:
  - `handleEnterOnTextInput`, `handleEnterOnCheckbox` (`apps/web/src/components/texts/TextLogContainer.tsx:186`).
- 개선 제안:
  - 단축키 맵(Enter/Esc/Cmd+P)을 UI 도움말로 노출.

### B-10. 포커스 정책

- 현재 스펙:
  - 초기 마운트/날짜 변경 시 토글에 포커스.
  - 다이얼로그 종료 시 활동 입력 칸으로 복귀.
  - 커맨드 이벤트로 활동 입력 포커스 가능.
- 구현 방식:
  - 마운트/날짜 effect (`apps/web/src/components/texts/TextLogContainer.tsx:200`, `apps/web/src/components/texts/TextLogContainer.tsx:207`).
  - command listener (`apps/web/src/components/texts/TextLogContainer.tsx:237`).
- 개선 제안:
  - `setTimeout` 기반 포커스 로직을 공통 포커스 매니저로 통합.

## C. 소비 로그/휴식 알림 플로우

### C-1. 소비 로그는 시간 다이얼로그 선행

- 현재 스펙:
  - 소비 로그는 즉시 저장하지 않고 휴식 시간 입력 다이얼로그를 먼저 연다.
  - 다이얼로그 제출 후 로그 저장 + 알림 스케줄 생성.
- 구현 방식:
  - pending 상태 저장 + 모달 오픈 (`apps/web/src/components/texts/TextLogContainer.tsx:117`).
  - 제출 처리 (`apps/web/src/components/texts/TextLogContainer.tsx:147`).
- 개선 제안:
  - pending payload에 타입 필드(`productive/consumption`)를 명시해 분기 의존성 축소.

### C-2. 휴식 시간 입력 검증

- 현재 스펙:
  - 필수/숫자/`1..300`분 검증.
  - Enter 제출, Esc 취소.
- 구현 방식:
  - `RestTimeInputDialog` 검증 (`apps/web/src/components/dialogs/RestTimeInputDialog.tsx:42`).
  - Esc 전역 리스너 (`apps/web/src/components/dialogs/RestTimeInputDialog.tsx:32`).
- 개선 제안:
  - 접근성을 위해 에러 메시지와 입력 필드 연결(`aria-describedby`) 강화.

### C-3. 휴식 알림 생명주기

- 현재 스펙:
  - 종료 1분 전/종료 시점 알림음 재생.
  - 옵션에 따라 종료 시 반복 재생.
  - 생산 로그 추가 시 현재 알림 해제.
- 구현 방식:
  - 알림 상태 slice (`apps/web/src/store/restNotification.ts:13`).
  - 스케줄링 훅 (`apps/web/src/features/restNotification/useRestNotification.ts:16`).
  - 생산 로그 추가 시 clear (`apps/web/src/components/texts/TextLogContainer.tsx:135`).
- 개선 제안:
  - 새로고침 후에도 알림 지속이 필요하면 상태 영속화 도입.

### C-4. 잔여 시간 배지

- 현재 스펙:
  - 헤더에서 잔여/초과 시간을 1초 간격으로 갱신 표시.
- 구현 방식:
  - `useRemainingTime` (`apps/web/src/features/restNotification/useRemainingTime.ts:9`).
  - 헤더 렌더 (`apps/web/src/pages/LogWriterPage.tsx:48`).
- 개선 제안:
  - 현재 1초 주기로 충분. 과도한 업데이트는 지양.

## D. 커맨드 팔레트 연동

### D-1. 열기/닫기 단축키

- 현재 스펙:
  - `Cmd+P` / `Ctrl+P`로 팔레트 토글.
- 구현 방식:
  - `useCommandPalette` (`apps/web/src/hooks/useCommandPalette.ts:14`).
- 개선 제안:
  - 토글 대신 open-only + close 전용 키 설계도 검토 가능.

### D-2. 커맨드 종류

- 현재 스펙:
  - 정적 커맨드:
    - 활동 입력 포커스
    - 생산 시작 추가
    - 소비 시작 추가
  - 동적 커맨드:
    - 검색어 `+` 시작: 생산 로그 생성
    - 검색어 `-` 시작: 소비 로그 생성
- 구현 방식:
  - 정적 정의 (`apps/web/src/App.tsx:14`).
  - 동적 필터/생성 (`apps/web/src/components/CommandPalette/CommandPalette.tsx:35`).
- 개선 제안:
  - 커맨드 카탈로그 모듈을 분리해 정적/동적 경로 중복 제거.

### D-3. 이벤트 브리지 방식

- 현재 스펙:
  - 팔레트와 에디터는 `window` 커스텀 이벤트로 연결됨.
- 구현 방식:
  - 이벤트 정의/디스패치 (`apps/web/src/utils/commandEvents.ts:3`).
  - 에디터 리스너 등록 (`apps/web/src/components/texts/TextLogContainer.tsx:237`).
- 개선 제안:
  - 전역 이벤트 대신 타입드 Redux 액션으로 통일(추적/테스트성 개선).

## E. Raw 로그 파싱/차트 파생

### E-1. 파싱 문법

- 현재 스펙:
  - range 파서: `[start -> end] (+|-) text`
  - raw 파서: `[time] (+|-) text`
- 구현 방식:
  - `TimeRangeFormatter` 정규식 (`apps/web/src/utils/TimeRangeFormatter.ts:2`, `apps/web/src/utils/TimeRangeFormatter.ts:7`).
- 개선 제안:
  - 시간 정규식 문자셋 `[0-9|:]`의 `|`는 불필요하므로 `[0-9:]+`로 교정.

### E-2. Raw -> Range 변환

- 현재 스펙:
  - 연속 raw 라인을 `[이전시각 -> 다음시각] 이전텍스트` 구간으로 변환.
  - 마지막 라인은 조건에 따라 현재시각으로 연장.
- 구현 방식:
  - `convertTimeFormat` (`apps/web/src/utils/TimeFormatConverter.ts:41`).
  - `수면` 키워드면 현재시각 연장 중단 (`apps/web/src/utils/TimeFormatConverter.ts:24`).
- 개선 제안:
  - 현재시각 연장을 숨은 규칙이 아닌 옵션화(표시/계산 분리).

### E-3. 날짜 경계 규칙

- 현재 스펙:
  - target day가 오늘이면 +24 없이 현재시각 연장.
  - target day가 어제이고 현재 시각이 새벽(<7)이면 +24시각으로 연장.
- 구현 방식:
  - 조건 분기 (`apps/web/src/utils/TimeFormatConverter.ts:73`).
  - `justOneDayAwayAtMost` 사용 (`apps/web/src/utils/DateUtil.ts:10`).
- 개선 제안:
  - 함수명/구현 의미를 일치시키고 날짜 계산을 명확한 유틸로 재작성.

### E-4. 누적 계산 모델

- 현재 스펙:
  - 구간 로그를 누적 생산/소비 및 pace로 변환.
- 구현 방식:
  - `generateAccumulatedLog`, `paceOf` (`apps/web/src/utils/LogConverter.ts:54`, `apps/web/src/utils/LogConverter.ts:26`).
- 개선 제안:
  - 음수 구간/형식 오류를 타입드 에러로 분리해 진단 가능성 강화.

### E-5. 10분 단위 보간

- 현재 스펙:
  - 차트용 로그를 10분 블록으로 보간해 시계열 밀도를 높임.
- 구현 방식:
  - `divideLogsIntoTimeUnit` (`apps/web/src/utils/PaceUtil.ts:19`).
  - `logs[0].direction` 직접 수정 (`apps/web/src/utils/PaceUtil.ts:23`).
- 개선 제안:
  - 입력 배열 불변 처리로 변경.
  - 빈 배열 가드 추가(`logs[0]` 접근 보호).

### E-6. JSON 입력 방어

- 현재 스펙:
  - `createLogsFromString`는 입력이 JSON 문자열이면 `{content}`를 추출해 파싱 가능.
- 구현 방식:
  - unwrap 로직 (`apps/web/src/utils/LogConverter.ts:95`).
- 개선 제안:
  - 저장/로드 경계 정리 후 이 방어 로직은 단계적으로 제거(현재는 경계 오염을 가리는 완충책).

## F. 상태관리와 부수효과

### F-1. logs 상태 모델

- 현재 스펙:
  - `currentDate`, `rawLogs`, `logsForCharts`, sync 메타, conflict payload 유지.
- 구현 방식:
  - `LogState`/reducers (`apps/web/src/store/logs.ts:20`).
  - 모듈 로드 시 로컬 데이터로 초기화 (`apps/web/src/store/logs.ts:30`).
- 개선 제안:
  - 초기화 부수효과를 스토어 부트스트랩 단계로 이동해 테스트 격리성 향상.

### F-2. 날짜 이동 계약

- 현재 스펙:
  - prev/today/next reducer는 날짜만 변경.
  - 로드/동기화는 middleware 담당.
- 구현 방식:
  - reducer들 (`apps/web/src/store/logs.ts:46`).
  - middleware matcher가 hydration 수행 (`apps/web/src/store/RawLogStorageSyncMiddleware.ts:84`).
- 개선 제안:
  - `setCurrentDateAndHydrate` 같은 의도 명확한 액션/thunk로 결합 동작을 명시.

### F-3. 30초 주기 self-dispatch

- 현재 스펙:
  - 30초마다 `updateRawLog(rawLogs)`를 디스패치해 실시간 차트 갱신.
- 구현 방식:
  - interval effect (`apps/web/src/components/texts/TextLogContainer.tsx:65`).
- 개선 제안:
  - 저장/동기화를 타지 않는 `refreshDerivedLogs` 액션으로 분리.

## G. 로컬 저장 스펙

### G-1. 저장 포맷

- 현재 스펙:
  - 날짜별 JSON wrapper + 해시 체인 메타 저장.
- 구현 방식:
  - `saveToStorage` (`apps/web/src/utils/StorageUtil.ts:67`).
- 개선 제안:
  - `formatVersion` 필드 도입으로 향후 마이그레이션 안전성 확보.

### G-2. 마이그레이션

- 현재 스펙:
  - legacy plain string
  - legacy JSON(hash 없음)
  - current JSON
  - 모두 로딩 지원.
- 구현 방식:
  - `loadFromStorage` 분기 (`apps/web/src/utils/StorageUtil.ts:22`).
- 개선 제안:
  - 로드 시 정상 포맷으로 재저장하는 정규화 옵션 추가.

### G-3. parentHash 결정 규칙

- 현재 스펙:
  - 명시 parentHash 우선.
  - 내용 변경 시 이전 contentHash를 parent로 설정.
  - 내용 동일 시 기존 parentHash 유지.
- 구현 방식:
  - `saveToStorage` 규칙 (`apps/web/src/utils/StorageUtil.ts:77`).
- 개선 제안:
  - `source(local_edit/server_apply/restore)`를 받아 정책을 소스별로 명시.

## H. 서버 동기화/충돌 처리

### H-1. edit 시 디바운스 동기화

- 현재 스펙:
  - `updateRawLog`마다
    - 로컬 즉시 저장
    - 기존 대기 listener 취소
    - 2초 뒤 서버 저장(토큰 있을 때)
- 구현 방식:
  - 첫 번째 listener (`apps/web/src/store/RawLogStorageSyncMiddleware.ts:33`).
- 개선 제안:
  - hydration/복원 액션은 이 경로에서 제외되도록 액션 출처 분리.

### H-2. 날짜 변경 시 hydrate + fetch

- 현재 스펙:
  - 날짜 이동 시
    - 로컬 로드
    - `updateRawLog(local content)` 디스패치
    - 서버 fetch 후 충돌 규칙 적용
- 구현 방식:
  - 두 번째 listener (`apps/web/src/store/RawLogStorageSyncMiddleware.ts:83`).
- 개선 제안:
  - `hydrateRawLog` 전용 액션 도입으로 즉시 재저장/재동기화 방지.

### H-3. 충돌 타입 체계

- 현재 스펙:
  - `NO_CONFLICT_SAME`
  - `FAST_FORWARD`
  - `LOCAL_AHEAD`
  - `CONFLICT_DIVERGED`
- 구현 방식:
  - `detectConflict` (`apps/web/src/utils/ConflictDetector.ts:23`).
- 개선 제안:
  - 현재는 parent 1-hop 비교 중심.
  - 깊은 조상 비교가 필요하면 서버가 ancestry 정보 제공하도록 확장.

### H-4. 충돌 UI와 해결

- 현재 스펙:
  - diverged 시 모달로 로컬/서버 중 선택.
  - 선택 후 `resolveConflict` -> middleware가 서버 저장.
- 구현 방식:
  - 모달 UI (`apps/web/src/components/common/ConflictDialog.tsx:7`).
  - resolver listener (`apps/web/src/store/RawLogStorageSyncMiddleware.ts:201`).
- 개선 제안:
  - 단순 양자택일 외에 line-based 머지 프리뷰 옵션 제공.

### H-5. syncStatus 전이

- 현재 스펙:
  - `idle/pending/syncing/synced/error`.
- 구현 방식:
  - `logs` reducer 상태 변경 (`apps/web/src/store/logs.ts:63`, `apps/web/src/store/logs.ts:67`).
  - `DataManagementButton`에 반영 (`apps/web/src/components/dataManagement/DataManagementButton.tsx:46`).
- 개선 제안:
  - 에러 원인 코드(`network/auth/conflict/validation`) 분리 저장.

## I. 멀티탭 동기화

### I-1. storage 이벤트 처리

- 현재 스펙:
  - 같은 key 변경 시 `newValue`를 콜백으로 전달하고 `updateRawLog`로 반영.
- 구현 방식:
  - `StorageListener`가 raw `newValue` 전달 (`apps/web/src/utils/StorageListener.ts:24`).
  - 에디터에서 install (`apps/web/src/components/texts/TextLogContainer.tsx:208`).
- 개선 제안(근본):
  - `newValue`를 바로 쓰지 말고 `loadFromStorage(targetKey).content`로 정규화 후 반영.
  - 더 나은 방식은 `hydrateFromStorage(key)` 액션으로 경계 강제.

### I-2. 현재 구현 리스크

- 현재 리스크:
  - `newValue`는 wrapper JSON 문자열인데, 에디터 raw 텍스트로 유입될 수 있음.
  - 이 경우 JSON 중첩/파싱 오염/동기화 악순환 가능.
- 근거:
  - 저장은 wrapper JSON (`apps/web/src/utils/StorageUtil.ts:96`).
  - 이벤트는 raw 문자열 전달 (`apps/web/src/utils/StorageListener.ts:28`).
- 개선 제안(근본):
  - 도메인 경계 고정:
    - editor/store는 plain raw text만 취급
    - storage adapter만 wrapper JSON 취급
    - localStorage payload를 reducer로 직접 전달 금지

## J. 백업/복구/히스토리

### J-1. 로컬 백업 export 포맷

- 현재 스펙:
  - `version/exportedAt/logs/settings` 형태.
  - `logs` 값은 localStorage 원문을 그대로 수집.
- 구현 방식:
  - `createBackup` (`apps/web/src/features/dataManagement/backupService.ts:12`).
- 개선 제안:
  - export 시 `loadFromStorage(date).content` 기준으로 정규화 출력.

### J-2. 백업 import 동작

- 현재 스펙:
  - 신규/레거시 포맷 허용.
  - 적용 전 날짜 키 전체 삭제.
  - 로그인 시 bulk sync 후 로컬 저장.
  - settings 키 적용.
- 구현 방식:
  - `importBackup` (`apps/web/src/features/dataManagement/backupService.ts:118`).
- 개선 제안:
  - import 시 payload가 wrapper JSON 형태면 먼저 unwrap 후 저장.
  - 저장 경로에는 논리적 content만 투입.

### J-3. 서버 히스토리 복원

- 현재 스펙:
  - 현재 날짜 백업 목록 조회 후 선택 버전을 `updateRawLog`로 복원.
- 구현 방식:
  - `LogHistoryView` (`apps/web/src/features/dataManagement/LogHistoryView.tsx:25`).
- 개선 제안:
  - `restoreRawLogFromHistory` 전용 액션 도입(불필요한 즉시 재동기화 최소화).

### J-4. import 후 페이지 리로드

- 현재 스펙:
  - import 성공 시 1.5초 후 `window.location.reload()`.
- 구현 방식:
  - `DataManagementDialog` (`apps/web/src/features/dataManagement/DataManagementDialog.tsx:87`).
- 개선 제안:
  - 하드 리로드 대신 rehydrate 액션으로 SPA 상태를 갱신.

## K. 인증과 동기화 게이트

### K-1. 토큰 기반 동기화 조건

- 현재 스펙:
  - 서버 sync/fetch는 localStorage 토큰 존재 시에만 수행.
  - 토큰 없으면 로컬 전용 모드.
- 구현 방식:
  - `LogService` 토큰 체크 (`apps/web/src/services/LogService.ts:32`, `apps/web/src/services/LogService.ts:98`).
- 개선 제안:
  - 토큰 접근/401 처리 로직을 인터셉터 레벨로 단일화.

---

## 4) 목표 유지형 근본 개선 계획

## Plan-1. 의도 액션과 부수효과 액션 분리

- 유지 목표:
  - 실시간 편집
  - 로컬 저장
  - 디바운스 동기화
- 변경:
  - 액션 분리
    - `userEditedRawLog(content)`
    - `hydrateRawLogFromStorage(content)`
    - `hydrateRawLogFromServer(content, metadata)`
    - `refreshDerivedLogs()`
- 기대 효과:
  - 사용자 편집만 저장/동기화를 타고,
  - hydration/주기 갱신은 루프를 유발하지 않음.

## Plan-2. 경계 객체 정규화(도메인 분리)

- 유지 목표:
  - 레거시 localStorage 호환
- 변경:
  - `StorageRepo` 계층 도입
    - `read(date): LogicalLog`
    - `write(date, LogicalLog, SyncMeta)`
  - reducer/input은 plain text만 처리.
- 기대 효과:
  - wrapper JSON이 에디터 텍스트 경로로 유입되는 구조를 원천 차단.

## Plan-3. 백업/복구 payload 정규화

- 유지 목표:
  - import/export 호환성
- 변경:
  - export는 canonical logical log만 기록.
  - import는 wrapper 감지 시 unwrap 후 저장.
  - 스키마 버전 기반 마이그레이션 맵 도입.
- 기대 효과:
  - JSON 중첩 누적, 포맷 드리프트 방지.

## Plan-4. 실시간 차트 갱신을 부수효과 없는 경로로 분리

- 유지 목표:
  - 현재시각 연장 기반 실시간 차트
- 변경:
  - 30초 타이머의 `updateRawLog(rawLogs)`를 `refreshDerivedLogs`로 대체.
- 기대 효과:
  - 내용 불변 상태에서 저장/네트워크 호출 제거.

## Plan-5. 충돌 모델 확장 경로 확보

- 유지 목표:
  - fast-forward/local-ahead 자동 처리 + diverged 수동 선택
- 변경:
  - 단기적으로 현재 모델 유지,
  - 필요 시 서버 ancestry 제공으로 깊은 조상 비교 확장.
- 기대 효과:
  - 현 동작 호환성을 유지하면서 향후 복잡 시나리오 대응 가능.

---

## 5) 현재 리스크 요약

1. 멀티탭 storage 이벤트 경로에서 wrapper JSON이 에디터 raw 텍스트로 유입될 수 있음 (`apps/web/src/utils/StorageListener.ts:28`).
2. 30초 주기 `updateRawLog`가 불필요한 저장/동기화 트래픽을 유발할 수 있음 (`apps/web/src/components/texts/TextLogContainer.tsx:68`).
3. 시간 정규식 문자셋에 불필요한 `|`가 포함됨 (`apps/web/src/utils/TimeRangeFormatter.ts:3`).
4. `divideLogsIntoTimeUnit`는 입력을 직접 변경하고 빈 배열 가드가 약함 (`apps/web/src/utils/PaceUtil.ts:23`).
5. 백업 export/import가 저장소 원문(wrapper) 중심이라 논리 로그 경계가 흐려질 수 있음 (`apps/web/src/features/dataManagement/backupService.ts:21`).

---

## 6) 리팩터링 수용 체크리스트

- [ ] 멀티탭 편집 시 textarea에 wrapper JSON 문자열이 나타나지 않는다.
- [ ] 날짜 이동 hydration이 즉시 재저장/재동기화를 유발하지 않는다.
- [ ] 30초 실시간 갱신이 저장/네트워크를 발생시키지 않는다.
- [ ] 백업 export/import round-trip 후에도 논리 로그(plain content)가 유지된다.
- [ ] 기존 레거시 localStorage 데이터가 정상 로드된다.
- [ ] `FAST_FORWARD`, `LOCAL_AHEAD`, `CONFLICT_DIVERGED` 사용자 체감 동작이 유지된다.
