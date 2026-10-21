import { useNetInfo } from '@react-native-community/netinfo';

/** True when the device is known to be offline (unknown counts as online). */
export function useIsOffline(): boolean {
  const { isConnected, isInternetReachable } = useNetInfo();
  return isConnected === false || isInternetReachable === false;
}

/** Copy for disabled writes while offline. */
export const OFFLINE_WRITE_MESSAGE = 'Brak połączenia z internetem';
