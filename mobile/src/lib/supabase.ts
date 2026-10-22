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

const REQUEST_TIMEOUT_MS = 20_000;
const TIMED_PATHS = ['/rest/v1/', '/auth/v1/'];

/**
 * expo/fetch requests never time out on their own, so a hung database or token
 * refresh would keep spinners and buttons busy forever. Postgres cancels
 * statements after 8 s and PostgREST waits ~10 s for a pool connection, so
 * 20 s only cuts off requests that would never answer. supabase-js calls this
 * after attaching the session token, so a slow token refresh does not eat into
 * a query's budget. Storage uploads and edge functions (the AI replies) may
 * legitimately take longer and are not timed.
 */
function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (!TIMED_PATHS.some((path) => url.includes(path))) return fetch(input, init);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const outer = init?.signal;
  const forwardAbort = () => controller.abort();
  if (outer?.aborted) controller.abort();
  else outer?.addEventListener('abort', forwardAbort, { once: true });
  return fetch(input, { ...init, signal: controller.signal }).finally(() => {
    clearTimeout(timer);
    outer?.removeEventListener('abort', forwardAbort);
  });
}

export const supabase = createClient<Database>(env.supabaseUrl, env.supabaseKey, {
  global: { fetch: fetchWithTimeout },
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
  // postgrest-js retries failed GETs 3 more times (1, 2, 4 s); React Query's
  // single retry already covers transient failures.
  db: { retry: false },
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
