import { queryOptions } from '@tanstack/react-query';

import { PAGE_DATA_QUERY_OPTIONS } from '@/lib/query-client';
import type { RouletteRecentWin, RouletteTableRound } from '@/types/database';

import { getRouletteTableSnapshot } from './roulette';

export interface RouletteHistory {
  recentSpins: RouletteTableRound[];
  recentWins: RouletteRecentWin[];
}

/**
 * Past spins and wins (persisted). They show instantly when the table opens;
 * the live round never comes from here (web `rouletteSnapshotQuery`, which the
 * hook only reads for `recentSpins`/`recentWins`). Add to the signed-in boot
 * preload like the web `preload.ts`.
 */
export const rouletteHistoryQuery = () =>
  queryOptions({
    queryKey: ['casino', 'roulette', 'history'],
    queryFn: async (): Promise<RouletteHistory> => {
      const { recentSpins, recentWins } = await getRouletteTableSnapshot();
      return { recentSpins, recentWins };
    },
    ...PAGE_DATA_QUERY_OPTIONS,
  });

/**
 * Live table snapshot. The `roulette-live` root is never persisted; the hub
 * prefetches it on press-in so the table's first read can reuse a response
 * that is at most a couple of seconds old. Every later read bypasses it.
 */
export const LIVE_SNAPSHOT_MAX_AGE_MS = 2_000;

export const rouletteLiveSnapshotQuery = () =>
  queryOptions({
    queryKey: ['roulette-live', 'snapshot'],
    queryFn: () => getRouletteTableSnapshot(),
    staleTime: LIVE_SNAPSHOT_MAX_AGE_MS,
    gcTime: 30_000,
    retry: false,
  });
