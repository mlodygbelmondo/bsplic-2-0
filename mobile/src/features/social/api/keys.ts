import type { FeedItemType } from '@/types/database';
import type { ReactorsTarget } from '../lib/routes';

/**
 * Query keys of the Social feature. Everything lives under
 * `['social', …]`; reactions in feed, item and comment payloads are per viewer,
 * so those keys end with the viewer id.
 */
export const socialKeys = {
  all: ['social'] as const,
  feedRoot: ['social', 'feed'] as const,
  feed: (userId: string | null | undefined) => ['social', 'feed', userId ?? null] as const,
  stories: ['social', 'stories'] as const,
  itemRoot: ['social', 'item'] as const,
  itemAnyViewer: (itemType: FeedItemType, itemId: string) => ['social', 'item', itemType, itemId] as const,
  item: (itemType: FeedItemType, itemId: string, userId: string | null | undefined) =>
    ['social', 'item', itemType, itemId, userId ?? null] as const,
  commentsRoot: ['social', 'comments'] as const,
  commentsAnyViewer: (itemType: FeedItemType, itemId: string) => ['social', 'comments', itemType, itemId] as const,
  comments: (itemType: FeedItemType, itemId: string, userId: string | null | undefined) =>
    ['social', 'comments', itemType, itemId, userId ?? null] as const,
  reactors: (target: ReactorsTarget) =>
    [
      'social',
      'reactors',
      target.postId ?? null,
      target.couponId ?? null,
      target.casinoShareId ?? null,
      target.commentId ?? null,
    ] as const,
};
