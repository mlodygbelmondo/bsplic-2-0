import { create } from 'zustand';

import { useAuthStore } from '@/features/auth/auth-store';

/**
 * Per-card toggles in the Social feed: hidden ("Ukryj wpis"), coupon legs
 * expanded and comment thread open. The web feed is not virtualized, so these
 * last until the page reloads; recycled cells read them back by item key.
 */
interface FeedCardState {
  hidden: ReadonlySet<string>;
  couponExpanded: ReadonlySet<string>;
  threadOpen: ReadonlySet<string>;
}

type FeedCardFlag = keyof FeedCardState;

const initialState: FeedCardState = { hidden: new Set(), couponExpanded: new Set(), threadOpen: new Set() };

const useFeedCardStore = create<FeedCardState>(() => initialState);

export function useFeedCardFlag(flag: FeedCardFlag, itemKey: string): boolean {
  return useFeedCardStore((state) => state[flag].has(itemKey));
}

export function setFeedCardFlag(flag: FeedCardFlag, itemKey: string, on: boolean) {
  const current = useFeedCardStore.getState()[flag];
  if (current.has(itemKey) === on) return;
  const next = new Set(current);
  if (on) next.add(itemKey);
  else next.delete(itemKey);
  useFeedCardStore.setState({ [flag]: next });
}

// Another account starts with a clean feed.
useAuthStore.subscribe((state, previous) => {
  if (state.user?.id !== previous.user?.id) useFeedCardStore.setState(initialState);
});
