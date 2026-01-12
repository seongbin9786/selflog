import { configureStore } from '@reduxjs/toolkit';

import { authReducer } from './auth';
import { LogsReducer } from './logs';
import { RawLogStorageSyncMiddleware } from './RawLogStorageSyncMiddleware';
import { RestNotificationReducer } from './restNotification';
import { SoundSettingsReducer } from './soundSettings';

export const store = configureStore({
  reducer: {
    logs: LogsReducer,
    restNotification: RestNotificationReducer,
    soundSettings: SoundSettingsReducer,
    auth: authReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().prepend(RawLogStorageSyncMiddleware.middleware),
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;

// Inferred type: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch;
