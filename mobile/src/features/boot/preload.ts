import type { FetchQueryOptions, QueryKey } from '@tanstack/react-query';

import { blackjackSnapshotQuery } from '@/features/casino/blackjack/api/queries';
import { rouletteHistoryQuery } from '@/features/casino/roulette/api/queries';
import {
  casinoHistoryPreviewQueryOptions,
  profileBadgesQueryOptions,
  profileStatsQueryOptions,
  sportsbookHistoryPreviewQueryOptions,
} from '@/features/profile/api/profileQueries';
import { rankingsQuery } from '@/features/rankings/api/queries';
import { trimFeedCache } from '@/features/social/api/cache';
import { socialFeedQuery, socialStoriesQuery } from '@/features/social/api/queries';
import { isOffline } from '@/lib/connectivity';
import { queryClient } from '@/lib/query-client';

// Port of the web `prefetchPageData` (`src/lib/boot/preload.ts`): once the
// first screen has its data, fetch the first screen of every other section so
// opening it later renders instantly. Artwork ships in the app bundle, so
// there is no asset warm-up. The persisted cache already covers sections the
// player has seen before, so only missing sections are fetched, and only a
// sign-in with nothing cached waits for them.

const CRITICAL_TIMEOUT_MS = 3000;

interface PrefetchTask {
  queryKey: QueryKey;
  run: () => Promise<void>;
  /** Not awaited before the boot overlay lifts (never persisted, so it would delay every cold start). */
  background?: boolean;
}

function prefetch<TQueryFnData, TError, TData, TQueryKey extends QueryKey>(
  options: FetchQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
): PrefetchTask {
  return { queryKey: options.queryKey, run: () => queryClient.prefetchQuery(options) };
}

/** First screen of every main section, for the signed-in player. */
function getPageDataTasks(userId: string): PrefetchTask[] {
  const feed = socialFeedQuery(userId);
  return [
    {
      queryKey: feed.queryKey,
      // A persisted feed can hold several pages; refetch only the first, like the feed screen.
      run: () => {
        trimFeedCache(userId);
        return queryClient.prefetchInfiniteQuery(feed);
      },
    },
    prefetch(socialStoriesQuery()),
    prefetch(profileStatsQueryOptions(userId)),
    prefetch(profileBadgesQueryOptions(userId)),
    prefetch(sportsbookHistoryPreviewQueryOptions(userId)),
    prefetch(casinoHistoryPreviewQueryOptions(userId)),
    prefetch(rankingsQuery('sportsbook')),
    prefetch(rouletteHistoryQuery()),
    { ...prefetch(blackjackSnapshotQuery(userId)), background: true },
  ];
}

/**
 * Fetches the first screen of every section the cache does not have yet (the
 * screens refresh cached data themselves when opened). Right after sign-in,
 * with nothing cached, it resolves when done or after CRITICAL_TIMEOUT_MS so
 * the overlay can wait for it. With a restored cache every section can render
 * at once, so the gaps load in the background and it resolves right away.
 */
export function prefetchPageData(userId: string, onProgress: (fraction: number) => void): Promise<unknown> {
  // Offline nothing can load: the requests would only pause and hold the overlay for the whole budget.
  if (isOffline()) return Promise.resolve();
  const sections = getPageDataTasks(userId);
  const missing = sections.filter((task) => queryClient.getQueryData(task.queryKey) === undefined);
  const nothingCached = sections.every((task) => task.background || missing.includes(task));
  const tasks = nothingCached ? missing.filter((task) => !task.background) : [];
  for (const task of missing) {
    if (!tasks.includes(task)) {
      void task.run().catch((error: unknown) => console.warn('Boot preload task failed:', error));
    }
  }
  if (tasks.length === 0) return Promise.resolve();
  let settled = 0;
  const all = Promise.allSettled(
    tasks.map((task) =>
      task
        .run()
        .catch((error: unknown) => console.warn('Boot preload task failed:', error))
        .finally(() => {
          settled += 1;
          onProgress(settled / tasks.length);
        }),
    ),
  );
  const budget = new Promise<void>((resolve) => setTimeout(resolve, CRITICAL_TIMEOUT_MS));
  return Promise.race([all, budget]);
}
