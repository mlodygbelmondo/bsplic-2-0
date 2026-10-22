import { describe, expect, it } from 'vitest';

import { collectVisibleRouteKeys } from './visible-routes';

const tabs = (index: number) => ({
  index,
  routes: [
    { key: 'home', name: 'index' },
    { key: 'social', name: 'social' },
  ],
});

describe('collectVisibleRouteKeys', () => {
  it('keeps the selected tab visible under a sheet', () => {
    const keys = collectVisibleRouteKeys({
      index: 1,
      routes: [
        { key: 'tabs', name: '(tabs)', state: tabs(0) },
        { key: 'coupon', name: 'sheets/coupon' },
      ],
    });
    expect([...keys].sort()).toEqual(['coupon', 'home', 'tabs']);
  });

  it('hides the tabs under a pushed screen and under a full-screen story', () => {
    const pushed = collectVisibleRouteKeys({
      index: 1,
      routes: [
        { key: 'tabs', name: '(tabs)', state: tabs(1) },
        { key: 'item', name: 'social/[itemType]/[itemId]' },
      ],
    });
    const story = collectVisibleRouteKeys({
      index: 1,
      routes: [
        { key: 'tabs', name: '(tabs)', state: tabs(1) },
        { key: 'viewer', name: 'sheets/story-viewer' },
      ],
    });
    expect([...pushed]).toEqual(['item']);
    expect([...story]).toEqual(['viewer']);
  });

  it('sees through stacked sheets down to the screen they cover', () => {
    const keys = collectVisibleRouteKeys({
      index: 2,
      routes: [
        { key: 'item', name: 'profile/[userId]' },
        { key: 'menu', name: 'sheets/menu' },
        { key: 'topup', name: 'sheets/topup' },
      ],
    });
    expect([...keys].sort()).toEqual(['item', 'menu', 'topup']);
  });
});
