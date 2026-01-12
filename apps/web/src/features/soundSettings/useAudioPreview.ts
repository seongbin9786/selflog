import { useMemo, useState } from 'react';

import { AudioPlayer } from '../../services/AudioPlayer';
import type { SoundType } from '../../types/sound';

/**
 * 오디오 미리듣기 기능을 제공하는 Hook
 */
export const useAudioPreview = () => {
  const [playingSound, setPlayingSound] = useState<SoundType | null>(null);
  const [progress, setProgress] = useState(0);

  const player = useMemo(() => new AudioPlayer(), []);

  const playPreview = (soundType: SoundType, customData?: string | null) => {
    setPlayingSound(soundType);
    setProgress(0);

    player.play(
      soundType,
      customData,
      (newProgress) => setProgress(newProgress),
      () => {
        setPlayingSound(null);
        setProgress(0);
      },
    );
  };

  const stopPreview = () => {
    player.stop();
    setPlayingSound(null);
    setProgress(0);
  };

  return {
    playingSound,
    progress,
    playPreview,
    stopPreview,
  };
};
