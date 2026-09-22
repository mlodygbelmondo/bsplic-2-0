import { queryOptions } from '@tanstack/react-query';
import {
  fetchActiveSocialStories,
  fetchSocialFeed,
} from '@/features/social/api/social';
import { PAGE_DATA_QUERY_OPTIONS } from '@/lib/query-client';

export const SOCIAL_FEED_PAGE_SIZE = 50;

/** First page of the social feed; reactions in it are per viewer. */
export const socialFeedQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ['social', 'feed', userId ?? null],
    queryFn: () => fetchSocialFeed(SOCIAL_FEED_PAGE_SIZE, 0, userId),
    ...PAGE_DATA_QUERY_OPTIONS,
  });

export const socialStoriesQuery = () =>
  queryOptions({
    queryKey: ['social', 'stories'],
    queryFn: fetchActiveSocialStories,
    ...PAGE_DATA_QUERY_OPTIONS,
  });
