import React, { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { SOUND_OPTIONS } from '../../constants/sound';
import { RootState } from '../../store';
import {
  clearCustomSound,
  setCustomSound,
  setInfiniteRepeat,
  setSelectedSound,
} from '../../store/soundSettings';
import type { SoundType } from '../../types/sound';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import { SoundOptionItem } from './SoundOptionItem';
import { useAudioPreview } from './useAudioPreview';
import { useCustomSoundUpload } from './useCustomSoundUpload';
import { useDeleteConfirmation } from './useDeleteConfirmation';

interface SoundSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 알림음 설정 Dialog (리팩토링 버전)
 */
export const SoundSettingsDialog: React.FC<SoundSettingsDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const dispatch = useDispatch();
  const { selectedSound, customSoundData, customSoundName, infiniteRepeat } =
    useSelector((state: RootState) => state.soundSettings);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Custom hooks
  const { playingSound, progress, playPreview, stopPreview } =
    useAudioPreview();
  const { uploadError, handleFileUpload, clearError } = useCustomSoundUpload();
  const { showConfirm, requestDelete, confirmDelete, cancelDelete } =
    useDeleteConfirmation();

  // ESC 키로 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // Dialog 닫힐 때 오디오 정리
  useEffect(() => {
    if (!isOpen) {
      stopPreview();
    }
  }, [isOpen, stopPreview]);

  // 사운드 선택 핸들러
  const handleSoundSelect = (soundType: SoundType) => {
    if (soundType === 'custom' && !customSoundData) {
      fileInputRef.current?.click();
      return;
    }
    dispatch(setSelectedSound(soundType));
  };

  // 파일 업로드 핸들러
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    handleFileUpload(file || null, ({ data, name }) => {
      dispatch(setCustomSound({ data, name }));
    });
    event.target.value = '';
  };

  // 삭제 확인 핸들러
  const handleConfirmDelete = () => {
    confirmDelete(() => {
      stopPreview();
      dispatch(clearCustomSound());
      clearError();
    });
  };

  // 사운드 옵션 목록 생성
  const soundOptions = [
    ...SOUND_OPTIONS,
    {
      value: 'custom' as const,
      label: '커스텀',
      desc: customSoundName || '음성 파일 업로드',
    },
  ];

  if (!isOpen) return null;

  return (
    <div className="modal modal-open" onClick={onClose}>
      <div className="modal-box max-w-md" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold">알림음 설정</h3>
        <p className="py-2 text-sm text-gray-600">
          휴식 시간 알림에 사용할 소리를 선택하세요
        </p>

        <div className="form-control gap-3">
          {soundOptions.map((option) => (
            <SoundOptionItem
              key={option.value}
              value={option.value}
              label={option.label}
              desc={option.desc}
              isSelected={selectedSound === option.value}
              hasCustomData={!!customSoundData}
              isPlaying={playingSound === option.value}
              progress={progress}
              onSelect={() => handleSoundSelect(option.value)}
              onPreview={() =>
                playPreview(
                  option.value,
                  option.value === 'custom' ? customSoundData : null,
                )
              }
              onDelete={option.value === 'custom' ? requestDelete : undefined}
            />
          ))}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {uploadError && (
          <div className="mt-2 text-sm text-error">{uploadError}</div>
        )}

        <div className="form-control mt-4">
          <label className="label cursor-pointer justify-start gap-3">
            <input
              type="checkbox"
              className="toggle toggle-primary"
              checked={infiniteRepeat}
              onChange={(e) => dispatch(setInfiniteRepeat(e.target.checked))}
            />
            <div>
              <span className="label-text font-medium">무한 반복</span>
              <p className="text-xs text-gray-500">
                알림을 확인할 때까지 소리가 계속 반복됩니다
              </p>
            </div>
          </label>
        </div>

        <div className="modal-action">
          <button type="button" className="btn" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>

      {/* 삭제 확인 Dialog */}
      <DeleteConfirmDialog
        isOpen={showConfirm}
        fileName={customSoundName || ''}
        onConfirm={handleConfirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
};
