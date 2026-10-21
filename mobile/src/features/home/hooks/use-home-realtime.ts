import type { InfiniteData, QueryKey } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { useRealtimeChannel } from '@/lib/realtime';
import { BETS_QUERY_ROOT, criteriaFromQueryKey, type BetsPage } from '../api/bets';
import { CATEGORIES_QUERY_KEY } from '../api/categories';
import { applyBetsRealtimeToPages, type BetsRealtimePayload } from '../logic/bets-realtime';

const REALTIME_BATCH_MS = 150;
/** A query refreshed this recently is not refetched again after (re)subscribing. */
const FRESH_MS = 2_000;

/**
 * Live bet and category changes for the home list (web `useBets` and
 * `useCategories`). Bet payloads are batched every 150 ms and patched into
 * every cached home list, each with its own category and Aktywne criteria.
 */
export function useHomeRealtime(enabled: boolean, currentBetsKey: QueryKey) {
  const queryClient = useQueryClient();
  const queueRef = useRef<BetsRealtimePayload[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = null;
      queueRef.current = [];
    },
    [],
  );

  const flush = () => {
    timerRef.current = null;
    const payloads = queueRef.current;
    queueRef.current = [];
    if (payloads.length === 0) return;
    queryClient.getQueriesData<InfiniteData<BetsPage, number>>({ queryKey: BETS_QUERY_ROOT }).forEach(([key, data]) => {
      const criteria = criteriaFromQueryKey(key);
      if (!data || !criteria) return;
      const pages = applyBetsRealtimeToPages(data.pages, payloads, criteria.category, criteria.includeInProgress);
      if (pages !== data.pages) {
        queryClient.setQueryData<InfiniteData<BetsPage, number>>(key, { ...data, pages });
      }
    });
  };

  const refetchIfStale = (queryKey: QueryKey) => {
    const state = queryClient.getQueryState(queryKey);
    if (!state || state.fetchStatus === 'fetching' || Date.now() - state.dataUpdatedAt < FRESH_MS) return;
    void queryClient.refetchQueries({ queryKey, exact: true, type: 'active' });
  };

  useRealtimeChannel(
    'bets-realtime',
    (channel) =>
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'bets' }, (payload) => {
        queueRef.current.push(payload as BetsRealtimePayload);
        if (timerRef.current === null) {
          timerRef.current = setTimeout(flush, REALTIME_BATCH_MS);
        }
      }),
    { enabled, onSubscribed: () => refetchIfStale(currentBetsKey) },
  );

  useRealtimeChannel(
    'categories-changes',
    (channel) =>
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => {
        void queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
      }),
    { enabled, onSubscribed: () => refetchIfStale(CATEGORIES_QUERY_KEY) },
  );
}
