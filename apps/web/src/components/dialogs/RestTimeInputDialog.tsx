import clsx from 'clsx';
import React, { useEffect, useRef, useState } from 'react';

import { initAudioContext } from '../../utils/soundUtil';

interface RestTimeInputDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (minutes: number) => void;
  onSkip: () => void;
}

export const RestTimeInputDialog: React.FC<RestTimeInputDialogProps> = ({
  isOpen,
  onClose,
  onSubmit,
  onSkip,
}) => {
  const [minutesInput, setMinutesInput] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Dialog가 열릴 때 입력 필드에 포커스
      setTimeout(() => {
        inputRef.current?.focus();
        setMinutesInput('');
        setError('');
      }, 100);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  const handleSubmit = () => {
    const minutes = parseInt(minutesInput, 10);

    if (!minutesInput.trim()) {
      setError('휴식 시간을 입력해주세요');
      return;
    }

    if (isNaN(minutes) || minutes <= 0) {
      setError('올바른 숫자를 입력해주세요');
      return;
    }

    if (minutes > 300) {
      setError('300분 이하로 입력해주세요');
      return;
    }

    // AudioContext 초기화 (사용자 인터랙션 시점)
    initAudioContext();

    onSubmit(minutes);
    onClose();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMinutesInput(e.target.value);
    setError('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  const handleSkip = () => {
    onSkip();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <h3 className="text-lg font-bold">휴식 시간 설정</h3>
        <p className="py-4 text-sm">
          원하는 휴식 시간을 분 단위로 입력하세요.
          <br />
          종료 1분 전과 종료 시각에 알림을 받을 수 있습니다.
          <br />
          알림이 필요 없다면 바로 소비 기록만 등록할 수 있습니다.
        </p>

        <div className="form-control">
          <label className="label">
            <span className="label-text">휴식 시간 (분)</span>
          </label>
          <input
            ref={inputRef}
            type="number"
            placeholder="예: 10"
            className={clsx(
              'input input-bordered w-full',
              error && 'input-error',
            )}
            value={minutesInput}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            min="1"
            max="300"
          />
          {error && (
            <label className="label">
              <span className="label-text-alt text-error">{error}</span>
            </label>
          )}
        </div>

        <div className="modal-action">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            취소 (ESC)
          </button>
          <button type="button" className="btn btn-outline" onClick={handleSkip}>
            알람 없이 등록
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSubmit}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};
