import { usePathname } from 'expo-router';
import { useEffect, useLayoutEffect, useRef } from 'react';

import { useAuthStore } from '@/features/auth/auth-store';
import { holdBoot, markAppMounted, setBootPhase, setBootProgress, showBootSplash, isBootVisible } from './boot-store';

/**
 * Drives the boot overlay from auth state (web `BootController`): holds it
 * while the session or profile is loading, re-shows it right after login.
 */
export function BootController() {
  const loading = useAuthStore((s) => s.loading);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const profileReady = useAuthStore((s) => s.profileStatus === 'ready' || s.profileStatus === 'error');
  const previousUserId = useRef<string | null | undefined>(undefined);
  // A recovery link signs the user in on the reset form; never cover it.
  const onResetPassword = usePathname() === '/reset-password';

  useEffect(() => {
    markAppMounted();
  }, []);

  const waiting = loading || (Boolean(userId) && !profileReady);
  useEffect(() => {
    if (!waiting) return;
    setBootPhase('session');
    return holdBoot();
  }, [waiting]);

  useLayoutEffect(() => {
    const previous = previousUserId.current;
    previousUserId.current = userId;
    if (loading || !userId || previous === userId) return;
    // Signed in without a cold start (login form): replay the overlay while
    // the first screen loads its data.
    if (previous === null && !isBootVisible() && !onResetPassword) {
      showBootSplash();
    }
    setBootPhase('assets');
    setBootProgress(0.6);
  }, [loading, userId, onResetPassword]);

  return null;
}
