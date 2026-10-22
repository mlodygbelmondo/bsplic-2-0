import { queryClient } from '@/lib/query-client';
import type { FeedItemType, SocialComment, SocialFeedItem } from '@/types/database';
import {
  findFeedItem,
  mapFeedPages,
  mergeFeedItemIntoPages,
  feedItemKeys,
  mergeFreshFirstPage,
  SOCIAL_FEED_PAGE_SIZE,
  trimFeedToFirstPage,
  type FeedPages,
} from '../lib/feedList';
import { getFeedItemKey } from '../lib/routes';
import { socialKeys } from './keys';
import { fetchSocialFeed } from './social';

/**
 * Cache helpers shared by the feed, the item page and the comment thread.
 * A feed item can sit in the feed pages and in its item query at once; these
 * keep both (and every viewer key) in step, which replaces the web's per-page
 * `setFeedItems` updates.
 */

type ItemUpdater = (item: SocialFeedItem) => SocialFeedItem | null;

const matches = (item: SocialFeedItem, itemType: FeedItemType, itemId: string) =>
  item.id === itemId && item.item_type === itemType;

/** Updates one item in every feed and item query; returning null removes it. */
export function updateFeedItemEverywhere(itemType: FeedItemType, itemId: string, updater: ItemUpdater) {
  queryClient.setQueriesData<FeedPages>({ queryKey: socialKeys.feedRoot }, (data) =>
    data ? mapFeedPages(data, (item) => (matches(item, itemType, itemId) ? updater(item) : item)) : data,
  );
  queryClient.setQueriesData<SocialFeedItem | null>({ queryKey: socialKeys.itemAnyViewer(itemType, itemId) }, (item) =>
    item ? updater(item) : item,
  );
}

export function removeFeedItem(itemType: FeedItemType, itemId: string) {
  updateFeedItemEverywhere(itemType, itemId, () => null);
}

/** Puts a fresh copy of an item into the viewer's feed (prepending it when `allowInsert`) and item query. */
export function mergeFeedItem(userId: string | null | undefined, item: SocialFeedItem, allowInsert: boolean) {
  queryClient.setQueryData<FeedPages>(socialKeys.feed(userId), (data) =>
    data ? mergeFeedItemIntoPages(data, item, allowInsert) : data,
  );
  const itemKey = socialKeys.item(item.item_type, item.id, userId);
  if (queryClient.getQueryData(itemKey) !== undefined) {
    queryClient.setQueryData(itemKey, item);
  }
}

/** The cached copy of an item from the viewer's feed or item query. */
export function getCachedFeedItem(
  userId: string | null | undefined,
  itemType: FeedItemType,
  itemId: string,
): SocialFeedItem | undefined {
  const fromItem = queryClient.getQueryData<SocialFeedItem | null>(socialKeys.item(itemType, itemId, userId));
  if (fromItem) return fromItem;
  const feed = queryClient.getQueryData<FeedPages>(socialKeys.feed(userId));
  return findFeedItem(feed, getFeedItemKey({ item_type: itemType, id: itemId }));
}

export function isFeedItemLoaded(userId: string | null | undefined, itemType: FeedItemType, itemId: string) {
  const feed = queryClient.getQueryData<FeedPages>(socialKeys.feed(userId));
  return findFeedItem(feed, getFeedItemKey({ item_type: itemType, id: itemId })) !== undefined;
}

/**
 * Seeds the item query from the feed so the item page renders at once; its
 * own refresh then runs in the background. Call on press-in.
 */
export function seedSocialItem(item: SocialFeedItem, userId: string | null | undefined) {
  const key = socialKeys.item(item.item_type, item.id, userId);
  if (queryClient.getQueryData(key) !== undefined) return;
  const feedState = queryClient.getQueryState(socialKeys.feed(userId));
  queryClient.setQueryData(key, item, { updatedAt: feedState?.dataUpdatedAt });
}

// ── Feed pages ────────────────────────────────────────────────

/** Drops every page after the first (web caches and refreshes the first 50 items only). */
export function trimFeedCache(userId: string | null | undefined) {
  queryClient.setQueryData<FeedPages>(socialKeys.feed(userId), (data) => (data ? trimFeedToFirstPage(data) : data));
}

/**
 * Catches up after a realtime gap with one request: the fresh first page is
 * merged into the loaded pages (see `mergeFreshFirstPage`). Resolves with the
 * number of items that were not loaded before.
 */
export async function refreshFeedFirstPage(userId: string | null | undefined): Promise<number> {
  const key = socialKeys.feed(userId);
  // A page load in flight would write its pages over the merge when it lands: let it land first.
  const feedQuery = queryClient.getQueryCache().find<FeedPages>({ queryKey: key, exact: true });
  if (feedQuery?.state.fetchStatus === 'fetching') {
    await feedQuery.fetch(undefined, { cancelRefetch: false }).catch(() => undefined);
  }
  const atRequest = queryClient.getQueryData<FeedPages>(key);
  if (!atRequest) return 0;
  const loadedAtRequest = feedItemKeys(atRequest);
  const fresh = await fetchSocialFeed(SOCIAL_FEED_PAGE_SIZE, 0, userId);
  const previous = queryClient.getQueryData<FeedPages>(key);
  if (!previous) return 0;
  queryClient.setQueryData<FeedPages>(key, mergeFreshFirstPage(previous, fresh, loadedAtRequest));
  return fresh.filter((item) => findFeedItem(previous, getFeedItemKey(item)) === undefined).length;
}

// ── Comments ──────────────────────────────────────────────────

/** Updates one comment in every comments query that holds it. */
export function updateCommentEverywhere(commentId: string, updater: (comment: SocialComment) => SocialComment) {
  queryClient.setQueriesData<SocialComment[]>({ queryKey: socialKeys.commentsRoot }, (comments) => {
    if (!comments || !comments.some((comment) => comment.id === commentId)) return comments;
    return comments.map((comment) => (comment.id === commentId ? updater(comment) : comment));
  });
}

export function findCachedComment(commentId: string): SocialComment | undefined {
  for (const [, comments] of queryClient.getQueriesData<SocialComment[]>({ queryKey: socialKeys.commentsRoot })) {
    const found = comments?.find((comment) => comment.id === commentId);
    if (found) return found;
  }
  return undefined;
}

/** True while a screen shows this item's comments (an enabled observer with data). */
export function areCommentsShown(itemType: FeedItemType, itemId: string) {
  return queryClient
    .getQueryCache()
    .findAll({ queryKey: socialKeys.commentsAnyViewer(itemType, itemId) })
    .some((query) => query.isActive() && query.state.status === 'success');
}

/** Re-reads comments wherever they are shown (web `reloadComments`). */
export async function reloadComments(itemType: FeedItemType, itemId: string) {
  await queryClient.refetchQueries({ queryKey: socialKeys.commentsAnyViewer(itemType, itemId), type: 'active' });
}
