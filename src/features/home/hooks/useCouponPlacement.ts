import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCoupon } from '@/contexts/CouponContext';
import { placeCouponSecure } from '@/features/home/api/coupons';
import {
  buildCouponPlacementPayload,
  validateCouponStakeSelection,
} from '@/features/home/hooks/couponStake';
import { roundAssetAmount } from '@/features/markets/pricing';
import { toast } from 'sonner';
import { CouponStakeAssetPayload, MarketAsset } from '@/types/markets';

interface UseCouponPlacementResult {
  placeBet: () => Promise<void>;
  placing: boolean;
  effectiveTotalOdds: number;
  potentialWin: number;
  totalStake: number;
}

interface UseCouponPlacementOptions {
  useAssetStake?: boolean;
  stakeAsset?: {
    asset: MarketAsset;
    quantity: number | null;
    stakePln: number;
    unitPricePln: number;
    fxRateToPln: number;
    balanceQuantity: number;
  } | null;
}

function parseStake(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100) / 100;
}

function validateStakePrecision(value: number): boolean {
  return value === Math.round(value * 100) / 100;
}

export function useCouponPlacement(
  activeTab: 'single' | 'ako',
  stake: string,
  singleStakes: Record<string, string>,
  onSuccess: () => void,
  options: UseCouponPlacementOptions = {}
): UseCouponPlacementResult {
  const { items, clearCoupon, totalOdds } = useCoupon();
  const { user, profile, refreshProfile } = useAuth();
  const [placing, setPlacing] = useState(false);
  const useAssetStake = Boolean(options.useAssetStake);
  const stakeAsset = options.stakeAsset ?? null;

  const totalStakeFromInputs = useMemo(() => {
    if (activeTab === 'ako') {
      return parseStake(stake);
    }

    return items.reduce((sum, item) => {
      const itemStake = parseStake(singleStakes[item.bet.id] || '');
      return Math.round((sum + itemStake) * 100) / 100;
    }, 0);
  }, [activeTab, items, singleStakes, stake]);

  const totalStake = useMemo(() => {
    if (activeTab === 'single') {
      return totalStakeFromInputs;
    }

    if (useAssetStake) {
      if (!stakeAsset) return 0;
      return Math.round(stakeAsset.stakePln * 100) / 100;
    }

    return totalStakeFromInputs;
  }, [activeTab, stakeAsset, totalStakeFromInputs, useAssetStake]);

  const effectiveStakeAssetQuantity = useMemo(() => {
    if (!useAssetStake || !stakeAsset || !stakeAsset.unitPricePln || stakeAsset.unitPricePln <= 0) {
      return null;
    }

    if (activeTab === 'single') {
      if (totalStake <= 0) return null;
      return roundAssetAmount(totalStake / stakeAsset.unitPricePln);
    }

    return stakeAsset.quantity;
  }, [activeTab, stakeAsset, totalStake, useAssetStake]);

  const effectiveTotalOdds = useMemo(() => {
    if (activeTab === 'ako') {
      return totalOdds;
    }
    return 1;
  }, [activeTab, totalOdds]);

  const potentialWin = useMemo(() => {
    if (activeTab === 'ako') {
      return Math.round(totalStake * effectiveTotalOdds * 100) / 100;
    }

    return items.reduce(
      (sum, item) => {
        const win = parseStake(singleStakes[item.bet.id] || '') * item.odds;
        return Math.round((sum + win) * 100) / 100;
      },
      0
    );
  }, [activeTab, effectiveTotalOdds, items, singleStakes, totalStake]);

  const placeBet = async () => {
    if (!user || !profile) {
      toast.error('Zaloguj się');
      return;
    }

    if (items.length === 0) {
      toast.error('Dodaj co najmniej jedno zdarzenie do kuponu');
      return;
    }

    if (activeTab === 'single') {
      for (const item of items) {
        const itemStake = parseStake(singleStakes[item.bet.id] || '');
        if (itemStake <= 0) {
          toast.error('Uzupełnij stawkę dla każdego zakładu');
          return;
        }
        if (!validateStakePrecision(itemStake)) {
          toast.error('Stawka może mieć maksymalnie 2 miejsca po przecinku');
          return;
        }
      }
    } else if (!useAssetStake) {
      const akoStake = parseStake(stake);
      if (akoStake <= 0) {
        toast.error('Stawka musi być większa od 0');
        return;
      }
      if (!validateStakePrecision(akoStake)) {
        toast.error('Stawka może mieć maksymalnie 2 miejsca po przecinku');
        return;
      }
    }

    if (totalStake <= 0) {
      toast.error('Stawka musi być większa od 0');
      return;
    }

    const balance = Number(profile.balance);

    const stakeValidationError = validateCouponStakeSelection({
      useAssetStake,
      totalStakePln: totalStake,
      totalBalancePln: balance,
      stakeAssetQuantity: effectiveStakeAssetQuantity,
      stakeAssetMinBetPln: stakeAsset?.asset.min_bet_pln ?? null,
    });

    if (stakeValidationError) {
      toast.error(stakeValidationError);
      return;
    }

    if (
      useAssetStake &&
      stakeAsset &&
      effectiveStakeAssetQuantity !== null &&
      effectiveStakeAssetQuantity > stakeAsset.balanceQuantity
    ) {
      toast.error(`Nie masz wystarczającej ilości aktywa (${stakeAsset.balanceQuantity})`);
      return;
    }

    let payloadStakeAsset: CouponStakeAssetPayload | null = null;
    if (useAssetStake && stakeAsset && effectiveStakeAssetQuantity) {
      payloadStakeAsset = {
        assetId: stakeAsset.asset.id,
        symbol: stakeAsset.asset.symbol,
        type: stakeAsset.asset.type,
        quantity: effectiveStakeAssetQuantity,
        quoteCurrency: stakeAsset.asset.quote_currency,
        unitPricePln: stakeAsset.unitPricePln,
        fxRateToPln: stakeAsset.fxRateToPln,
      };
    }

    const placementPayload = buildCouponPlacementPayload({
      activeTab,
      totalStakePln: totalStake,
      effectiveTotalOdds,
      items: items.map((item) => ({
        betId: item.bet.id,
        selectedOption: item.selectedOption,
        odds: item.odds,
      })),
      singleStakeByBetId: Object.fromEntries(
        Object.entries(singleStakes).map(([betId, rawStake]) => [betId, parseStake(rawStake)])
      ),
      stakeAsset: payloadStakeAsset,
    });

    setPlacing(true);

    try {
      await placeCouponSecure({
        userId: user.id,
        totalOdds: placementPayload.totalOdds,
        stake: placementPayload.stake,
        items: placementPayload.items,
        stakeAsset: placementPayload.stakeAsset,
      });

      await refreshProfile();
      clearCoupon();
      onSuccess();
      toast.success('Kupon postawiony pomyślnie!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nie udało się postawić kuponu';
      toast.error(message);
    } finally {
      setPlacing(false);
    }
  };

  return {
    placeBet,
    placing,
    effectiveTotalOdds,
    potentialWin,
    totalStake,
  };
}
