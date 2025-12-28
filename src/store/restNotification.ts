import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import type { RestNotification } from '../types/sound';

export type RestNotificationState = {
  currentNotification: RestNotification | null;
};

const initialState: RestNotificationState = {
  currentNotification: null,
};

export const RestNotificationSlice = createSlice({
  name: 'restNotification',
  initialState,
  reducers: {
    setRestNotification: (
      state,
      action: PayloadAction<{ targetTime: string; durationMinutes: number }>,
    ) => {
      state.currentNotification = {
        targetTime: action.payload.targetTime,
        durationMinutes: action.payload.durationMinutes,
        startTime: Date.now(),
      };
    },
    clearRestNotification: (state) => {
      state.currentNotification = null;
    },
  },
});

export const {
  actions: { setRestNotification, clearRestNotification },
  reducer: RestNotificationReducer,
} = RestNotificationSlice;
