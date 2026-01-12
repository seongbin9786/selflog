import type { SoundType } from '../store/soundSettings';

// 전역 AudioContext (사용자 인터랙션 시 활성화됨)
let globalAudioContext: AudioContext | null = null;

/**
 * AudioContext 초기화 (사용자 인터랙션 시 호출)
 */
export const initAudioContext = () => {
  if (!globalAudioContext) {
    globalAudioContext = new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    )();
  }
  // suspended 상태면 resume
  if (globalAudioContext.state === 'suspended') {
    globalAudioContext.resume();
  }
  return globalAudioContext;
};

/**
 * Bell 소리 재생 (단일 톤)
 */
const playBellSound = (duration = 0.3) => {
  if (!globalAudioContext) return;

  const oscillator = globalAudioContext.createOscillator();
  const gainNode = globalAudioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(globalAudioContext.destination);

  oscillator.frequency.value = 1000; // 더 높은 주파수
  oscillator.type = 'sine';

  gainNode.gain.setValueAtTime(0.4, globalAudioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(
    0.01,
    globalAudioContext.currentTime + duration,
  );

  oscillator.start(globalAudioContext.currentTime);
  oscillator.stop(globalAudioContext.currentTime + duration);
};

/**
 * Chime 소리 재생 (2개 톤의 화음)
 */
const playChimeSound = (duration = 0.4) => {
  if (!globalAudioContext) return;

  // 첫 번째 톤
  const osc1 = globalAudioContext.createOscillator();
  const gain1 = globalAudioContext.createGain();
  osc1.connect(gain1);
  gain1.connect(globalAudioContext.destination);
  osc1.frequency.value = 800;
  osc1.type = 'sine';
  gain1.gain.setValueAtTime(0.2, globalAudioContext.currentTime);
  gain1.gain.exponentialRampToValueAtTime(
    0.01,
    globalAudioContext.currentTime + duration,
  );
  osc1.start(globalAudioContext.currentTime);
  osc1.stop(globalAudioContext.currentTime + duration);

  // 두 번째 톤 (5도 화음)
  const osc2 = globalAudioContext.createOscillator();
  const gain2 = globalAudioContext.createGain();
  osc2.connect(gain2);
  gain2.connect(globalAudioContext.destination);
  osc2.frequency.value = 1200;
  osc2.type = 'sine';
  gain2.gain.setValueAtTime(0.2, globalAudioContext.currentTime);
  gain2.gain.exponentialRampToValueAtTime(
    0.01,
    globalAudioContext.currentTime + duration,
  );
  osc2.start(globalAudioContext.currentTime);
  osc2.stop(globalAudioContext.currentTime + duration);
};

/**
 * Web Audio API를 사용하여 알림음을 재생합니다.
 * @param frequency 주파수 (Hz)
 * @param duration 지속 시간 (초)
 */
export const playNotificationSound = (frequency = 800, duration = 0.2) => {
  try {
    // AudioContext가 없으면 생성
    if (!globalAudioContext) {
      globalAudioContext = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      )();
    }

    // suspended 상태면 resume
    if (globalAudioContext.state === 'suspended') {
      globalAudioContext.resume();
    }

    const oscillator = globalAudioContext.createOscillator();
    const gainNode = globalAudioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(globalAudioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, globalAudioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      globalAudioContext.currentTime + duration,
    );

    oscillator.start(globalAudioContext.currentTime);
    oscillator.stop(globalAudioContext.currentTime + duration);
  } catch (error) {
    console.error('사운드 재생 실패:', error);
  }
};

/**
 * 커스텀 오디오 파일 재생
 */
const playCustomSound = (audioData: string) => {
  try {
    const audio = new Audio(audioData);
    audio.volume = 0.5;
    audio.play().catch((error) => {
      console.error('커스텀 사운드 재생 실패:', error);
    });
  } catch (error) {
    console.error('커스텀 사운드 재생 실패:', error);
  }
};

/**
 * 선택된 사운드 타입에 따라 소리 재생
 */
export const playSoundByType = (
  soundType: SoundType,
  customData?: string | null,
) => {
  // AudioContext 초기화
  if (soundType !== 'custom') {
    if (!globalAudioContext) {
      globalAudioContext = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      )();
    }
    if (globalAudioContext.state === 'suspended') {
      globalAudioContext.resume();
    }
  }

  switch (soundType) {
    case 'beep':
      playNotificationSound(800, 0.15);
      break;
    case 'bell':
      playBellSound(0.3);
      break;
    case 'chime':
      playChimeSound(0.4);
      break;
    case 'custom':
      if (customData) {
        playCustomSound(customData);
      } else {
        playNotificationSound(800, 0.15); // fallback
      }
      break;
  }
};

/**
 * 여러 번의 알림음을 재생합니다.
 * @param count 재생 횟수
 * @param soundType 소리 타입
 * @param customData 커스텀 오디오 데이터
 */
export const playBeeps = (
  count = 2,
  soundType: SoundType = 'beep',
  customData?: string | null,
) => {
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      playSoundByType(soundType, customData);
    }, i * 400);
  }
};
