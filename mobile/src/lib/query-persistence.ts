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
  // The poll and bonus dialogs open only on fresh data: a restored poll may already be answered.
  'feature-polls',
  'bonus-campaigns',
]);

/** Persisted entries older than this are dropped (restore also rejects a save older than this). */
export const PERSIST_MAX_AGE = 24 * 60 * 60_000;

/**
 * Every query with data from the last day is saved, including one whose latest
 * background refresh failed. The age check keeps per-item entries (profiles,
 * threads, items) from piling up across days: restoring gives each entry a fresh
 * `gcTime`, so without it anything loaded once would survive every daily launch.
 */
export function shouldPersistQuery(query: Query): boolean {
  return (
    query.state.data !== undefined &&
    Date.now() - query.state.dataUpdatedAt < PERSIST_MAX_AGE &&
    !NON_PERSISTED_QUERY_ROOTS.has(String(query.queryKey[0]))
  );
}

type PersistedQueries = PersistedClient['clientState']['queries'];

/**
 * True when the queries to save differ from the last save: an entry was added or
 * removed or its data changed. Live-only updates (roulette rounds, refetches that
 * return the same data) then skip the full rewrite.
 */
export function persistedQueriesChanged(previous: PersistedQueries, next: PersistedQueries): boolean {
  if (previous.length !== next.length) return true;
  return next.some(
    (query, index) => query.queryHash !== previous[index].queryHash || query.state.data !== previous[index].state.data,
  );
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
          state: {
            ...query.state,
            status: 'success' as const,
            error: null,
            errorUpdatedAt: 0,
            errorUpdateCount: 0,
            fetchFailureCount: 0,
            fetchFailureReason: null,
          },
        }
      : query,
  );
  return JSON.stringify({ ...client, clientState: { ...client.clientState, queries } });
}
