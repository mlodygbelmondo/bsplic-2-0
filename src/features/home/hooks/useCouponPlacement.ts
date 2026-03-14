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
  onSuccess: () => void
): UseCouponPlacementResult {
  const { items, clearCoupon, totalOdds } = useCoupon();
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

    return items.reduce(
      (sum, item) => {
        const win = parseStake(singleStakes[item.bet.id] || '') * item.odds;
        return Math.round((sum + win) * 100) / 100;
      },
      0
    );
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
    } else {
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

    if (totalStake > balance) {
      toast.error(`Niewystarczające środki (saldo: ${balance.toFixed(2)} zł)`);
      return;
    }

    setPlacing(true);

    try {
      await placeCouponSecure({
        userId: user.id,
        totalOdds: activeTab === 'ako' ? effectiveTotalOdds : 1,
        stake: totalStake,
        items: items.map((item) => ({
          betId: item.bet.id,
          selectedOption: item.selectedOption,
          odds: item.odds,
          stake: activeTab === 'single' ? parseStake(singleStakes[item.bet.id] || '') : Math.round((totalStake / items.length) * 100) / 100,
        })),
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
