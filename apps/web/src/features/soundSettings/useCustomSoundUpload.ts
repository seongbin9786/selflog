import { useState } from 'react';

import { AUDIO_CONSTRAINTS } from '../../constants/sound';

interface UploadResult {
  data: string;
  name: string;
}

/**
 * 커스텀 사운드 파일 업로드 기능을 제공하는 Hook
 */
export const useCustomSoundUpload = () => {
  const [uploadError, setUploadError] = useState('');

  const handleFileUpload = (
    file: File | null,
    onSuccess: (result: UploadResult) => void,
  ): void => {
    if (!file) return;

    // 파일 타입 검증
    if (!file.type.startsWith('audio/')) {
      setUploadError('오디오 파일만 업로드 가능합니다');
      return;
    }

    // 파일 크기 검증
    if (file.size > AUDIO_CONSTRAINTS.MAX_FILE_SIZE) {
      setUploadError('파일 크기는 5MB 이하여야 합니다');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const audioData = e.target?.result as string;
      onSuccess({
        data: audioData,
        name: file.name,
      });
      setUploadError('');
    };

    reader.onerror = () => {
      setUploadError('파일 읽기에 실패했습니다');
    };

    reader.readAsDataURL(file);
  };

  const clearError = () => {
    setUploadError('');
  };

  return {
    uploadError,
    handleFileUpload,
    clearError,
  };
};
