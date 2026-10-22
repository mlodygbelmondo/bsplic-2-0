import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { create } from 'zustand';

import { toast } from './toast';

/**
 * Offline when NetInfo knows the device is offline. While iOS re-checks
 * reachability (`isInternetReachable` null), the last answer stands, so a
 * re-check never looks like a reconnect.
 */
function nextOffline(state: NetInfoState, previous: boolean): boolean {
  if (state.isConnected === false || state.isInternetReachable === false) return true;
  if (state.isInternetReachable === null) return previous;
  return false;
}

const useConnectivityStore = create<{ offline: boolean }>(() => ({ offline: false }));

NetInfo.addEventListener((state) => {
  const previous = useConnectivityStore.getState().offline;
  const offline = nextOffline(state, previous);
  if (offline !== previous) useConnectivityStore.setState({ offline });
});

/** True when the device is known to be offline (unknown counts as online). */
export function useIsOffline(): boolean {
  return useConnectivityStore((s) => s.offline);
}

/** Calls `listener` whenever the device goes offline or comes back. */
export function subscribeOffline(listener: (offline: boolean) => void): () => void {
  return useConnectivityStore.subscribe((state, previous) => {
    if (state.offline !== previous.offline) listener(state.offline);
  });
}

export function isOffline(): boolean {
  return useConnectivityStore.getState().offline;
}

/** The web `connection-status` toast for a lost connection; it stays until the connection returns. */
export function showOfflineToast() {
  toast.error('Brak połączenia z internetem', { id: 'connection-status', duration: Number.POSITIVE_INFINITY });
}

/**
 * Wraps a pull-to-refresh handler. Offline, queries pause and the refetch would
 * keep the spinner up until the connection returns, so the pull only shows the
 * connection toast (it may have been swiped away, or the app started offline).
 */
export function whenOnline(refresh: () => void): () => void {
  return () => {
    if (isOffline()) showOfflineToast();
    else refresh();
  };
}

/** Copy for disabled writes while offline. */
export const OFFLINE_WRITE_MESSAGE = 'Brak połączenia z internetem';
