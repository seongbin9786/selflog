import { SOUND_DURATIONS, TIME_CONSTANTS } from '../constants/sound';
import type { AudioPlayback, SoundType } from '../types/sound';
import { playSoundByType } from '../utils/soundUtil';

/**
 * 오디오 재생을 관리하는 서비스 클래스
 */
export class AudioPlayer {
  private audioElement: HTMLAudioElement | null = null;
  private progressInterval: NodeJS.Timeout | null = null;
  private onProgressUpdate?: (progress: number) => void;
  private onComplete?: () => void;

  /**
   * 사운드를 재생합니다.
   * @param soundType 재생할 사운드 타입
   * @param customData 커스텀 사운드 데이터 (base64)
   * @param onProgressUpdate 진행률 업데이트 콜백 (0-100)
   * @param onComplete 재생 완료 콜백
   * @returns AudioPlayback 객체
   */
  play(
    soundType: SoundType,
    customData?: string | null,
    onProgressUpdate?: (progress: number) => void,
    onComplete?: () => void,
  ): AudioPlayback {
    this.stop(); // 이전 재생 중지

    this.onProgressUpdate = onProgressUpdate;
    this.onComplete = onComplete;

    if (soundType === 'custom' && customData) {
      this.playCustomSound(customData);
    } else if (soundType !== 'custom') {
      this.playBuiltInSound(soundType);
    }

    return {
      stop: () => this.stop(),
    };
  }

  /**
   * 커스텀 사운드를 재생합니다.
   */
  private playCustomSound(audioData: string): void {
    const audio = new Audio(audioData);
    audio.volume = 0.5;
    this.audioElement = audio;

    const updateProgress = () => {
      if (audio.duration > 0 && this.onProgressUpdate) {
        const progress = (audio.currentTime / audio.duration) * 100;
        this.onProgressUpdate(progress);
      }
    };

    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('ended', () => {
      this.cleanup();
      this.onComplete?.();
    });

    audio.play().catch((error) => {
      console.error('Custom sound playback failed:', error);
      this.cleanup();
    });
  }

  /**
   * 내장 사운드를 재생합니다.
   */
  private playBuiltInSound(soundType: Exclude<SoundType, 'custom'>): void {
    playSoundByType(soundType, null);

    const duration = SOUND_DURATIONS[soundType];
    const startTime = Date.now();

    this.progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / duration) * 100, 100);

      this.onProgressUpdate?.(progress);

      if (progress >= 100) {
        this.cleanup();
        this.onComplete?.();
      }
    }, TIME_CONSTANTS.PROGRESS_UPDATE_INTERVAL_MS);
  }

  /**
   * 재생을 중지합니다.
   */
  stop(): void {
    this.cleanup();
  }

  /**
   * 리소스를 정리합니다.
   */
  private cleanup(): void {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement = null;
    }

    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }
}
