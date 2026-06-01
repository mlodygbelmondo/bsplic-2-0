import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export type SettlementMode = 'normal' | 'refund' | 'force_lost';
export type CorrectionScope = 'pending_only' | 'all';

interface SettleBetInput {
  betId: string;
  winningOptionNames: string[];
  mode?: SettlementMode;
  scope?: CorrectionScope;
}

export async function settleBetWithBackend({
  betId,
  winningOptionNames,
  mode = 'normal',
  scope = 'pending_only',
}: SettleBetInput): Promise<Json> {
  const { data, error } = await supabase.rpc('admin_settle_bet', {
    p_bet_id: betId,
    p_winning_options: winningOptionNames,
    p_mode: mode,
    p_scope: scope,
  });

  if (error) throw error;
  return data;
}
