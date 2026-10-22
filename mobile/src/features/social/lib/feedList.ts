import type { InfiniteData } from '@tanstack/react-query';

import type { SocialFeedItem } from '@/types/database';
import { getFeedItemKey } from './routes';

/** Page size of `get_social_feed` (web `SOCIAL_FEED_PAGE_SIZE`; the RPC default is 30). */
export const SOCIAL_FEED_PAGE_SIZE = 50;

export type FeedPages = InfiniteData<SocialFeedItem[], number>;

export type FeedFilter = 'all' | 'coupon' | 'post' | 'casino';

export const FEED_FILTERS: { value: FeedFilter; label: string }[] = [
  { value: 'all', label: 'Wszystko' },
  { value: 'coupon', label: 'Kupony' },
  { value: 'post', label: 'Posty' },
  { value: 'casino', label: 'Kasyno' },
];

export const FILTER_EMPTY_TITLES: Record<Exclude<FeedFilter, 'all'>, string> = {
  coupon: 'Brak kuponów w tej chwili',
  post: 'Brak postów w tej chwili',
  casino: 'Brak aktywności kasyna w tej chwili',
};

export function parseFeedFilter(value: string | string[] | null | undefined): FeedFilter {
  return value === 'coupon' || value === 'post' || value === 'casino' ? value : 'all';
}

export function filterFeedItems(items: SocialFeedItem[], filter: FeedFilter): SocialFeedItem[] {
  if (filter === 'all') return items;
  return items.filter((item) => item.item_type === filter);
}

/** All loaded pages as one list. Offset paging can repeat an item across pages; the first copy wins. */
export function flattenFeedPages(data: FeedPages): SocialFeedItem[] {
  if (data.pages.length === 1) return data.pages[0];
  const seen = new Set<string>();
  const items: SocialFeedItem[] = [];
  for (const page of data.pages) {
    for (const item of page) {
      const key = getFeedItemKey(item);
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }
  }
  return items;
}

/**
 * Offset of the next page: everything loaded so far, including items that
 * realtime prepended (they pushed older rows down on the server too).
 */
export function getNextFeedOffset(lastPage: SocialFeedItem[], allPages: SocialFeedItem[][]): number | undefined {
  if (lastPage.length < SOCIAL_FEED_PAGE_SIZE) return undefined;
  return allPages.reduce((total, page) => total + page.length, 0);
}

/** Maps every loaded item; returning null removes it. Pages that do not change keep their identity. */
export function mapFeedPages(
  data: FeedPages,
  map: (item: SocialFeedItem) => SocialFeedItem | null,
): FeedPages {
  let changed = false;
  const pages = data.pages.map((page) => {
    let pageChanged = false;
    const next: SocialFeedItem[] = [];
    for (const item of page) {
      const mapped = map(item);
      if (mapped !== item) pageChanged = true;
      if (mapped) next.push(mapped);
    }
    if (!pageChanged) return page;
    changed = true;
    return next;
  });
  return changed ? { ...data, pages } : data;
}

/** Replaces a loaded item in place, or prepends it when `allowInsert` (web `mergeFeedItem`). */
export function mergeFeedItemIntoPages(data: FeedPages, nextItem: SocialFeedItem, allowInsert: boolean): FeedPages {
  const key = getFeedItemKey(nextItem);
  const exists = data.pages.some((page) => page.some((item) => getFeedItemKey(item) === key));
  if (exists) {
    return mapFeedPages(data, (item) => (getFeedItemKey(item) === key ? nextItem : item));
  }
  if (!allowInsert) return data;
  const [first = [], ...rest] = data.pages;
  return { ...data, pages: [[nextItem, ...first], ...rest] };
}

export function feedItemKeys(data: FeedPages): Set<string> {
  return new Set(data.pages.flatMap((page) => page.map(getFeedItemKey)));
}

/**
 * Merges a freshly read first page into the loaded pages after a realtime gap,
 * so catching up is one request however far the user scrolled. Loaded items
 * take their fresh copy and new ones go on top in feed order. Items that were
 * loaded when the request started and are missing from the fresh page were
 * removed if they sat above the last item it still holds (anywhere, when the
 * fresh page is the whole feed); items that arrived during the request stay.
 * Without any overlap (more new items than a page) the fresh page replaces
 * everything, since the items between would be missing.
 */
export function mergeFreshFirstPage(
  data: FeedPages,
  fresh: SocialFeedItem[],
  loadedAtRequest: ReadonlySet<string>,
): FeedPages {
  const freshByKey = new Map(fresh.map((item) => [getFeedItemKey(item), item]));
  const loadedKeys = data.pages.flatMap((page) => page.map(getFeedItemKey));
  const loaded = new Set(loadedKeys);
  const added = fresh.filter((item) => !loaded.has(getFeedItemKey(item)));
  const complete = fresh.length < SOCIAL_FEED_PAGE_SIZE;
  if (!complete && added.length === fresh.length) {
    return { pages: [fresh], pageParams: data.pageParams.slice(0, 1) };
  }
  let lastCovered = loadedKeys.length;
  if (!complete) {
    lastCovered -= 1;
    while (lastCovered >= 0 && !freshByKey.has(loadedKeys[lastCovered])) lastCovered -= 1;
  }
  let position = -1;
  const updated = mapFeedPages(data, (item) => {
    position += 1;
    const key = getFeedItemKey(item);
    const freshItem = freshByKey.get(key);
    if (freshItem) return freshItem;
    return position < lastCovered && loadedAtRequest.has(key) ? null : item;
  });
  if (added.length === 0) return updated;
  const [first, ...rest] = updated.pages;
  return { ...updated, pages: [[...added, ...first], ...rest] };
}

/** Keeps only the first page (the web caches and refreshes just the first 50 items). */
export function trimFeedToFirstPage(data: FeedPages): FeedPages {
  if (data.pages.length <= 1) return data;
  return { pages: data.pages.slice(0, 1), pageParams: data.pageParams.slice(0, 1) };
}

export function findFeedItem(data: FeedPages | undefined, key: string): SocialFeedItem | undefined {
  if (!data) return undefined;
  for (const page of data.pages) {
    const found = page.find((item) => getFeedItemKey(item) === key);
    if (found) return found;
  }
  return undefined;
}

export function isAkoItem(item: SocialFeedItem): boolean {
  return item.item_type === 'coupon' && item.legs !== null && item.legs.length > 1;
}

export interface SocialStoryProfile {
  userId: string;
  username: string;
  avatarUrl: string | null;
}

/** Up to eight distinct authors, in feed order, for the stories strip fallback tiles. */
export function getStoryProfiles(items: SocialFeedItem[]): SocialStoryProfile[] {
  const seen = new Set<string>();
  const profiles: SocialStoryProfile[] = [];
  for (const item of items) {
    if (seen.has(item.user_id)) continue;
    seen.add(item.user_id);
    profiles.push({ userId: item.user_id, username: item.username, avatarUrl: item.avatar_url ?? null });
    if (profiles.length >= 8) break;
  }
  return profiles;
}
