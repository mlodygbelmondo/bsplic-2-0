import { supabase } from '@/integrations/supabase/client';
import { Json } from '@/integrations/supabase/types';

interface PlaceCouponParams {
  userId: string;
  totalOdds: number;
  stake: number;
  items: Array<{
    betId: string;
    selectedOption: string;
    odds: number;
    stake: number;
  }>;
}

export async function placeCouponSecure({ userId, totalOdds, stake, items }: PlaceCouponParams): Promise<string> {
  const roundedStake = Math.round(stake * 100) / 100;

  const p_items = items.map((item) => ({
    betId: item.betId,
    selectedOption: item.selectedOption,
    odds: item.odds,
    stake: Math.round(item.stake * 100) / 100,
  }));

  const { data, error } = await supabase.rpc('place_bet_secure', {
    p_user_id: userId,
    p_total_odds: totalOdds,
    p_stake: roundedStake,
    p_items: p_items as unknown as Json,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as string;
}
