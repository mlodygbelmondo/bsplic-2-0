import { authActions, useAuthStore } from '@/features/auth/auth-store';
import { OFFLINE_WRITE_MESSAGE } from '@/lib/connectivity';
import { haptics } from '@/lib/haptics';
import { queryClient } from '@/lib/query-client';
import { toast } from '@/lib/toast';

import { placeCouponSecure } from './api/place-coupon';
import { couponActions, useCouponItems, useCouponStore } from './coupon-store';
import { couponSheetActions, useCouponPlacing, useCouponSheetStore } from './coupon-sheet-store';
import {
  getEffectiveTotalOdds,
  getPotentialWin,
  getTotalStake,
  submitCoupon,
  type CouponTab,
} from './placement';

interface UseCouponPlacementResult {
  placeBet: () => Promise<void>;
  placing: boolean;
  effectiveTotalOdds: number;
  potentialWin: number;
  totalStake: number;
}

const roundMoney = (value: number) => Math.round(value * 100) / 100;

/** Balance and history change after a placement; refresh them in the background. */
function refreshAfterPlacement(userId: string, balanceBefore: number, chargedStake: number) {
  authActions.updateProfileBalance(roundMoney(balanceBefore - chargedStake));
  void authActions.refreshProfile();
  void queryClient.invalidateQueries({ queryKey: ['profile', userId] });
}

/**
 * Port of the web `useCouponPlacement`: same validation, RPC sequence, error
 * text and toasts. Natively the balance updates at once (then refreshes from
 * the server) and outcomes get haptics. Writes are refused while offline.
 */
export function useCouponPlacement(
  activeTab: CouponTab,
  stake: string,
  singleStakes: Record<string, string>,
  isOffline: boolean,
  onSuccess: () => void,
): UseCouponPlacementResult {
  const items = useCouponItems();
  const placing = useCouponPlacing();

  const totalStake = getTotalStake(activeTab, items, stake, singleStakes);
  const effectiveTotalOdds = getEffectiveTotalOdds(activeTab, items);
  const potentialWin = getPotentialWin(activeTab, items, stake, singleStakes);

  const placeBet = async () => {
    if (useCouponSheetStore.getState().placing) return;

    if (isOffline) {
      toast.error(OFFLINE_WRITE_MESSAGE);
      return;
    }

    const { user, profile } = useAuthStore.getState();
    if (!user || !profile) {
      toast.error('Zaloguj się');
      return;
    }

    const balance = Number(profile.balance);
    // `.finally` instead of try/finally: React Compiler skips hooks containing try/finally.
    // submitCoupon is async, so this always settles and the placing flag always resets.
    const result = await submitCoupon(
      {
        userId: user.id,
        balance,
        activeTab,
        stake,
        singleStakes,
        items: useCouponStore.getState().items,
      },
      placeCouponSecure,
      () => couponSheetActions.setPlacing(true),
    ).finally(() => couponSheetActions.setPlacing(false));

    if (result.status === 'invalid') {
      haptics.warning();
      toast.error(result.message);
      // A stale balance (topped up on another device) would keep failing the local check.
      void authActions.refreshProfile();
      return;
    }

    if (result.status === 'placed') {
      refreshAfterPlacement(user.id, balance, result.chargedStake);
      couponActions.clearCoupon();
      haptics.success();
      onSuccess();
      toast.success('Kupon postawiony pomyślnie!');
      return;
    }

    if (result.placedBetIds.length > 0) {
      result.placedBetIds.forEach(couponActions.removeItem);
      refreshAfterPlacement(user.id, balance, result.chargedStake);
    } else {
      // After a timeout the server may still have placed it: show the real balance and history.
      void authActions.refreshProfile();
      void queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
    }
    haptics.error();
    toast.error(result.message);
  };

  return { placeBet, placing, effectiveTotalOdds, potentialWin, totalStake };
}
