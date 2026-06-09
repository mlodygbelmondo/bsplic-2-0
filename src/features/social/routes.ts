import type { FeedItemType } from '@/types/database';

export function isFeedItemType(value: string | undefined): value is FeedItemType {
  return value === 'post' || value === 'coupon' || value === 'casino';
}

export function getSocialItemPath(
  itemType: FeedItemType,
  itemId: string,
): string {
  return `/social/${encodeURIComponent(itemType)}/${encodeURIComponent(itemId)}`;
}

export function getSocialItemCommentsTarget(
  itemType: FeedItemType,
  itemId: string,
) {
  if (itemType === 'post') return { postId: itemId };
  if (itemType === 'coupon') return { couponId: itemId };
  return { casinoShareId: itemId };
}
