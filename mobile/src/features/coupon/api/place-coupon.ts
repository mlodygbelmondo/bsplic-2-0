import type { Json } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

import type { PlaceCouponParams } from '../placement';

/**
 * `place_bet_secure` (web `placeCouponSecure`). The server re-validates every
 * rule; its error is thrown as is (RAISE text for the toast, code to tell a
 * rejection from an unknown outcome).
 */
export async function placeCouponSecure({ userId, totalOdds, stake, items }: PlaceCouponParams): Promise<string> {
  const p_items = items.map((item) => ({
    betId: item.betId,
    selectedOption: item.selectedOption,
    odds: item.odds,
    stake: Math.round(item.stake * 100) / 100,
  }));

  const { data, error } = await supabase.rpc('place_bet_secure', {
    p_user_id: userId,
    p_total_odds: totalOdds,
    p_stake: Math.round(stake * 100) / 100,
    p_items: p_items as unknown as Json,
  });

  if (error) throw error;
  return data;
}
