import clsx from 'clsx';
import { Trash2, Volume2 } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { RootState } from '../../store';
import {
  clearCustomSound,
  setCustomSound,
  setInfiniteRepeat,
  setSelectedSound,
  SoundType,
} from '../../store/soundSettings';
import { playSoundByType } from '../../utils/soundUtil';

interface SoundSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SoundSettingsDialog: React.FC<SoundSettingsDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const dispatch = useDispatch();
  const { selectedSound, customSoundData, customSoundName, infiniteRepeat } =
    useSelector((state: RootState) => state.soundSettings);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [playingSound, setPlayingSound] = useState<SoundType | null>(null);
  const [progress, setProgress] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setPlayingSound(null);
      setProgress(0);
    }
  }, [isOpen]);

  const soundOptions: { value: SoundType; label: string; desc: string }[] = [
    { value: 'beep', label: '비프 (Beep)', desc: '기본 전자음' },
    { value: 'bell', label: '벨 (Bell)', desc: '높은 톤의 벨 소리' },
    { value: 'chime', label: '차임 (Chime)', desc: '화음이 있는 차임벨' },
    {
      value: 'custom',
      label: '커스텀',
      desc: customSoundName || '음성 파일 업로드',
    },
  ];

  const handleSoundSelect = (soundType: SoundType) => {
    if (soundType === 'custom') {
      // 커스텀 사운드가 없을 때만 파일 업로드 dialog 열기
      if (!customSoundData) {
        fileInputRef.current?.click();
        return;
      }
    }
    dispatch(setSelectedSound(soundType));
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 파일 타입 검증
    if (!file.type.startsWith('audio/')) {
      setUploadError('오디오 파일만 업로드 가능합니다');
      return;
    }

    // 파일 크기 검증 (5MB 제한)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('파일 크기는 5MB 이하여야 합니다');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const audioData = e.target?.result as string;
      dispatch(
        setCustomSound({
          data: audioData,
          name: file.name,
        }),
      );
      setUploadError('');
    };
    reader.onerror = () => {
      setUploadError('파일 읽기에 실패했습니다');
    };
    reader.readAsDataURL(file);

    // input 초기화
    event.target.value = '';
  };

  const handlePreview = (soundType: SoundType) => {
    // 이전 재생 중지
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    setPlayingSound(soundType);
    setProgress(0);

    if (soundType === 'custom' && customSoundData) {
      // 커스텀 사운드: Audio 객체로 재생하고 progress 추적
      const audio = new Audio(customSoundData);
      audio.volume = 0.5;
      audioRef.current = audio;

      const updateProgress = () => {
        if (audio.duration > 0) {
          setProgress((audio.currentTime / audio.duration) * 100);
        }
      };

      audio.addEventListener('timeupdate', updateProgress);
      audio.addEventListener('ended', () => {
        setPlayingSound(null);
        setProgress(0);
        audioRef.current = null;
      });

      audio.play().catch((error) => {
        console.error('Custom sound playback failed:', error);
        setPlayingSound(null);
        setProgress(0);
      });
    } else {
      // Web Audio API 사운드: 고정된 duration 사용
      playSoundByType(soundType, null);

      // 각 사운드의 duration (밀리초)
      const durations: Record<Exclude<SoundType, 'custom'>, number> = {
        beep: 150,
        bell: 300,
        chime: 400,
      };

      const duration = durations[soundType as Exclude<SoundType, 'custom'>];
      const startTime = Date.now();

      intervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const currentProgress = Math.min((elapsed / duration) * 100, 100);
        setProgress(currentProgress);

        if (currentProgress >= 100) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setPlayingSound(null);
          setProgress(0);
        }
      }, 16); // ~60fps
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    // 재생 중이면 중지
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setPlayingSound(null);
    setProgress(0);

    dispatch(clearCustomSound());
    setUploadError('');
    setShowDeleteConfirm(false);
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

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
            <label
              key={option.value}
              className={clsx(
                'flex cursor-pointer flex-col rounded-lg border transition-colors',
                selectedSound === option.value
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
                    checked={selectedSound === option.value}
                    onChange={() => handleSoundSelect(option.value)}
                  />
                  <div>
                    <div className="font-medium">{option.label}</div>
                    <div className="text-xs text-gray-500">{option.desc}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {option.value === 'custom' && customSoundData && (
                    <button
                      type="button"
                      className="btn btn-circle btn-ghost"
                      onClick={(e) => {
                        e.preventDefault();
                        handleDeleteClick();
                      }}
                      title="커스텀 사운드 삭제"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                  {option.value !== 'custom' || customSoundData ? (
                    <button
                      type="button"
                      className="btn btn-circle btn-ghost"
                      onClick={(e) => {
                        e.preventDefault();
                        handlePreview(option.value);
                      }}
                      disabled={option.value === 'custom' && !customSoundData}
                    >
                      <Volume2 size={16} />
                    </button>
                  ) : null}
                </div>
              </div>
              <progress
                className={clsx(
                  'progress h-1 w-full',
                  playingSound === option.value
                    ? 'progress-primary'
                    : 'progress-ghost opacity-0',
                )}
                value={playingSound === option.value ? progress : 0}
                max="100"
              />
            </label>
          ))}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleFileUpload}
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
      {showDeleteConfirm && (
        <div className="modal modal-open" onClick={handleCancelDelete}>
          <div
            className="modal-box max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold">커스텀 사운드 삭제</h3>
            <p className="py-4">
              커스텀 사운드 파일을 삭제하시겠습니까?
              <br />
              <span className="text-sm text-gray-500">
                파일명: {customSoundName}
              </span>
            </p>
            <div className="modal-action">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleCancelDelete}
              >
                취소
              </button>
              <button
                type="button"
                className="btn btn-error"
                onClick={handleConfirmDelete}
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
