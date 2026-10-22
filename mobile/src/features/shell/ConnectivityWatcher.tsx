import { useEffect } from 'react';

import { showOfflineToast, subscribeOffline } from '@/lib/connectivity';
import { toast } from '@/lib/toast';

/** Web `ConnectionToasts`: one `connection-status` toast slot. */
export function ConnectivityWatcher() {
  useEffect(
    () =>
      subscribeOffline((offline) => {
        if (offline) {
          showOfflineToast();
        } else {
          toast.success('Połączenie przywrócone', { id: 'connection-status', duration: 3000 });
        }
      }),
    [],
  );
  return null;
}
