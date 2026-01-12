import { append0, justOneDayAwayAtMost } from './DateUtil';
import { extractTimeAndText } from './TimeRangeFormatter';

/**
 * 마지막 로그를 현재 시각까지 연장한 로그를 추가하여 실시간 현황을 볼 수 있게 한다.
 *
 * @param str 원본 로그
 * @param result 수정 후 로그
 * @param shouldAdd24Hours 현재 시각에 24시간을 더할지 여부 (전날의 연장으로 표시하기 위함)
 * @returns 현재 시간의 기록을 추가한 result(수정 후 로그)
 *
 * TODO: 해당 메소드 호출을 화면 revisit할 때마다 해야 함
 */
const appendCurrentTimeLog = (
  str: string[],
  result: string[],
  shouldAdd24Hours: boolean,
) => {
  const lastLog = str[str.length - 1];
  const [, startedAt, prevText] = extractTimeAndText(lastLog);

  // <수면> 키워드가 있으면 종료한다.
  // 오늘과 하루 이상 차이나도 appendCurrentTimeLog을 호출하지 않아야 함
  if (lastLog.includes('수면')) {
    return;
  }

  const now = new Date();
  // 어제를 새벽에 보고 있는 경우, 현재 시각(예: 01:00)을 전날 표기(25:00)로 표시하기 위해 24시간을 더한다.
  const hours = shouldAdd24Hours ? now.getHours() + 24 : now.getHours();
  const minutes = now.getMinutes();
  result.push(
    `[${startedAt} -> ${append0(hours)}:${append0(minutes)}] ${prevText}`,
  );
};

/**
 * @param rawLogs [hh:mm] str
 * @returns [hh:mm -> hh:mm] str
 */
export const convertTimeFormat = (
  rawLogs: string,
  targetDay: string,
  today: string,
) => {
  const str = rawLogs.trim().split('\n');

  const result = [];

  for (let i = 1; i < str.length; i++) {
    const prev = str[i - 1];
    const cur = str[i];

    const prevExtracted = extractTimeAndText(prev);
    const curExtracted = extractTimeAndText(cur);

    if (!prevExtracted || !curExtracted) {
      throw new Error('Wrong format');
    }

    const [, startedAt, prevText] = prevExtracted;
    const [, endedAt] = curExtracted;

    result.push(`[${startedAt} -> ${endedAt}] ${prevText}`);
  }

  // appendCurrentTimeLog의 대상:
  // 1. [오늘] - 현재 시각까지의 구간을 추가 (새벽이어도 24시간 더하지 않음)
  // 2. [어제를 새벽에 보는 경우] - 전날의 연장으로 표시하기 위해 24시간을 더함
  const isTargetDayYesterday = justOneDayAwayAtMost(targetDay, today);
  const isCurrentlyDawn = new Date().getHours() < 7;

  if (targetDay === today) {
    // 오늘 날짜를 보고 있으면 새벽이어도 24시간을 더하지 않음
    appendCurrentTimeLog(str, result, false);
  } else if (isTargetDayYesterday && isCurrentlyDawn) {
    // 어제 날짜를 새벽에 보고 있으면 24시간을 더함 (전날의 연장으로 표시)
    appendCurrentTimeLog(str, result, true);
  }

  return result.join('\n');
};
