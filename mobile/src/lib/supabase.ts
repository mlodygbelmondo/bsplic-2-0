import { createClient } from '@supabase/supabase-js';
import { AppState, type AppStateStatus } from 'react-native';

import type { Database } from '@/types/supabase';

import { env } from './env';
import { secureAuthStorage } from './secure-auth-storage';

export const supabase = createClient<Database>(
  env.supabaseUrl,
  env.supabasePublishableKey,
  {
    auth: {
      storage: secureAuthStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
);

const updateAuthRefreshForAppState = async (
  state: AppStateStatus,
): Promise<void> => {
  if (state === 'active') {
    await supabase.auth.startAutoRefresh();
    return;
  }

  await supabase.auth.stopAutoRefresh();
};
/**
 * Keeps Supabase's proactive refresh loop active only while the native app is
 * in the foreground. Install this once near the auth provider and dispose it
 * when that provider unmounts.
 */
export const subscribeToAuthAppState = (): (() => void) => {
  const applyState = (state: AppStateStatus) => {
    void updateAuthRefreshForAppState(state).catch((error: unknown) => {
      console.error('Failed to update Supabase auth refresh lifecycle:', error);
    });
  };

  applyState(AppState.currentState);
  const subscription = AppState.addEventListener('change', applyState);

  return () => {
    subscription.remove();
    void supabase.auth.stopAutoRefresh().catch((error: unknown) => {
      console.error('Failed to stop Supabase auth refresh:', error);
    });
  };
};
