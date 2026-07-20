import {
  dehydrate,
  focusManager,
  hydrate,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import AsyncStorage from 'expo-sqlite/kv-store';
import {
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';

const QUERY_CACHE_KEY = 'bsplic.mobile.query-cache';
const QUERY_CACHE_BUSTER = 'v1';
const QUERY_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1_000;
const QUERY_CACHE_WRITE_DELAY_MS = 1_000;

interface PersistedQueryCache {
  buster: string;
  persistedAt: number;
  state: unknown;
}
export interface QueryCacheStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: QUERY_CACHE_MAX_AGE_MS,
      staleTime: 2 * 60 * 1_000,
      retry: 1,
      refetchOnReconnect: true,
      networkMode: 'offlineFirst',
    },
    mutations: {
      // Writes execute once and fail normally while offline; React Query must
      // never pause and replay financial, wagering, casino, or admin actions.
      networkMode: 'always',
      retry: false,
    },
  },
});

const restoreQueryCache = async (
  client: QueryClient,
  storage: QueryCacheStorage,
): Promise<void> => {
  const serialized = await storage.getItem(QUERY_CACHE_KEY);
  if (!serialized) return;

  const cached = JSON.parse(serialized) as PersistedQueryCache;
  const expired = Date.now() - cached.persistedAt > QUERY_CACHE_MAX_AGE_MS;
  if (cached.buster !== QUERY_CACHE_BUSTER || expired) {
    await storage.removeItem(QUERY_CACHE_KEY);
    return;
  }

  hydrate(client, cached.state);
};

const persistQueryCache = async (
  client: QueryClient,
  storage: QueryCacheStorage,
): Promise<void> => {
  const state = dehydrate(client, {
    shouldDehydrateMutation: () => false,
    shouldDehydrateQuery: (query) =>
      query.state.status === 'success' && query.meta?.persist !== false,
  });
  const cached: PersistedQueryCache = {
    buster: QUERY_CACHE_BUSTER,
    persistedAt: Date.now(),
    state,
  };
  await storage.setItem(QUERY_CACHE_KEY, JSON.stringify(cached));
};

export const clearPersistedQueryCache = async (
  storage: QueryCacheStorage = AsyncStorage,
): Promise<void> => {
  queryClient.clear();
  await storage.removeItem(QUERY_CACHE_KEY);
};

interface QueryProviderProps {
  children: ReactNode;
  client?: QueryClient;
  storage?: QueryCacheStorage;
}

export function QueryProvider({
  children,
  client = queryClient,
  storage = AsyncStorage,
}: QueryProviderProps) {
  const [isRestored, setIsRestored] = useState(false);
  const writeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    focusManager.setFocused(AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', (state) => {
      focusManager.setFocused(state === 'active');
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let disposed = false;
    let unsubscribe: (() => void) | undefined;

    void restoreQueryCache(client, storage)
      .catch(async (error: unknown) => {
        console.error('Failed to restore the persisted query cache:', error);
        try {
          await storage.removeItem(QUERY_CACHE_KEY);
        } catch (removeError: unknown) {
          console.error('Failed to remove the invalid query cache:', removeError);
        }
      })
      .finally(() => {
        if (disposed) return;

        setIsRestored(true);
        unsubscribe = client.getQueryCache().subscribe(() => {
          if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
          writeTimerRef.current = setTimeout(() => {
            writeTimerRef.current = null;
            void persistQueryCache(client, storage).catch((error: unknown) => {
              console.error('Failed to persist the query cache:', error);
            });
          }, QUERY_CACHE_WRITE_DELAY_MS);
        });
      });

    return () => {
      disposed = true;
      unsubscribe?.();
      if (writeTimerRef.current) {
        clearTimeout(writeTimerRef.current);
        writeTimerRef.current = null;
      }
    };
  }, [client, storage]);

  if (!isRestored) return null;

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
