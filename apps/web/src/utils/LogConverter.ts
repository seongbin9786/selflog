import { diffBetweenTimeStrings, getTodayString, minutesOf } from './DateUtil';
import { divideLogsIntoTimeUnit, Log } from './PaceUtil';
import { convertTimeFormat } from './TimeFormatConverter';
import { extractTimeRangeAndText } from './TimeRangeFormatter';

interface TempLogFormat {
  startedAt: string;
  endedAt: string;
  delta: number;
  productive: boolean;
  text: string;
}

const timeDiffAndText = (log: string): TempLogFormat => {
  const [, startedAt, endedAt, plusMinus, text] = extractTimeRangeAndText(log);

  return {
    startedAt,
    endedAt,
    delta: diffBetweenTimeStrings(startedAt, endedAt),
    productive: plusMinus === '+',
    text,
  };
};

const paceOf = (curProductive: number, wokeUpAt: string, endedAt: string) =>
  Math.floor((curProductive * 60) / diffBetweenTimeStrings(wokeUpAt, endedAt));

const initializeLogsWithFirstLog = (firstLog: TempLogFormat): Log[] => {
  const { startedAt, endedAt, delta, productive } = firstLog;
  const sumOfProductive = productive ? delta : 0;

  return [
    {
      offset: minutesOf(startedAt),
      direction: '',
      productive: 0,
      wasted: 0,
      pace: 0,
    },
    {
      offset: minutesOf(endedAt),
      direction: productive ? 'productive' : 'wasted',
      productive: sumOfProductive,
      wasted: !productive ? delta : 0,
      pace: paceOf(sumOfProductive, startedAt, endedAt),
    },
  ];
};

/**
 * 기록 시각 별 누적 생산, 소비 시간 로그를 생성한다.
 */
const generateAccumulatedLog = (rawLogs: string): Log[] => {
  const splittedLogs = rawLogs.trim().split('\n'); // 첫, 끝 원소 제거 (빈 문자열임)
  const [firstLog, ...logs] = splittedLogs.map(timeDiffAndText);
  const { startedAt: wokeUpAt } = firstLog;
  const result = initializeLogsWithFirstLog(firstLog);

  for (let i = 0; i < logs.length; i++) {
    const { productive: prevProductive, wasted: prevWasted } = result[i + 1];
    const { endedAt, delta, productive } = logs[i];

    const sumOfProductive = prevProductive + (productive ? delta : 0);
    const sumOfWasted = prevWasted + (!productive ? delta : 0);

    result.push({
      offset: minutesOf(endedAt),
      direction: productive ? 'productive' : 'wasted',
      productive: sumOfProductive,
      wasted: sumOfWasted,
      pace: paceOf(sumOfProductive, wokeUpAt, endedAt),
    });
  }

  return result;
};

// TODO: 현재 시각보다 뒤의 시각 입력 시 오류를 알려야 함.
// --> time format할 때와 addCurrentTime할 때 알 수 있음.
export const createLogsFromString = (
  rawLog: string,
  targetDay: string,
  today: string = getTodayString(),
) => {
  // 불필요한 예외 제거
  if (rawLog.length === 0) {
    return [];
  }
  try {
    const formatted = convertTimeFormat(rawLog, targetDay, today);
    const accumulated = generateAccumulatedLog(formatted);
    return divideLogsIntoTimeUnit(accumulated);
  } catch (e) {
    console.log('createLogsFromString:', e);
    return [];
  }
};
