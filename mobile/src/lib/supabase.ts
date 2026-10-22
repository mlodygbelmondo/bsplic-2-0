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
