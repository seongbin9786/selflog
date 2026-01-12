export type SoundType = 'beep' | 'bell' | 'chime' | 'custom';

export interface SoundSettings {
  selectedSound: SoundType;
  customSoundData: string | null;
  customSoundName: string | null;
  infiniteRepeat: boolean;
}

export interface RestNotification {
  targetTime: string;
  durationMinutes: number;
  startTime: number;
}

export interface AudioPlayback {
  stop: () => void;
}

export interface RemainingTimeInfo {
  remaining: number;
  isOvertime: boolean;
  formatted: string;
}
