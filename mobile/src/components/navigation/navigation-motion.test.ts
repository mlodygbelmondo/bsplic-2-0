import { describe, expect, it } from 'vitest';

import {
  advanceChromeScroll,
  createChromeScrollState,
  getMountedPagerIndexes,
  isPagerSwipeEnabled,
  resolvePagerRouteSync,
  shouldAcceptPagerSelection,
  type ChromeScrollState,
} from './navigation-motion';

describe('pager route synchronization', () => {
  it('does not roll a settled native page back while the router still exposes the previous route', () => {
    expect(resolvePagerRouteSync({
      displayKey: 'roulette',
      pendingRouteKey: 'roulette',
      routeKey: 'social',
    })).toBe('ignore');
  });

  it('acknowledges the route once Expo Router catches up', () => {
    expect(resolvePagerRouteSync({
      displayKey: 'roulette',
      pendingRouteKey: 'roulette',
      routeKey: 'roulette',
    })).toBe('acknowledge');
  });

  it('clears a pending tab route when navigation leaves the tab surface', () => {
    expect(resolvePagerRouteSync({
      displayKey: 'roulette',
      pendingRouteKey: 'roulette',
      routeKey: null,
    })).toBe('acknowledge');
  });

  it('synchronizes a genuine external route change', () => {
    expect(resolvePagerRouteSync({
      displayKey: 'social',
      pendingRouteKey: null,
      routeKey: 'rankings',
    })).toBe('synchronize');
  });
});

describe('pager screen lifecycle', () => {
  it('keeps only the selected page and its direct neighbours mounted', () => {
    expect(getMountedPagerIndexes(0, 5)).toEqual([0, 1]);
    expect(getMountedPagerIndexes(2, 5)).toEqual([1, 2, 3]);
    expect(getMountedPagerIndexes(4, 5)).toEqual([3, 4]);
  });

  it('ignores stale native selection events during rapid tab taps', () => {
    expect(shouldAcceptPagerSelection(4, 2)).toBe(false);
    expect(shouldAcceptPagerSelection(4, 4)).toBe(true);
    expect(shouldAcceptPagerSelection(null, 2)).toBe(true);
    expect(shouldAcceptPagerSelection(4, 4, false)).toBe(false);
  });

  it('locks swipe only while a programmatic transition or screen interaction owns the pager', () => {
    expect(isPagerSwipeEnabled({ visible: true, screenBlocked: false, programmaticTransition: false })).toBe(true);
    expect(isPagerSwipeEnabled({ visible: true, screenBlocked: false, programmaticTransition: true })).toBe(false);
    expect(isPagerSwipeEnabled({ visible: true, screenBlocked: true, programmaticTransition: false })).toBe(false);
    expect(isPagerSwipeEnabled({ visible: false, screenBlocked: false, programmaticTransition: false })).toBe(false);
  });
});

describe('advanceChromeScroll', () => {
  it('hides after deliberate downward travel and reveals sooner on upward travel', () => {
    let state = createChromeScrollState();
    state = advanceChromeScroll(state, 30);
    state = advanceChromeScroll(state, 70);
    state = advanceChromeScroll(state, 90);
    expect(state.visibility).toBe('hidden');

    state = advanceChromeScroll(state, 78);
    state = advanceChromeScroll(state, 60);
    expect(state.visibility).toBe('visible');
  });

  it('always reveals near the top and ignores micro movement', () => {
    let state: ChromeScrollState = { ...createChromeScrollState(100), visibility: 'hidden' };
    state = advanceChromeScroll(state, 100.5);
    expect(state.visibility).toBe('hidden');
    state = advanceChromeScroll(state, 8);
    expect(state.visibility).toBe('visible');
  });
});
