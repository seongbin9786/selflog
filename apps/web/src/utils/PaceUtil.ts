export interface Log {
  offset: number;
  pace: number;

  // Log와 포멧 통합
  direction: string;
  productive: number;
  wasted: number;
}

export const avgPaceOf = (logs: Log[]) =>
  Math.floor(logs.reduce((acc, cur) => acc + cur.pace, 0) / logs.length);

const UNIT = 10;

/**
 * 로그를 단위 시간마다 쪼개서 단위 시간 별로 조회할 수 있게 만든다.
 */
export const divideLogsIntoTimeUnit = (logs: Log[]): Log[] => {
  const result = [];
  // 왜 이렇게 처리되는 거지?
  // TODO: direction 설정을 다시 짜야 할 듯
  if (logs[0].direction === '') {
    logs[0].direction = logs[1].direction;
  }
  result.push(logs[0]);

  for (let i = 1; i < logs.length; i++) {
    const curLog = logs[i - 1];
    const nextLog = logs[i];
    const curMinutes = curLog.offset;
    const nextMinutes = nextLog.offset;
    const timeDiff = nextMinutes - curMinutes;
    const paceDiff = nextLog.pace - curLog.pace;

    // productive, wasted도 추가해줘야 함.
    const productiveDiff = nextLog.productive - curLog.productive;
    const wastedDiff = nextLog.wasted - curLog.wasted;

    const numOfBlocks =
      timeDiff % UNIT > 0
        ? // 만약 끝나는 시간이 curLog.offset + UNIT % 0 이면 중복됨. 아니면 중복 안 됨.
          Math.floor(timeDiff / UNIT) + 1
        : Math.floor(timeDiff / UNIT);

    for (let j = 1; j < numOfBlocks; j++) {
      const productiveDirection = nextLog.direction === 'productive';

      result.push({
        offset: Math.floor(curLog.offset + UNIT * j),
        direction: nextLog.direction,
        productive: productiveDirection
          ? Math.floor(curLog.productive + (productiveDiff / numOfBlocks) * j)
          : curLog.productive,
        wasted: !productiveDirection
          ? Math.floor(curLog.wasted + (wastedDiff / numOfBlocks) * j)
          : curLog.wasted,
        pace: Math.floor(curLog.pace + (paceDiff / numOfBlocks) * j),
      });
    }
    result.push(nextLog);
  }
  return result;
};
