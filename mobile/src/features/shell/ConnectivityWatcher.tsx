import NetInfo from '@react-native-community/netinfo';
import { useEffect, useRef } from 'react';

import { toast } from '@/lib/toast';

/** Web `ConnectionToasts`: one `connection-status` toast slot. */
export function ConnectivityWatcher() {
  const wasOffline = useRef(false);
  useEffect(
    () =>
      NetInfo.addEventListener((state) => {
        const offline = state.isConnected === false || state.isInternetReachable === false;
        if (offline && !wasOffline.current) {
          wasOffline.current = true;
          toast.error('Brak połączenia z internetem', { id: 'connection-status', duration: Number.POSITIVE_INFINITY });
        } else if (!offline && wasOffline.current) {
          wasOffline.current = false;
          toast.success('Połączenie przywrócone', { id: 'connection-status', duration: 3000 });
        }
      }),
    [],
  );
  return null;
}
