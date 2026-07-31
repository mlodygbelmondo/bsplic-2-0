export type PagerRouteSyncAction = 'ignore' | 'acknowledge' | 'synchronize';

export function resolvePagerRouteSync({
  displayKey,
  pendingRouteKey,
  routeKey,
}: {
  displayKey: string;
  pendingRouteKey: string | null;
  routeKey: string | null;
}): PagerRouteSyncAction {
  if (pendingRouteKey !== null) {
    return routeKey === pendingRouteKey || routeKey === null ? 'acknowledge' : 'ignore';
  }

  return routeKey !== null && routeKey !== displayKey ? 'synchronize' : 'ignore';
}

export function getMountedPagerIndexes(selectedIndex: number, pageCount: number) {
  if (pageCount <= 0) return [];

  const safeIndex = Math.max(0, Math.min(selectedIndex, pageCount - 1));
  const start = Math.max(0, safeIndex - 1);
  const end = Math.min(pageCount - 1, safeIndex + 1);
  return Array.from({ length: end - start + 1 }, (_, offset) => start + offset);
}

export function shouldAcceptPagerSelection(
  requestedIndex: number | null,
  selectedIndex: number,
  visible = true,
) {
  return visible && (requestedIndex === null || requestedIndex === selectedIndex);
}

export function isPagerSwipeEnabled({
  visible,
  screenBlocked,
  programmaticTransition,
}: {
  visible: boolean;
  screenBlocked: boolean;
  programmaticTransition: boolean;
}) {
  return visible && !screenBlocked && !programmaticTransition;
}

export type ChromeVisibility = 'visible' | 'hidden';
export type ChromeScrollDirection = 'idle' | 'up' | 'down';

export interface ChromeScrollState {
  lastOffset: number;
  direction: ChromeScrollDirection;
  travel: number;
  visibility: ChromeVisibility;
}

export interface ChromeScrollConfig {
  topRevealOffset: number;
  minimumHideOffset: number;
  noiseThreshold: number;
  hideTravel: number;
  revealTravel: number;
}

export const NATIVE_CHROME_SCROLL_CONFIG: ChromeScrollConfig = {
  topRevealOffset: 12,
  minimumHideOffset: 64,
  noiseThreshold: 1.5,
  hideTravel: 44,
  revealTravel: 24,
};

export function createChromeScrollState(offset = 0): ChromeScrollState {
  return {
    lastOffset: Math.max(0, offset),
    direction: 'idle',
    travel: 0,
    visibility: 'visible',
  };
}

export function advanceChromeScroll(
  state: ChromeScrollState,
  rawOffset: number,
  config: ChromeScrollConfig = NATIVE_CHROME_SCROLL_CONFIG,
): ChromeScrollState {
  const offset = Math.max(0, rawOffset);

  if (offset <= config.topRevealOffset) {
    return { lastOffset: offset, direction: 'idle', travel: 0, visibility: 'visible' };
  }

  const delta = offset - state.lastOffset;
  if (Math.abs(delta) < config.noiseThreshold) {
    return { ...state, lastOffset: offset };
  }

  const direction: ChromeScrollDirection = delta > 0 ? 'down' : 'up';
  const travel = state.direction === direction
    ? state.travel + Math.abs(delta)
    : Math.abs(delta);
  let visibility = state.visibility;

  if (
    direction === 'down'
    && offset >= config.minimumHideOffset
    && travel >= config.hideTravel
  ) {
    visibility = 'hidden';
  } else if (direction === 'up' && travel >= config.revealTravel) {
    visibility = 'visible';
  }

  return {
    lastOffset: offset,
    direction,
    travel: visibility === state.visibility ? travel : 0,
    visibility,
  };
}
