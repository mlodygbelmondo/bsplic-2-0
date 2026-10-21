import type { FeedItemType } from '@/types/database';
import { REACTION_TYPES, type ReactionCounts, type ReactionType } from './reactions';

export interface SocialItemTarget {
  postId?: string;
  couponId?: string;
  casinoShareId?: string;
}

/** Target for reactions/reactors: an item target or a comment. */
export interface ReactorsTarget extends SocialItemTarget {
  commentId?: string;
}

export function isFeedItemType(value: string | undefined | null): value is FeedItemType {
  return value === 'post' || value === 'coupon' || value === 'casino';
}

/** Web path of a social item (`/social/:itemType/:itemId`); also the native route. */
export function getSocialItemPath(itemType: FeedItemType, itemId: string): string {
  return `/social/${encodeURIComponent(itemType)}/${encodeURIComponent(itemId)}`;
}

export function getSocialItemCommentsTarget(itemType: FeedItemType, itemId: string): SocialItemTarget {
  if (itemType === 'post') return { postId: itemId };
  if (itemType === 'coupon') return { couponId: itemId };
  return { casinoShareId: itemId };
}

/** Stable list key, same as the web (`${item_type}-${id}`). */
export function getFeedItemKey(item: { item_type: FeedItemType; id: string }): string {
  return `${item.item_type}-${item.id}`;
}

/**
 * Reactors sheet tab to open first (web `onOpenItemReactors`): the first type
 * in `REACTION_TYPES` order that has reactions, not the most used one.
 */
export function getInitialReactorsEmoji(counts: ReactionCounts | null | undefined): ReactionType | null {
  if (!counts) return null;
  return REACTION_TYPES.find((type) => (counts[type] ?? 0) > 0) ?? null;
}

type RouteParam = string | string[] | undefined;

export type ReactorsRouteParams = {
  postId?: string;
  couponId?: string;
  casinoShareId?: string;
  commentId?: string;
  initial?: ReactionType;
};

/** Params of `/sheets/reactors` for a target; absent ids are left out. */
export function getReactorsRouteParams(target: ReactorsTarget, initial: ReactionType | null): ReactorsRouteParams {
  const params: ReactorsRouteParams = {};
  if (target.postId) params.postId = target.postId;
  if (target.couponId) params.couponId = target.couponId;
  if (target.casinoShareId) params.casinoShareId = target.casinoShareId;
  if (target.commentId) params.commentId = target.commentId;
  if (initial) params.initial = initial;
  return params;
}

const firstParam = (value: RouteParam) => (Array.isArray(value) ? value[0] : value) || undefined;

/** Reads `/sheets/reactors` params back; null when no target id is present. */
export function parseReactorsRouteParams(params: Record<string, RouteParam>): {
  target: ReactorsTarget;
  initial: ReactionType | null;
} | null {
  const target: ReactorsTarget = {
    postId: firstParam(params.postId),
    couponId: firstParam(params.couponId),
    casinoShareId: firstParam(params.casinoShareId),
    commentId: firstParam(params.commentId),
  };
  if (!target.postId && !target.couponId && !target.casinoShareId && !target.commentId) return null;
  const initial = firstParam(params.initial);
  return {
    target,
    initial: initial && (REACTION_TYPES as readonly string[]).includes(initial) ? (initial as ReactionType) : null,
  };
}
