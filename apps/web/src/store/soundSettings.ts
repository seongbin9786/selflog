import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import type { SoundSettings, SoundType } from '../types/sound';
import { LocalStorageManager } from '../utils/LocalStorageManager';

const STORAGE_KEY = 'soundSettings';
const DEFAULT_SETTINGS: SoundSettings = {
  selectedSound: 'beep',
  customSoundData: null,
  customSoundName: null,
  infiniteRepeat: true,
};

// LocalStorage Manager 생성
const storageManager = new LocalStorageManager<SoundSettings>(
  STORAGE_KEY,
  DEFAULT_SETTINGS,
);

const initialState: SoundSettings = storageManager.load();

export const SoundSettingsSlice = createSlice({
  name: 'soundSettings',
  initialState,
  reducers: {
    setSelectedSound: (state, action: PayloadAction<SoundType>) => {
      state.selectedSound = action.payload;
      storageManager.save(state);
    },
    setCustomSound: (
      state,
      action: PayloadAction<{ data: string; name: string }>,
    ) => {
      state.customSoundData = action.payload.data;
      state.customSoundName = action.payload.name;
      state.selectedSound = 'custom';
      storageManager.save(state);
    },
    clearCustomSound: (state) => {
      state.customSoundData = null;
      state.customSoundName = null;
      if (state.selectedSound === 'custom') {
        state.selectedSound = 'beep';
      }
      storageManager.save(state);
    },
    setInfiniteRepeat: (state, action: PayloadAction<boolean>) => {
      state.infiniteRepeat = action.payload;
      storageManager.save(state);
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

// Re-export types for convenience
export type { SoundSettings, SoundType } from '../types/sound';
