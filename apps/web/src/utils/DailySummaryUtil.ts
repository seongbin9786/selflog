import { minutesToTimeString } from './DateUtil';
import { createLogsFromString } from './LogConverter';

const dateStringRegExp = /\d\d\d\d-\d\d-\d\d/;

export const getSummary = () => {
  // 1. LocalStorage에서 날짜 key만 추출
  const allLocalStorageJson = { ...localStorage };
  const allLogsKeys = Object.keys(allLocalStorageJson).filter((storageKey) => {
    return storageKey.match(dateStringRegExp);
  });

  // 2. 날짜 key로 차트에 사용할 배열 생성
  const allLogs = allLogsKeys.map((date) => {
    const logs = createLogsFromString(allLocalStorageJson[date], date);
    if (logs.length === 0) {
      // 빈 문자열이었던 경우
      return {
        date,
        productiveMinutes: 0,
        productiveMinutesString: 0,
        wastedMinutes: 0,
        wastedMinutesString: 0,
        productiveRatio: 0,
        wastedRatio: 0,
      };
    }
    const { productive, wasted } = logs[logs.length - 1]; // 총합
    const hasAnyLogs = productive + wasted > 0;
    const _ratio = Math.round((productive / (productive + wasted)) * 100);
    const productiveRatio = hasAnyLogs ? _ratio : 0;
    const wastedRatio = hasAnyLogs ? 100 - _ratio : 0;
    const productiveMinutes = productive;
    const productiveMinutesString = minutesToTimeString(productive);
    const wastedMinutes = wasted;
    const wastedMinutesString = minutesToTimeString(wasted);

    return {
      date,
      productiveMinutes,
      productiveMinutesString,
      wastedMinutes,
      wastedMinutesString,
      productiveRatio,
      wastedRatio,
    };
  });

  // 3. 배열을 날짜 순 정렬
  allLogs.sort(({ date: aDate }, { date: bDate }) => {
    const [aY, aM, aD] = aDate.split('-').map(Number);
    const [bY, bM, bD] = bDate.split('-').map(Number);

    return aY - bY || aM - bM || aD - bD;
  });

  return allLogs;
};
