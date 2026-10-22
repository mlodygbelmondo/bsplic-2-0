import { queryOptions } from '@tanstack/react-query';

import type { DailyJackpotSnapshot } from '../types';
import { getDailyJackpotDraw } from './jackpot';

/** Card state. Persisted, so a cold start shows the card at once; the countdown uses `receivedAt`.
 * Per user: the snapshot holds the player's tickets. */
export const JACKPOT_STATE_QUERY_ROOT = ['jackpot', 'state'] as const;
export const jackpotStateQueryKey = (userId: string | null) => [...JACKPOT_STATE_QUERY_ROOT, userId] as const;

export interface JackpotStateEntry {
  snapshot: DailyJackpotSnapshot;
  /** Local `Date.now()` when the snapshot arrived; `serverNow` plus elapsed time drives the countdown. */
  receivedAt: number;
}

/** Live draw: under the non-persisted `jackpot-live` root and dropped when the screen closes. */
export const jackpotDrawQueryKey = (poolId: string) => ['jackpot-live', 'draw', poolId] as const;

export const jackpotDrawQueryOptions = (poolId: string) =>
  queryOptions({
    queryKey: jackpotDrawQueryKey(poolId),
    queryFn: () => getDailyJackpotDraw(poolId),
    // A press-in prefetch is reused when the screen opens right after it.
    staleTime: 5_000,
    gcTime: 30_000,
    retry: false,
  });
