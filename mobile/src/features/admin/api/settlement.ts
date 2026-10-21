import type { Json } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export type SettlementMode = 'normal' | 'refund' | 'force_lost';
export type CorrectionScope = 'pending_only' | 'all';

interface SettleBetInput {
  betId: string;
  winningOptionNames: string[];
  mode?: SettlementMode;
  scope?: CorrectionScope;
}

/** `admin_settle_bet`; rethrows the raw PostgREST error for the caller's toast. */
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
