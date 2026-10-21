import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';

import { PAGE_DATA_QUERY_OPTIONS } from '@/lib/query-client';
import type { FeedItemType } from '@/types/database';
import { flattenFeedPages, getNextFeedOffset, SOCIAL_FEED_PAGE_SIZE } from '../lib/feedList';
import { getSocialItemCommentsTarget, type ReactorsTarget } from '../lib/routes';
import { updateFeedItemEverywhere } from './cache';
import { socialKeys } from './keys';
import { fetchActiveSocialStories, fetchComments, fetchReactors, fetchSocialFeed, fetchSocialFeedItem } from './social';

export { socialKeys } from './keys';

/**
 * The feed as offset pages of 50. Page 0 is what the web caches; the feed
 * screen trims to it before refreshing, so a refresh is a single request.
 */
export const socialFeedQuery = (userId: string | null | undefined) =>
  infiniteQueryOptions({
    queryKey: socialKeys.feed(userId),
    queryFn: ({ pageParam }) => fetchSocialFeed(SOCIAL_FEED_PAGE_SIZE, pageParam, userId),
    initialPageParam: 0,
    getNextPageParam: getNextFeedOffset,
    select: flattenFeedPages,
    ...PAGE_DATA_QUERY_OPTIONS,
  });

export const socialStoriesQuery = () =>
  queryOptions({
    queryKey: socialKeys.stories,
    queryFn: fetchActiveSocialStories,
    ...PAGE_DATA_QUERY_OPTIONS,
  });

/** One feed item (`get_social_feed_item`); `null` = not found or not visible. Seed it from the feed with `seedSocialItem`. */
export const socialItemQuery = (itemType: FeedItemType, itemId: string, userId: string | null | undefined) =>
  queryOptions({
    queryKey: socialKeys.item(itemType, itemId, userId),
    queryFn: () => fetchSocialFeedItem(itemType, itemId, userId),
    ...PAGE_DATA_QUERY_OPTIONS,
  });

/**
 * Comments of one item. Like the web `loadComments`, a successful read also
 * sets the item's `comment_count` to the number of comments everywhere.
 */
export const socialCommentsQuery = (itemType: FeedItemType, itemId: string, userId: string | null | undefined) =>
  queryOptions({
    queryKey: socialKeys.comments(itemType, itemId, userId),
    queryFn: async () => {
      const comments = await fetchComments(getSocialItemCommentsTarget(itemType, itemId), userId);
      updateFeedItemEverywhere(itemType, itemId, (item) =>
        item.comment_count === comments.length ? item : { ...item, comment_count: comments.length },
      );
      return comments;
    },
    ...PAGE_DATA_QUERY_OPTIONS,
  });

export const reactorsQuery = (target: ReactorsTarget) =>
  queryOptions({
    queryKey: socialKeys.reactors(target),
    queryFn: () => fetchReactors(target),
    ...PAGE_DATA_QUERY_OPTIONS,
  });
