import NetInfo, {
  type NetInfoState,
  type NetInfoStateType,
} from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export type OfflineReason =
  | 'checking'
  | 'no-connection'
  | 'internet-unreachable'
  | null;

export interface NetworkContextValue {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  isOnline: boolean | null;
  canPerformWrites: boolean;
  connectionType: NetInfoStateType;
  isConnectionExpensive: boolean | null;
  offlineReason: OfflineReason;
  refresh: () => Promise<void>;
}

const NetworkContext = createContext<NetworkContextValue | undefined>(
  undefined,
);

const resolveOnline = (state: NetInfoState): boolean | null => {
  if (state.isConnected === false) return false;
  if (state.isInternetReachable === false) return false;
  if (state.isInternetReachable === true) return true;
  return null;
};
const resolveOfflineReason = (state: NetInfoState | null): OfflineReason => {
  if (!state || state.isConnected === null) return 'checking';
  if (state.isConnected === false) return 'no-connection';
  if (state.isInternetReachable === false) return 'internet-unreachable';
  return null;
};

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [networkState, setNetworkState] = useState<NetInfoState | null>(null);

  useEffect(
    () =>
      NetInfo.addEventListener((nextState) => {
        setNetworkState(nextState);
        // Treat an indeterminate reachability result as online until NetInfo
        // has evidence otherwise. Writes remain disabled while fully unknown.
        onlineManager.setOnline(resolveOnline(nextState) !== false);
      }),
    [],
  );

  const refresh = useCallback(async (): Promise<void> => {
    const nextState = await NetInfo.refresh();
    setNetworkState(nextState);
    onlineManager.setOnline(resolveOnline(nextState) !== false);
  }, []);

  const value = useMemo<NetworkContextValue>(() => {
    const isOnline = networkState ? resolveOnline(networkState) : null;
    const details = networkState?.details;

    return {
      isConnected: networkState?.isConnected ?? null,
      isInternetReachable: networkState?.isInternetReachable ?? null,
      isOnline,
      canPerformWrites: isOnline === true,
      connectionType: networkState?.type ?? ('unknown' as NetInfoStateType),
      isConnectionExpensive:
        details && 'isConnectionExpensive' in details
          ? details.isConnectionExpensive
          : null,
      offlineReason: resolveOfflineReason(networkState),
      refresh,
    };
  }, [networkState, refresh]);

  return (
    <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
  );
}

export const useNetwork = (): NetworkContextValue => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within NetworkProvider');
  }
  return context;
};
