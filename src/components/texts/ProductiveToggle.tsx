import clsx from 'clsx';
import React from 'react';

interface ProductiveToggleProps {
  isProductive: boolean;
  setIsProductive: (value: boolean) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  checkboxRef: React.RefObject<HTMLInputElement>;
}

export const ProductiveToggle = ({
  isProductive,
  setIsProductive,
  onKeyDown,
  checkboxRef,
}: ProductiveToggleProps) => (
  <label className="relative inline-flex cursor-pointer items-center">
    <input
      type="checkbox"
      className={clsx('toggle toggle-sm', isProductive && 'toggle-success')}
      checked={isProductive}
      onChange={(e) => setIsProductive(e.target.checked)}
      onKeyDown={onKeyDown}
      ref={checkboxRef}
    />
    <span
      className={clsx(
        'pointer-events-none absolute flex h-4 w-4 items-center justify-center text-[10px] font-bold text-white transition-all',
        isProductive ? 'left-3.5' : 'left-0.5',
      )}
    >
      {isProductive ? '+' : '-'}
    </span>
  </label>
);
