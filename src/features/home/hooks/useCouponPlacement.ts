import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCoupon } from '@/contexts/CouponContext';
import { placeCouponSecure } from '@/features/home/api/coupons';
import { toast } from 'sonner';

interface UseCouponPlacementResult {
  placeBet: () => Promise<void>;
  placing: boolean;
  effectiveTotalOdds: number;
  potentialWin: number;
  totalStake: number;
}

export function parseStake(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100) / 100;
}

export function isPositiveStakeInput(value: string): boolean {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}

export function validateStakePrecision(value: string): boolean {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed === Math.round(parsed * 100) / 100;
}

function distributeStakeAcrossItems(
  totalStake: number,
  itemCount: number,
): number[] {
  if (itemCount <= 0) return [];

  const totalCents = Math.round(totalStake * 100);
  const baseCents = Math.floor(totalCents / itemCount);
  const remainder = totalCents % itemCount;

  return Array.from({ length: itemCount }, (_, index) => {
    const cents = baseCents + (index < remainder ? 1 : 0);
    return cents / 100;
  });
}

export function useCouponPlacement(
  activeTab: 'single' | 'ako',
  stake: string,
  singleStakes: Record<string, string>,
  onSuccess: () => void,
): UseCouponPlacementResult {
  const { items, clearCoupon, removeItem, totalOdds } = useCoupon();
  const { user, profile, refreshProfile } = useAuth();
  const [placing, setPlacing] = useState(false);

  const totalStake = useMemo(() => {
    if (activeTab === 'ako') {
      return parseStake(stake);
    }

    return items.reduce((sum, item) => {
      const itemStake = parseStake(singleStakes[item.bet.id] || '');
      return Math.round((sum + itemStake) * 100) / 100;
    }, 0);
  }, [activeTab, items, singleStakes, stake]);

  const effectiveTotalOdds = useMemo(() => {
    if (activeTab === 'ako') {
      return totalOdds;
    }
    return 1;
  }, [activeTab, totalOdds]);

  const potentialWin = useMemo(() => {
    if (activeTab === 'ako') {
      return Math.round(parseStake(stake) * effectiveTotalOdds * 100) / 100;
    }

    return items.reduce((sum, item) => {
      const win = parseStake(singleStakes[item.bet.id] || '') * item.odds;
      return Math.round((sum + win) * 100) / 100;
    }, 0);
  }, [activeTab, effectiveTotalOdds, items, singleStakes, stake]);

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
        const rawItemStake = singleStakes[item.bet.id] || '';
        if (!isPositiveStakeInput(rawItemStake)) {
          toast.error('Uzupełnij stawkę dla każdego zakładu');
          return;
        }
        if (!validateStakePrecision(rawItemStake)) {
          toast.error('Stawka może mieć maksymalnie 2 miejsca po przecinku');
          return;
        }
      }
    } else {
      if (!isPositiveStakeInput(stake)) {
        toast.error('Stawka musi być większa od 0');
        return;
      }
      if (!validateStakePrecision(stake)) {
        toast.error('Stawka może mieć maksymalnie 2 miejsca po przecinku');
        return;
      }
    }

    if (totalStake <= 0) {
      toast.error('Stawka musi być większa od 0');
      return;
    }

    const balance = Number(profile.balance);

    if (totalStake > balance) {
      toast.error(`Niewystarczające środki (saldo: ${balance.toFixed(2)} zł)`);
      return;
    }

    setPlacing(true);

    const placedSingleBetIds: string[] = [];

    try {
      if (activeTab === 'single') {
        for (const item of items) {
          const itemStake = parseStake(singleStakes[item.bet.id] || '');

          await placeCouponSecure({
            userId: user.id,
            totalOdds: 1,
            stake: itemStake,
            items: [
              {
                betId: item.bet.id,
                selectedOption: item.selectedOption,
                odds: item.odds,
                stake: itemStake,
              },
            ],
          });

          placedSingleBetIds.push(item.bet.id);
        }
      } else {
        const distributedStakes = distributeStakeAcrossItems(
          totalStake,
          items.length,
        );

        await placeCouponSecure({
          userId: user.id,
          totalOdds: effectiveTotalOdds,
          stake: totalStake,
          items: items.map((item, index) => ({
            betId: item.bet.id,
            selectedOption: item.selectedOption,
            odds: item.odds,
            stake: distributedStakes[index],
          })),
        });
      }

      await refreshProfile();
      clearCoupon();
      onSuccess();
      toast.success('Kupon postawiony pomyślnie!');
    } catch (error) {
      if (placedSingleBetIds.length > 0) {
        placedSingleBetIds.forEach(removeItem);
        await refreshProfile();
      }

      const message =
        error instanceof Error
          ? error.message
          : 'Nie udało się postawić kuponu';
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
