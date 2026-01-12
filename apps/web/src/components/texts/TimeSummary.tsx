import { minutesToTimeString } from '../../utils/DateUtil';
import { Log } from '../../utils/PaceUtil';

const DEFAULT_VALUE = {
  productive: 0,
  wasted: 0,
};

interface TimeSummaryProps {
  logs: Log[];
}

export const TimeSummary = ({ logs }: TimeSummaryProps) => {
  // 누적 값이므로 최종 값만 추출, 로그가 비어 있는 경우 추출 불가
  const { productive, wasted } = logs[logs.length - 1] || DEFAULT_VALUE;
  const difference = productive - wasted;

  // 로그가 없으면 비율을 둘 모두 0%로 표시
  const hasAnyLogs = productive + wasted > 0;
  const _ratio = Math.round((productive / (productive + wasted)) * 100);
  const productiveRatio = hasAnyLogs ? _ratio : 0;
  const wastedRatio = hasAnyLogs ? 100 - _ratio : 0;

  const isProductiveSurplus = difference >= 0;
  const label = isProductiveSurplus ? '확보 시간' : '초과 시간';
  const colorClass = isProductiveSurplus ? 'text-green-600' : 'text-red-600';

  return (
    <div className="flex gap-1 text-lg">
      <span>
        {label}: [
        <span className={`font-bold ${colorClass}`}>
          {minutesToTimeString(Math.abs(difference))}
        </span>
        ]
      </span>
      <span>
        생산{' '}
        <span className="font-bold text-green-600">
          {minutesToTimeString(productive)}
        </span>{' '}
        ({productiveRatio}%)
      </span>
      <span>
        소비{' '}
        <span className="font-bold text-red-600">
          {minutesToTimeString(wasted)}
        </span>{' '}
        ({wastedRatio}%)
      </span>
    </div>
  );
};
