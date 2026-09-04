import { lazy, Suspense, useEffect, useState } from 'react';

import {
  PWA_UPDATE_AVAILABLE_EVENT,
  type PwaUpdateAvailableEventDetail,
} from '@/lib/pwa-update';

const PwaUpdateDialog = lazy(() => import('./PwaUpdateDialog'));

export function PwaUpdateModal() {
  const [refreshHandler, setRefreshHandler] = useState<(() => void) | null>(
    null,
  );

  useEffect(() => {
    const handleUpdateAvailable = (event: Event) => {
      const { detail } = event as CustomEvent<PwaUpdateAvailableEventDetail>;

      if (typeof detail?.refresh !== 'function') {
        return;
      }

      setRefreshHandler(() => detail.refresh);
    };

    window.addEventListener(PWA_UPDATE_AVAILABLE_EVENT, handleUpdateAvailable);

    return () => {
      window.removeEventListener(
        PWA_UPDATE_AVAILABLE_EVENT,
        handleUpdateAvailable,
      );
    };
  }, []);

  if (!refreshHandler) return null;

  return (
    <Suspense fallback={null}>
      <PwaUpdateDialog refreshHandler={refreshHandler} />
    </Suspense>
  );
}
