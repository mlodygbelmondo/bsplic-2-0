import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import type { Database } from './database.types';
import { env } from './env';
import { kv, secureKv } from './storage';

/** supabase-js's default session key, named explicitly so boot can read the stored session synchronously. */
export const AUTH_STORAGE_KEY = `sb-${new URL(env.supabaseUrl).hostname.split('.')[0]}-auth-token`;

/** Set while a sign-out runs (the UI is already signed out). */
export const PENDING_SIGN_OUT_KEY = 'bsplic.auth.pendingSignOut';

// The app died before supabase-js finished a sign-out: never restore that session.
if (kv.getBoolean(PENDING_SIGN_OUT_KEY)) {
  secureKv.remove(AUTH_STORAGE_KEY);
  kv.remove(PENDING_SIGN_OUT_KEY);
}

export const supabase = createClient<Database>(env.supabaseUrl, env.supabaseKey, {
  auth: {
    storageKey: AUTH_STORAGE_KEY,
    storage: {
      getItem: (key) => secureKv.getString(key) ?? null,
      setItem: (key, value) => secureKv.set(key, value),
      removeItem: (key) => {
        secureKv.remove(key);
      },
    },
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  db: {
    // expo/fetch requests never time out on their own, so a hung database would
    // keep spinners and buttons busy forever. Postgres cancels statements after
    // 8 s and PostgREST waits ~10 s for a pool connection, so 20 s only cuts off
    // requests that would never answer.
    timeout: 20_000,
    // postgrest-js retries failed GETs 3 more times (1, 2, 4 s); React Query's
    // single retry already covers transient failures.
    retry: false,
  },
});

// Refresh tokens only while the app is in the foreground (Supabase guidance
// for React Native); resuming restarts the refresh loop immediately.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
