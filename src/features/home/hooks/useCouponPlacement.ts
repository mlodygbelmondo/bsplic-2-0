import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCoupon } from '@/contexts/CouponContext';
import { placeCoupon, updateUserBalance } from '@/features/home/api/coupons';
import { toast } from 'sonner';

interface UseCouponPlacementResult {
  placeBet: () => Promise<void>;
  placing: boolean;
  effectiveTotalOdds: number;
  potentialWin: number;
  totalStake: number;
}

function parseStake(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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

    return items.reduce((sum, item) => sum + parseStake(singleStakes[item.bet.id] || ''), 0);
  }, [activeTab, items, singleStakes, stake]);

  const effectiveTotalOdds = useMemo(() => {
    if (activeTab === 'ako') {
      return totalOdds;
    }
    return 1;
  }, [activeTab, totalOdds]);

  const potentialWin = useMemo(() => {
    if (activeTab === 'ako') {
      return parseStake(stake) * effectiveTotalOdds;
    }

    return items.reduce(
      (sum, item) => sum + parseStake(singleStakes[item.bet.id] || '') * item.odds,
      0
    );
  }, [activeTab, effectiveTotalOdds, items, singleStakes, stake]);

  const placeBet = async () => {
    if (!user || !profile) {
      toast.error('Zaloguj się');
      return;
    }

    if (activeTab === 'single') {
      const missingStake = items.some((item) => parseStake(singleStakes[item.bet.id] || '') <= 0);
      if (missingStake) {
        toast.error('Uzupełnij stawkę dla każdego zakładu');
        return;
      }
    }

    if (totalStake <= 0 || totalStake > Number(profile.balance)) {
      toast.error('Niewystarczające środki');
      return;
    }

    setPlacing(true);

    try {
      await placeCoupon({
        userId: user.id,
        totalOdds: activeTab === 'ako' ? effectiveTotalOdds : 1,
        stake: totalStake,
        items: items.map((item) => ({
          betId: item.bet.id,
          selectedOption: item.selectedOption,
          odds: item.odds,
          stake: activeTab === 'single' ? parseStake(singleStakes[item.bet.id] || '') : totalStake / items.length,
        })),
      });

      await updateUserBalance(user.id, Number(profile.balance) - totalStake);
      await refreshProfile();
      clearCoupon();
      onSuccess();
      toast.success('🎰 Kupon postawiony pomyślnie!');
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
