import { describe, expect, it } from 'vitest';

import {
  filterFeedItems,
  flattenFeedPages,
  getNextFeedOffset,
  getStoryProfiles,
  isAkoItem,
  mapFeedPages,
  mergeFeedItemIntoPages,
  mergeFreshFirstPage,
  parseFeedFilter,
  trimFeedToFirstPage,
  type FeedPages,
} from './feedList';
import { makeCasinoFeedItem, makeCouponFeedItem, makePostFeedItem, makePostPage } from './testFactories';

const pages = (...list: ReturnType<typeof makePostPage>[]): FeedPages => ({
  pages: list,
  pageParams: list.map((_, index) => index * 50),
});

describe('parseFeedFilter', () => {
  it('accepts the three filters and treats anything else as all', () => {
    expect(parseFeedFilter('coupon')).toBe('coupon');
    expect(parseFeedFilter('post')).toBe('post');
    expect(parseFeedFilter('casino')).toBe('casino');
    expect(parseFeedFilter('story')).toBe('all');
    expect(parseFeedFilter(undefined)).toBe('all');
  });
});

describe('filterFeedItems', () => {
  it('keeps only the selected item type', () => {
    const items = [makePostFeedItem(), makeCouponFeedItem(), makeCasinoFeedItem()];
    expect(filterFeedItems(items, 'coupon').map((item) => item.id)).toEqual(['coupon-1']);
    expect(filterFeedItems(items, 'all')).toHaveLength(3);
  });
});

describe('flattenFeedPages', () => {
  it('drops a repeated item when offset paging shifted between pages', () => {
    const first = makePostPage(50, 0);
    const second = [first[49], ...makePostPage(2, 50)];
    const flat = flattenFeedPages(pages(first, second));
    expect(flat).toHaveLength(52);
    expect(flat.filter((item) => item.id === 'post-49')).toHaveLength(1);
  });

  it('keeps posts and coupons that share an id apart', () => {
    const flat = flattenFeedPages(
      pages([makePostFeedItem({ id: 'x' })], [makeCouponFeedItem({ id: 'x' })]),
    );
    expect(flat).toHaveLength(2);
  });
});

describe('getNextFeedOffset', () => {
  it('stops after a short page', () => {
    expect(getNextFeedOffset(makePostPage(12), [makePostPage(50), makePostPage(12)])).toBeUndefined();
  });

  it('counts prepended realtime items in the next offset', () => {
    const first = [makePostFeedItem({ id: 'new' }), ...makePostPage(50)];
    expect(getNextFeedOffset(first, [first])).toBe(51);
  });
});

describe('mergeFeedItemIntoPages', () => {
  it('replaces a loaded item in place', () => {
    const data = pages(makePostPage(3));
    const updated = makePostFeedItem({ id: 'post-1', content: 'Nowa treść' });
    const merged = mergeFeedItemIntoPages(data, updated, false);
    expect(merged.pages[0][1].content).toBe('Nowa treść');
    expect(merged.pages[0]).toHaveLength(3);
  });

  it('prepends a new item only when inserts are allowed', () => {
    const data = pages(makePostPage(2));
    const fresh = makePostFeedItem({ id: 'fresh' });
    expect(mergeFeedItemIntoPages(data, fresh, false)).toBe(data);
    expect(mergeFeedItemIntoPages(data, fresh, true).pages[0][0].id).toBe('fresh');
  });
});

describe('mapFeedPages', () => {
  it('removes items mapped to null and keeps untouched pages', () => {
    const data = pages(makePostPage(2, 0), makePostPage(2, 2));
    const next = mapFeedPages(data, (item) => (item.id === 'post-3' ? null : item));
    expect(next.pages[0]).toBe(data.pages[0]);
    expect(next.pages[1].map((item) => item.id)).toEqual(['post-2']);
  });

  it('returns the same object when nothing changes', () => {
    const data = pages(makePostPage(2));
    expect(mapFeedPages(data, (item) => item)).toBe(data);
  });
});

describe('mergeFreshFirstPage', () => {
  it('puts new items on top and updates loaded ones without dropping later pages', () => {
    const data = pages(makePostPage(50, 0), makePostPage(50, 50));
    const fresh = [
      makePostFeedItem({ id: 'new-1' }),
      makePostFeedItem({ id: 'new-2' }),
      makePostFeedItem({ id: 'post-0', content: 'Edytowany' }),
      ...makePostPage(47, 1),
    ];

    const merged = mergeFreshFirstPage(data, fresh);

    expect(merged.pages).toHaveLength(2);
    expect(merged.pages[0].slice(0, 3).map((item) => item.id)).toEqual(['new-1', 'new-2', 'post-0']);
    expect(merged.pages[0][2].content).toBe('Edytowany');
    // Items pushed below the fresh page (post-48, post-49) stay in the list.
    expect(merged.pages[0].map((item) => item.id)).toContain('post-49');
    expect(merged.pages[1]).toBe(data.pages[1]);
  });

  it('drops loaded items the fresh page no longer holds above its last known item', () => {
    const data = pages(makePostPage(50, 0), makePostPage(50, 50));
    // post-3 was deleted during the gap; post-49 was pushed below the fresh page by the new items.
    const fresh = [
      makePostFeedItem({ id: 'new-1' }),
      makePostFeedItem({ id: 'new-2' }),
      ...makePostPage(3, 0),
      ...makePostPage(45, 4),
    ];

    const ids = mergeFreshFirstPage(data, fresh).pages.flat().map((item) => item.id);

    expect(ids).not.toContain('post-3');
    expect(ids).toContain('post-49');
    expect(ids).toHaveLength(101);
  });

  it('replaces a single loaded page with the fresh one', () => {
    const fresh = [makePostFeedItem({ id: 'new-1' }), ...makePostPage(1, 1)];
    const merged = mergeFreshFirstPage(pages(makePostPage(3)), fresh);
    expect(merged.pages).toEqual([fresh]);
    expect(merged.pageParams).toEqual([0]);
  });

  it('starts over from the fresh page when it shares no item with the loaded pages', () => {
    const fresh = makePostPage(50, 200);
    const merged = mergeFreshFirstPage(pages(makePostPage(50, 0), makePostPage(50, 50)), fresh);
    expect(merged.pages).toEqual([fresh]);
    expect(merged.pageParams).toEqual([0]);
  });
});

describe('first page helpers', () => {
  it('trims to the first page', () => {
    const trimmed = trimFeedToFirstPage(pages(makePostPage(50), makePostPage(50, 50)));
    expect(trimmed.pages).toHaveLength(1);
    expect(trimmed.pageParams).toEqual([0]);
  });
});

describe('isAkoItem', () => {
  it('is true only for coupons with more than one leg', () => {
    const leg = makeCouponFeedItem().legs![0];
    expect(isAkoItem(makeCouponFeedItem())).toBe(false);
    expect(isAkoItem(makeCouponFeedItem({ legs: [leg, { ...leg, id: 'leg-2' }] }))).toBe(true);
    expect(isAkoItem(makePostFeedItem())).toBe(false);
  });
});

describe('getStoryProfiles', () => {
  it('lists distinct authors in feed order, at most eight', () => {
    const items = Array.from({ length: 12 }, (_, index) =>
      makePostFeedItem({ id: `p${index}`, user_id: `u${index % 10}`, username: `U${index % 10}` }),
    );
    const profiles = getStoryProfiles(items);
    expect(profiles).toHaveLength(8);
    expect(profiles[0]).toEqual({ userId: 'u0', username: 'U0', avatarUrl: null });
  });
});
