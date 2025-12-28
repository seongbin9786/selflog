import clsx from 'clsx';
import { Trash2, Volume2 } from 'lucide-react';
import React from 'react';

import type { SoundType } from '../../types/sound';

interface SoundOptionItemProps {
  value: SoundType;
  label: string;
  desc: string;
  isSelected: boolean;
  hasCustomData: boolean;
  isPlaying: boolean;
  progress: number;
  onSelect: () => void;
  onPreview: () => void;
  onDelete?: () => void;
}

/**
 * 사운드 옵션 아이템 컴포넌트
 */
export const SoundOptionItem: React.FC<SoundOptionItemProps> = ({
  value,
  label,
  desc,
  isSelected,
  hasCustomData,
  isPlaying,
  progress,
  onSelect,
  onPreview,
  onDelete,
}) => {
  const showPreviewButton = value !== 'custom' || hasCustomData;
  const showDeleteButton = value === 'custom' && hasCustomData && onDelete;

  return (
    <label
      className={clsx(
        'flex cursor-pointer flex-col rounded-lg border transition-colors',
        isSelected
          ? 'border-primary bg-primary bg-opacity-10'
          : 'hover:border-base-400 border-base-300',
      )}
    >
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-3">
          <input
            type="radio"
            name="sound"
            className="radio-primary radio"
            checked={isSelected}
            onChange={onSelect}
          />
          <div>
            <div className="font-medium">{label}</div>
            <div className="text-xs text-gray-500">{desc}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {showDeleteButton && (
            <button
              type="button"
              className="btn btn-circle btn-ghost"
              onClick={(e) => {
                e.preventDefault();
                onDelete();
              }}
              title="커스텀 사운드 삭제"
            >
              <Trash2 size={16} />
            </button>
          )}
          {showPreviewButton && (
            <button
              type="button"
              className="btn btn-circle btn-ghost"
              onClick={(e) => {
                e.preventDefault();
                onPreview();
              }}
              disabled={value === 'custom' && !hasCustomData}
            >
              <Volume2 size={16} />
            </button>
          )}
        </div>
      </div>
      <progress
        className={clsx(
          'progress h-1 w-full',
          isPlaying ? 'progress-primary' : 'progress-ghost opacity-0',
        )}
        value={isPlaying ? progress : 0}
        max="100"
      />
    </label>
  );
};
