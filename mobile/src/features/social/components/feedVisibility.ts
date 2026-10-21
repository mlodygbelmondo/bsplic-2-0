import { createContext, use, useSyncExternalStore } from 'react';

/**
 * Which feed cards are on screen (fed by FlashList `onViewableItemsChanged`).
 * Embeds mount their WebView only once their card has been visible, so fast
 * scrolling never builds web views. Outside a provider (the item page)
 * everything counts as visible.
 */
export interface FeedVisibilityStore {
  isVisible: (key: string) => boolean;
  subscribe: (listener: () => void) => () => void;
  setVisible: (keys: Iterable<string>) => void;
}

export function createFeedVisibilityStore(): FeedVisibilityStore {
  let visible = new Set<string>();
  const listeners = new Set<() => void>();
  return {
    isVisible: (key) => visible.has(key),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setVisible: (keys) => {
      visible = new Set(keys);
      for (const listener of listeners) listener();
    },
  };
}

export const FeedVisibilityContext = createContext<FeedVisibilityStore | null>(null);

const subscribeNever = () => () => undefined;

export function useFeedItemVisible(itemKey: string): boolean {
  const store = use(FeedVisibilityContext);
  return useSyncExternalStore(store ? store.subscribe : subscribeNever, () => (store ? store.isVisible(itemKey) : true));
}
