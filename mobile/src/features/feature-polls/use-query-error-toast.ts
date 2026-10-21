import { onlineManager } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { getErrorMessage } from '@/lib/errors';
import { toast } from '@/lib/toast';

/** Web toasts every failed load (`getErrorMessage(error, fallback)`); offline failures stay quiet. */
export function useQueryErrorToast(error: unknown, errorUpdatedAt: number, fallback: string) {
  const lastToastedAt = useRef(0);
  useEffect(() => {
    if (!errorUpdatedAt || errorUpdatedAt === lastToastedAt.current) return;
    lastToastedAt.current = errorUpdatedAt;
    if (onlineManager.isOnline()) toast.error(getErrorMessage(error, fallback));
  }, [error, errorUpdatedAt, fallback]);
}
