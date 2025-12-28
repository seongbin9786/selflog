import { ChangeEvent, useState } from 'react';

import { ProductivePaceChart } from '../components/charts/ProductivePaceChart';
import { DEFAULT_PACE_IN_MIN } from '../policies/userConfig';
import { avgPaceOf, Log } from '../utils/PaceUtil';
import { loadFromStorage, saveToStorage } from '../utils/StorageUtil';
import { parseOrDefault } from '../utils/StringUtil';

const STORAGE_KEY_TARGET_PACE = 'targetPace';
const storedTargetPace = loadFromStorage(STORAGE_KEY_TARGET_PACE);
const initialTargetPace = parseOrDefault(storedTargetPace, DEFAULT_PACE_IN_MIN);

/**
 * ProductivePace 차트 + 입력 폼을 포함한 영역
 */
export const Area_ProductivePaceChart = ({
  logsForCharts,
}: {
  logsForCharts: Log[];
}) => {
  const [targetPace, setTargetPace] = useState(initialTargetPace);

  const updateTargetPace = (e: ChangeEvent<HTMLInputElement>) => {
    const nextPace = Number.parseInt(e.target.value, 10);
    setTargetPace(nextPace);
    saveToStorage(STORAGE_KEY_TARGET_PACE, nextPace + '');
  };

  return (
    <div className="flex flex-col gap-2">
      <div>
        <h1 className="text-sm font-bold">[생산 페이스]</h1>
        <span className="text-xs">목표 페이스 설정: </span>
        <input
          className="input input-bordered input-xs"
          value={targetPace}
          onChange={updateTargetPace}
        />
      </div>
      <ProductivePaceChart
        data={logsForCharts}
        totalAvg={0}
        targetPace={targetPace}
        todayAvg={avgPaceOf(logsForCharts)}
      />
    </div>
  );
};
