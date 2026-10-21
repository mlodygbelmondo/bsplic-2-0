import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { getErrorMessage } from '@/lib/errors';
import { toast } from '@/lib/toast';
import { trimFeedCache } from '../api/cache';
import { socialFeedQuery } from '../api/queries';
import { filterFeedItems, type FeedFilter } from '../lib/feedList';

/**
 * Feed paging for the Social tab (web `SocialPage` `loadFeed`/`loadMoreFeed`).
 * Like the web, only the first 50 items are cached between visits: the cache
 * is trimmed before the query mounts, so the background refresh is one read.
 */
export function useSocialFeed(userId: string | null, filter: FeedFilter) {
  useState(() => {
    trimFeedCache(userId);
    return null;
  });
  const query = useInfiniteQuery(socialFeedQuery(userId));
  const [refreshing, setRefreshing] = useState(false);

  const items = query.data;
  const filteredItems = items ? filterFeedItems(items, filter) : undefined;
  const hasMore = query.hasNextPage;
  const busy = query.isFetching;

  const loadMore = () => {
    if (!hasMore || busy || !items) return;
    void query.fetchNextPage().then((result) => {
      if (result.isFetchNextPageError) {
        toast.error(getErrorMessage(result.error, 'Nie udało się załadować kolejnych wpisów'));
      }
    });
  };

  // A filter with no matches keeps paging until it finds one or the feed ends.
  const filteredEmpty = items !== undefined && items.length > 0 && filteredItems?.length === 0;
  const shouldAutoLoad = filteredEmpty && hasMore && !busy && !query.isFetchNextPageError;
  const { fetchNextPage } = query;
  useEffect(() => {
    if (shouldAutoLoad) void fetchNextPage();
  }, [shouldAutoLoad, fetchNextPage]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      trimFeedCache(userId);
      const result = await query.refetch();
      if (result.isError) toast.error(getErrorMessage(result.error, 'Nie udało się odświeżyć aktywności'));
    } finally {
      setRefreshing(false);
    }
  };

  return {
    items,
    filteredItems,
    error: query.error,
    isPending: query.isPending,
    hasMore,
    loadingMore: query.isFetchingNextPage,
    refreshing,
    loadMore,
    refresh,
    retry: () => void query.refetch(),
  };
}
