import { usePathname } from 'expo-router';
import { useEffect, useLayoutEffect, useRef } from 'react';

import { useAuthStore } from '@/features/auth/auth-store';
import {
  holdBoot,
  isBootVisible,
  markAppMounted,
  runBeforeBootReveal,
  setBootPhase,
  setBootProgress,
  showBootSplash,
} from './boot-store';
import { prefetchPageData } from './preload';

/**
 * Drives the boot overlay from auth state (web `BootController`): holds it
 * while the session or profile is loading, re-shows it right after login,
 * and prefetches every section's first screen before it fades out.
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

  const prefetchUserId = userId && profileReady ? userId : null;
  useEffect(() => {
    if (!prefetchUserId) return;
    runBeforeBootReveal(() => prefetchPageData(prefetchUserId, (fraction) => setBootProgress(0.6 + fraction * 0.35)));
  }, [prefetchUserId]);

  return null;
}
