import { create } from 'zustand';

import { kv } from '@/lib/storage';
import type { CouponItem } from '@/types/database';

import { useCouponStore } from './coupon-store';
import { DEFAULT_STAKE, type CouponTab } from './placement';

/**
 * Coupon sheet state that the web keeps inside the always-mounted
 * `CouponDrawer`: the active tab, the AKO stake and per-bet single stakes.
 * The native sheet is a route that unmounts on close, so the state lives
 * here and survives closing and reopening the sheet.
 */

const LAST_STAKE_KEY = 'bsplic.coupon.last-stake';

function readLastStake(): string {
  const raw = kv.getString(LAST_STAKE_KEY);
  const parsed = Number(raw);
  return raw && Number.isFinite(parsed) && parsed > 0 ? raw : DEFAULT_STAKE;
}

/** Remembered after a successful AKO placement only (web parity). */
export function writeLastStake(value: string) {
  kv.set(LAST_STAKE_KEY, value);
}

/** New bets start at 10 zł; bets that left the coupon drop their stake. */
function syncSingleStakes(items: CouponItem[], previous: Record<string, string>): Record<string, string> {
  const next: Record<string, string> = {};
  items.forEach((item) => {
    next[item.bet.id] = previous[item.bet.id] ?? DEFAULT_STAKE;
  });
  return next;
}

interface CouponSheetState {
  activeTab: CouponTab;
  stake: string;
  singleStakes: Record<string, string>;
  placing: boolean;
}

export const useCouponSheetStore = create<CouponSheetState>(() => ({
  activeTab: 'single',
  stake: readLastStake(),
  singleStakes: syncSingleStakes(useCouponStore.getState().items, {}),
  placing: false,
}));

useCouponStore.subscribe((state, previous) => {
  if (state.items !== previous.items) {
    useCouponSheetStore.setState(({ singleStakes }) => ({
      singleStakes: syncSingleStakes(state.items, singleStakes),
    }));
  }
});

export const couponSheetActions = {
  setActiveTab(activeTab: CouponTab) {
    useCouponSheetStore.setState({ activeTab });
  },
  setStake(stake: string) {
    useCouponSheetStore.setState({ stake });
  },
  setSingleStake(betId: string, value: string) {
    useCouponSheetStore.setState(({ singleStakes }) => ({ singleStakes: { ...singleStakes, [betId]: value } }));
  },
  resetSingleStakes() {
    useCouponSheetStore.setState({ singleStakes: syncSingleStakes(useCouponStore.getState().items, {}) });
  },
  setPlacing(placing: boolean) {
    useCouponSheetStore.setState({ placing });
  },
};

export const useCouponActiveTab = () => useCouponSheetStore((s) => s.activeTab);
export const useCouponStake = () => useCouponSheetStore((s) => s.stake);
export const useCouponSingleStakes = () => useCouponSheetStore((s) => s.singleStakes);
/** One bet's single stake (`''` when unset), so typing re-renders only that card. */
export const useCouponSingleStake = (betId: string) => useCouponSheetStore((s) => s.singleStakes[betId] ?? '');
export const useCouponPlacing = () => useCouponSheetStore((s) => s.placing);
