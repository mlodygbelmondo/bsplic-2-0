import type { Query } from '@tanstack/react-query';
import type { PersistedClient } from '@tanstack/react-query-persist-client';

/**
 * Queries whose key starts with one of these are never persisted: admin data,
 * live casino rounds and in-progress games must always load fresh (web rule).
 */
export const NON_PERSISTED_QUERY_ROOTS = new Set<string>([
  // Admin actions settle real bets: never act on a list restored from disk.
  'admin',
  'roulette-live',
  'blackjack-live',
  'jackpot-live',
  'slots-live',
]);

/** Every query with data is saved, including one whose latest background refresh failed. */
export function shouldPersistQuery(query: Query): boolean {
  return query.state.data !== undefined && !NON_PERSISTED_QUERY_ROOTS.has(String(query.queryKey[0]));
}

/**
 * A failed background refresh keeps the last good data on screen; save that
 * data as a success, so restarting the app during an outage still starts from it.
 */
export function serializeQueryCache(client: PersistedClient): string {
  const queries = client.clientState.queries.map((query) =>
    query.state.status === 'error'
      ? {
          ...query,
          state: { ...query.state, status: 'success' as const, error: null, fetchFailureCount: 0, fetchFailureReason: null },
        }
      : query,
  );
  return JSON.stringify({ ...client, clientState: { ...client.clientState, queries } });
}
