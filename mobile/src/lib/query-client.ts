import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import { AppState, type AppStateStatus } from 'react-native';

import { isOffline, subscribeOffline } from './connectivity';
import { serializeQueryCache } from './query-persistence';
import { kv } from './storage';

/**
 * One client for the whole app (same defaults as the web's
 * `src/lib/query-client.ts`), persisted to MMKV so previously loaded data
 * renders instantly on a cold start and stays readable offline.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      // Persisted entries must outlive the persister's maxAge window.
      gcTime: 24 * 60 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
      // Serve cached data while offline instead of failing.
      networkMode: 'offlineFirst',
    },
    mutations: {
      // Never queue writes while offline: 'online' would pause the mutation and
      // send it on reconnect; 'always' lets it fail at once.
      networkMode: 'always',
    },
  },
});

/**
 * Page data (feeds, profiles, rankings, casino tables): cached data shows
 * instantly and is always refreshed in the background when the screen opens.
 */
export const PAGE_DATA_QUERY_OPTIONS = {
  refetchOnMount: 'always',
} as const;

export const queryPersister = createSyncStoragePersister({
  storage: {
    getItem: (key) => kv.getString(key) ?? null,
    setItem: (key, value) => kv.set(key, value),
    removeItem: (key) => {
      kv.remove(key);
    },
  },
  key: 'bsplic.query-cache',
  throttleTime: 1500,
  serialize: serializeQueryCache,
});

export const PERSIST_MAX_AGE = 24 * 60 * 60_000;

/** Bump to drop every persisted cache after a breaking data-shape change. */
export const PERSIST_BUSTER = 'v1';

// React Query focus = app foreground; online = NetInfo reachability (see connectivity).
focusManager.setEventListener((setFocused) => {
  const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
    setFocused(status === 'active');
  });
  return () => subscription.remove();
});

onlineManager.setEventListener((setOnline) => {
  setOnline(!isOffline());
  return subscribeOffline((offline) => setOnline(!offline));
});
