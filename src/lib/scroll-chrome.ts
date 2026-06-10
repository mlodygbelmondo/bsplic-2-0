export interface ScrollChromeState {
  hidden: boolean;
  lastScrollTop: number;
  travel: number;
}

interface ScrollMetrics {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

const TOP_RESET_PX = 32;
const HIDE_TRAVEL_PX = 56;
const SHOW_TRAVEL_PX = 44;
const BOTTOM_LOCK_PX = 72;
const NOISE_PX = 3;

const initialState: ScrollChromeState = {
  hidden: false,
  lastScrollTop: 0,
  travel: 0,
};

export function getNextScrollChromeState(
  previous: ScrollChromeState | undefined,
  metrics: ScrollMetrics,
): ScrollChromeState {
  const state = previous ?? initialState;
  const scrollTop = Math.max(0, metrics.scrollTop);
  const delta = scrollTop - state.lastScrollTop;

  if (scrollTop <= TOP_RESET_PX) {
    return {
      hidden: false,
      lastScrollTop: scrollTop,
      travel: 0,
    };
  }

  if (Math.abs(delta) <= NOISE_PX) {
    return {
      ...state,
      lastScrollTop: scrollTop,
    };
  }

  const maxScrollTop = Math.max(0, metrics.scrollHeight - metrics.clientHeight);
  const distanceFromBottom = Math.max(0, maxScrollTop - scrollTop);
  const isNearBottom = distanceFromBottom <= BOTTOM_LOCK_PX;

  if (isNearBottom && delta < 0) {
    return {
      hidden: state.hidden,
      lastScrollTop: scrollTop,
      travel: 0,
    };
  }

  const travel =
    Math.sign(state.travel) === Math.sign(delta)
      ? state.travel + delta
      : delta;

  if (!state.hidden && travel >= HIDE_TRAVEL_PX) {
    return {
      hidden: true,
      lastScrollTop: scrollTop,
      travel: 0,
    };
  }

  if (state.hidden && !isNearBottom && travel <= -SHOW_TRAVEL_PX) {
    return {
      hidden: false,
      lastScrollTop: scrollTop,
      travel: 0,
    };
  }

  return {
    hidden: state.hidden,
    lastScrollTop: scrollTop,
    travel,
  };
}
