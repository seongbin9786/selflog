import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type SoundType = 'beep' | 'bell' | 'chime' | 'custom';

export interface SoundSettings {
  selectedSound: SoundType;
  customSoundData: string | null; // base64 encoded audio data
  customSoundName: string | null;
  infiniteRepeat: boolean; // 무한 반복 옵션
}

const STORAGE_KEY = 'soundSettings';

// localStorage에서 초기 상태 로드
const loadFromLocalStorage = (): SoundSettings => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load sound settings from localStorage:', error);
  }
  return {
    selectedSound: 'beep',
    customSoundData: null,
    customSoundName: null,
    infiniteRepeat: true,
  };
};

const initialState: SoundSettings = loadFromLocalStorage();

// localStorage에 저장
const saveToLocalStorage = (state: SoundSettings) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save sound settings to localStorage:', error);
  }
};

export const SoundSettingsSlice = createSlice({
  name: 'soundSettings',
  initialState,
  reducers: {
    setSelectedSound: (state, action: PayloadAction<SoundType>) => {
      state.selectedSound = action.payload;
      saveToLocalStorage(state);
    },
    setCustomSound: (
      state,
      action: PayloadAction<{ data: string; name: string }>,
    ) => {
      state.customSoundData = action.payload.data;
      state.customSoundName = action.payload.name;
      state.selectedSound = 'custom';
      saveToLocalStorage(state);
    },
    clearCustomSound: (state) => {
      state.customSoundData = null;
      state.customSoundName = null;
      if (state.selectedSound === 'custom') {
        state.selectedSound = 'beep';
      }
      saveToLocalStorage(state);
    },
    setInfiniteRepeat: (state, action: PayloadAction<boolean>) => {
      state.infiniteRepeat = action.payload;
      saveToLocalStorage(state);
    },
  },
});

export const {
  actions: {
    setSelectedSound,
    setCustomSound,
    clearCustomSound,
    setInfiniteRepeat,
  },
  reducer: SoundSettingsReducer,
} = SoundSettingsSlice;
