import { useEffect } from 'react';

import { subscribeOffline } from '@/lib/connectivity';
import { toast } from '@/lib/toast';

/** Web `ConnectionToasts`: one `connection-status` toast slot. */
export function ConnectivityWatcher() {
  useEffect(
    () =>
      subscribeOffline((offline) => {
        if (offline) {
          toast.error('Brak połączenia z internetem', { id: 'connection-status', duration: Number.POSITIVE_INFINITY });
        } else {
          toast.success('Połączenie przywrócone', { id: 'connection-status', duration: 3000 });
        }
      }),
    [],
  );
  return null;
}
