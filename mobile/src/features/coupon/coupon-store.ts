import { create } from 'zustand';

import { kv, readJson } from '@/lib/storage';
import { toast } from '@/lib/toast';
import type { CouponItem } from '@/types/database';

/**
 * Port of the web CouponContext as a zustand store. Bet cards subscribe to the
 * one selection they render (`useCouponSelection`), so adding a leg re-renders
 * that card and the coupon bar, not the whole list.
 */

export type CouponType = 'single' | 'ako';

const STORED_ITEMS_KEY = 'bsplic.coupon.items.v1';

function isStorableCouponItem(value: unknown): value is CouponItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as CouponItem;
  return (
    typeof item.selectedOption === 'string' &&
    typeof item.odds === 'number' &&
    Number.isFinite(item.odds) &&
    !!item.bet &&
    typeof item.bet === 'object' &&
    typeof item.bet.id === 'string'
  );
}

function readStoredItems(): CouponItem[] {
  const parsed = readJson<unknown>(STORED_ITEMS_KEY);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isStorableCouponItem).filter((item) => {
    if (!item.bet.is_active) return false;
    const endsAt = new Date(item.bet.ends_at).getTime();
    return Number.isFinite(endsAt) && endsAt > Date.now();
  });
}

function writeStoredItems(items: CouponItem[]) {
  if (items.length === 0) {
    kv.remove(STORED_ITEMS_KEY);
  } else {
    kv.set(STORED_ITEMS_KEY, JSON.stringify(items));
  }
}

interface CouponState {
  items: CouponItem[];
  preferredCouponType: CouponType | null;
}

export const useCouponStore = create<CouponState>(() => ({
  items: readStoredItems(),
  preferredCouponType: null,
}));

useCouponStore.subscribe((state, previous) => {
  if (state.items !== previous.items) writeStoredItems(state.items);
});

export const couponActions = {
  addItem(item: CouponItem) {
    useCouponStore.setState(({ items }) => ({
      items: items.some((i) => i.bet.id === item.bet.id)
        ? items.map((i) => (i.bet.id === item.bet.id ? item : i))
        : [...items, item],
    }));
    toast.success('Dodano do kuponu');
  },

  addItems(incoming: CouponItem[]) {
    if (incoming.length === 0) return;
    useCouponStore.setState(({ items }) => {
      const byBetId = new Map(items.map((item) => [item.bet.id, item]));
      incoming.forEach((item) => byBetId.set(item.bet.id, item));
      return { items: Array.from(byBetId.values()) };
    });
  },

  removeItem(betId: string) {
    useCouponStore.setState(({ items }) => ({ items: items.filter((i) => i.bet.id !== betId) }));
  },

  /** Removes these exact selections; a pick changed meanwhile (new object) stays. */
  removeItems(removed: CouponItem[]) {
    const set = new Set(removed);
    useCouponStore.setState(({ items }) => ({ items: items.filter((item) => !set.has(item)) }));
  },

  clearCoupon() {
    useCouponStore.setState({ items: [], preferredCouponType: null });
  },

  setPreferredCouponType(preferredCouponType: CouponType | null) {
    useCouponStore.setState({ preferredCouponType });
  },
};

export const getTotalOdds = (items: CouponItem[]) => items.reduce((acc, item) => acc * item.odds, 1);
export const getCouponType = (items: CouponItem[]): CouponType => (items.length > 1 ? 'ako' : 'single');

// Selectors — prefer these over reading the whole store.
export const useCouponItems = () => useCouponStore((s) => s.items);
export const useCouponCount = () => useCouponStore((s) => s.items.length);
export const useCouponTotalOdds = () => useCouponStore((s) => getTotalOdds(s.items));
export const usePreferredCouponType = () => useCouponStore((s) => s.preferredCouponType);
/** The option picked for one bet, or null. */
export const useCouponSelection = (betId: string) =>
  useCouponStore((s) => s.items.find((i) => i.bet.id === betId)?.selectedOption ?? null);
