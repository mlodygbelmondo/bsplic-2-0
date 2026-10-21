import { createStore } from 'zustand/vanilla';

/**
 * Scroll-driven chrome of one Social screen: the filter bar hiding, the
 * back-to-top button and the new-items pill. Kept in a store so scrolling
 * re-renders only those controls, never the list.
 */
export interface FeedChromeState {
  filterHidden: boolean;
  backToTop: boolean;
  newItems: boolean;
}

export type FeedChromeStore = ReturnType<typeof createFeedChromeStore>;

export function createFeedChromeStore() {
  return createStore<FeedChromeState>(() => ({ filterHidden: false, backToTop: false, newItems: false }));
}

/** Sets only the fields that changed, so subscribers are not woken on every scroll event. */
export function patchFeedChrome(store: FeedChromeStore, patch: Partial<FeedChromeState>) {
  const state = store.getState();
  for (const key of Object.keys(patch) as (keyof FeedChromeState)[]) {
    if (patch[key] !== state[key]) {
      store.setState(patch);
      return;
    }
  }
}
