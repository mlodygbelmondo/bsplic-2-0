import { supabase } from '@/integrations/supabase/client';
import { Json } from '@/integrations/supabase/types';
import { CouponStakeAssetPayload } from '@/types/markets';

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
  stakeAsset?: CouponStakeAssetPayload | null;
}

export async function placeCouponSecure({ userId, totalOdds, stake, items, stakeAsset }: PlaceCouponParams): Promise<string> {
  const roundedStake = Math.round(stake * 100) / 100;

  const p_items = items.map((item) => ({
    betId: item.betId,
    selectedOption: item.selectedOption,
    odds: item.odds,
    stake: Math.round(item.stake * 100) / 100,
  }));

  const rpcPayload: Record<string, unknown> = {
    p_user_id: userId,
    p_total_odds: totalOdds,
    p_stake: roundedStake,
    p_items: p_items as unknown as Json,
  };

  if (stakeAsset) {
    rpcPayload.p_stake_asset = stakeAsset as unknown as Json;
  }

  const { data, error } = await (supabase as never as {
    rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: string; error: { message: string } | null }>;
  }).rpc('place_bet_secure', rpcPayload);

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
