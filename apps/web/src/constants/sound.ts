export const SOUND_DURATIONS = {
  beep: 150,
  bell: 300,
  chime: 400,
} as const;

export const SOUND_OPTIONS = [
  { value: 'beep', label: '비프 (Beep)', desc: '기본 전자음' },
  { value: 'bell', label: '벨 (Bell)', desc: '높은 톤의 벨 소리' },
  { value: 'chime', label: '차임 (Chime)', desc: '화음이 있는 차임벨' },
] as const;

export const AUDIO_CONSTRAINTS = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  REPEAT_INTERVAL_MS: 5000, // 5초
} as const;

export const TIME_CONSTANTS = {
  ONE_MINUTE_MS: 60 * 1000,
  ONE_SECOND_MS: 1000,
  PROGRESS_UPDATE_INTERVAL_MS: 16, // ~60fps
} as const;
