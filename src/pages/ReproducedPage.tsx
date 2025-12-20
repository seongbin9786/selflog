import clsx from 'clsx';
import { useState } from 'react';
import { AreaChart, ResponsiveContainer } from 'recharts';

export const ReproducedPage = () => {
  const [minHeightZero, setMinHeightZero] = useState(true);

  return (
    <div className="flex h-screen w-screen flex-col p-4">
      <label>
        <input
          type="checkbox"
          onChange={() => setMinHeightZero(!minHeightZero)}
          checked={minHeightZero}
        />
        min-h-0 적용
      </label>
      flex container
      <div className="deco flex">something (flex)</div>
      <div
        className={clsx(
          'deco grid flex-1 grid-cols-1 grid-rows-2',
          minHeightZero ? 'min-h-0' : '',
        )}
      >
        grid item (flex-1, flex container)
        <div className="deco flex flex-col gap-2">
          grid item (flex-1, flex container)
          <div className="deco h-20">something (block)</div>
          <ResponsiveContainer
            className={clsx('deco', minHeightZero ? 'min-h-0' : '')}
          >
            <AreaChart data={[]}></AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
