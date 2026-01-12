import { timeToMinutes } from '../utils/timeUtils';

/**
 * 로그 항목 문자열 생성
 * @param timeStr HH:mm 형식의 시간 문자열
 * @param isProductive 생산적 활동 여부
 * @param content 활동 내용
 * @returns 형식화된 로그 항목 문자열
 */
export const createLogItem = (
  timeStr: string,
  isProductive: boolean,
  content: string,
): string => {
  const plusMinus = isProductive ? '+' : '-';
  return `[${timeStr}] ${plusMinus} ${content.trim()}`;
};

/**
 * 로그 항목을 rawLogs에 추가
 * @param rawLogs 기존 로그 전체 문자열
 * @param newLogItem 추가할 새 로그 항목
 * @param hasTimeInput 사용자가 직접 시간을 입력했는지 여부
 * @returns 새 로그가 추가된 전체 로그 문자열
 */
export const addLogEntry = (
  rawLogs: string,
  newLogItem: string,
  hasTimeInput: boolean,
): string => {
  if (hasTimeInput) {
    // 시간 입력이 있으면 시간순으로 정렬하여 삽입
    return insertLogInOrder(rawLogs, newLogItem);
  } else {
    // 시간 입력이 없으면(현재 시각) 맨 끝에 추가
    return rawLogs.trimEnd().concat(`\n${newLogItem}`);
  }
};

/**
 * 새 로그 항목을 시간순으로 적절한 위치에 삽입
 * @param rawLogs 기존 로그 전체 문자열
 * @param newLogItem 추가할 새 로그 항목
 * @returns 새 로그가 삽입된 전체 로그 문자열
 */
export const insertLogInOrder = (
  rawLogs: string,
  newLogItem: string,
): string => {
  // rawLogs가 비어있는 경우
  if (!rawLogs || rawLogs.trim() === '') {
    return newLogItem;
  }

  const lines = rawLogs.split('\n');

  // 새 로그의 시각 추출
  const newTimeMatch = newLogItem.match(/\[(\d{2}:\d{2})\]/);
  if (!newTimeMatch) {
    // 시각 형식이 없으면 맨 끝에 추가
    return rawLogs.trimEnd().concat(`\n${newLogItem}`);
  }

  const newTime = timeToMinutes(newTimeMatch[1]);
  let insertIndex = -1;

  // 뒤에서부터 검색하여 적절한 삽입 위치 찾기
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    // 빈 줄은 건너뜀
    if (line.trim() === '') {
      continue;
    }

    const lineTimeMatch = line.match(/\[(\d{2}:\d{2})/);
    if (lineTimeMatch) {
      const lineTime = timeToMinutes(lineTimeMatch[1]);
      // 새 시간이 현재 줄의 시간보다 크거나 같으면 이 줄 다음에 삽입
      if (newTime >= lineTime) {
        insertIndex = i + 1;
        break;
      }
    }
  }

  // 삽입할 위치를 찾지 못한 경우 (모든 로그보다 이른 시간)
  if (insertIndex === -1) {
    // 맨 앞의 빈 줄들을 건너뛰고 첫 번째 내용이 있는 줄 앞에 삽입
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() !== '') {
        insertIndex = i;
        break;
      }
    }
    // 모든 줄이 비어있으면 맨 앞에 삽입
    if (insertIndex === -1) {
      insertIndex = 0;
    }
  }

  lines.splice(insertIndex, 0, newLogItem);
  return lines.join('\n');
};
