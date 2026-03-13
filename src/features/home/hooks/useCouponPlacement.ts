import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCoupon } from '@/contexts/CouponContext';
import { placeCoupon, updateUserBalance } from '@/features/home/api/coupons';
import { toast } from 'sonner';

export function useCouponPlacement(activeTab: 'single' | 'ako', stake: string, onSuccess: () => void) {
  const { items, clearCoupon, totalOdds } = useCoupon();
  const { user, profile, refreshProfile } = useAuth();
  const [placing, setPlacing] = useState(false);

  const effectiveTotalOdds = useMemo(() => {
    if (activeTab === 'ako') {
      return totalOdds;
    }
    return items[0]?.odds || 1;
  }, [activeTab, items, totalOdds]);

  const potentialWin = useMemo(() => Number(stake) * effectiveTotalOdds, [stake, effectiveTotalOdds]);

  const placeBet = async () => {
    if (!user || !profile) {
      toast.error('Zaloguj się');
      return;
    }

    const stakeNum = Number(stake);
    if (stakeNum <= 0 || stakeNum > Number(profile.balance)) {
      toast.error('Niewystarczające środki');
      return;
    }

    setPlacing(true);

    try {
      await placeCoupon({
        userId: user.id,
        totalOdds: effectiveTotalOdds,
        stake: stakeNum,
        items: items.map((item) => ({
          betId: item.bet.id,
          selectedOption: item.selectedOption,
          odds: item.odds,
          stake: activeTab === 'single' ? stakeNum : stakeNum / items.length,
        })),
      });

      await updateUserBalance(user.id, Number(profile.balance) - stakeNum);
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
  };
}
