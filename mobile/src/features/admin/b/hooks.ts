import { useEffect } from 'react';

import { OFFLINE_WRITE_MESSAGE, useIsOffline } from '@/lib/connectivity';
import { toast } from '@/lib/toast';

/**
 * Admin writes are never queued offline: returns `offline` for disabling
 * controls and `ensureOnline()` that toasts the offline message when blocked.
 */
export function useAdminWriteGuard() {
  const offline = useIsOffline();
  const ensureOnline = (): boolean => {
    if (!offline) return true;
    toast.error(OFFLINE_WRITE_MESSAGE);
    return false;
  };
  return { offline, ensureOnline };
}

/** Toasts each new query failure once (the web toasts its fetch errors). */
export function useQueryErrorToast(
  error: Error | null,
  errorUpdatedAt: number,
  message: (error: Error) => string,
) {
  const text = error ? message(error) : null;
  useEffect(() => {
    if (text) toast.error(text);
  }, [text, errorUpdatedAt]);
}
