import { supabase } from '@/integrations/supabase/client';

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

export async function placeCoupon({ userId, totalOdds, stake, items }: PlaceCouponParams) {
  const { data: coupon, error: couponError } = await supabase
    .from('coupons')
    .insert({ user_id: userId, total_odds: totalOdds, stake, status: 'pending' })
    .select()
    .single();

  if (couponError) {
    throw new Error(couponError.message);
  }

  const placedBets = items.map((item) => ({
    user_id: userId,
    bet_id: item.betId,
    selected_option: item.selectedOption,
    stake: item.stake,
    odds_at_time: item.odds,
    coupon_id: coupon.id,
  }));

  const { error: betsError } = await supabase.from('placed_bets').insert(placedBets);

  if (betsError) {
    throw new Error(betsError.message);
  }
}

export async function updateUserBalance(userId: string, newBalance: number) {
  const { error } = await supabase.from('profiles').update({ balance: newBalance }).eq('id', userId);

  if (error) {
    throw new Error(error.message);
  }
}
