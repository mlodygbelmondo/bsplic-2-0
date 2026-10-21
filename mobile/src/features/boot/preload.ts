import type { FetchQueryOptions, QueryKey } from '@tanstack/react-query';

import { blackjackSnapshotQuery } from '@/features/casino/blackjack/api/queries';
import {
  casinoHistoryPreviewQueryOptions,
  profileBadgesQueryOptions,
  profileStatsQueryOptions,
  sportsbookHistoryPreviewQueryOptions,
} from '@/features/profile/api/profileQueries';
import { rankingsQuery } from '@/features/rankings/api/queries';
import { trimFeedCache } from '@/features/social/api/cache';
import { socialFeedQuery, socialStoriesQuery } from '@/features/social/api/queries';
import { queryClient } from '@/lib/query-client';

// Port of the web `prefetchPageData` (`src/lib/boot/preload.ts`): once the
// first screen has its data, fetch the first screen of every other section so
// opening it later renders instantly. Artwork ships in the app bundle, so
// there is no asset warm-up. The persisted cache already covers sections the
// player has seen before; the overlay only waits when something is missing.

const CRITICAL_TIMEOUT_MS = 3000;

interface PrefetchTask {
  queryKey: QueryKey;
  run: () => Promise<void>;
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
    prefetch(blackjackSnapshotQuery(userId)),
  ];
}

/**
 * Fetches the first screen of every section for this player. Resolves right
 * away when everything is already cached (the fetches continue in the
 * background), otherwise when done or after CRITICAL_TIMEOUT_MS.
 */
export function prefetchPageData(userId: string, onProgress: (fraction: number) => void): Promise<unknown> {
  const tasks = getPageDataTasks(userId);
  const missing = tasks.some((task) => queryClient.getQueryData(task.queryKey) === undefined);
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
  if (!missing) return Promise.resolve();
  const budget = new Promise<void>((resolve) => setTimeout(resolve, CRITICAL_TIMEOUT_MS));
  return Promise.race([all, budget]);
}
