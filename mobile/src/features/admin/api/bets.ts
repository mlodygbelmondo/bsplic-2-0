import { supabase } from '@/lib/supabase';
import type { Bet } from '@/types/database';

/** Every bet, newest first (web `ManageBetsTab.fetchBets`). */
export async function fetchAllBets(): Promise<Bet[]> {
  const { data, error } = await supabase
    .from('bets')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Bet[];
}

/** Active bets for the create tab's AKO picker (web `CreateBetTab`). */
export async function fetchActiveBets(): Promise<Bet[]> {
  const { data, error } = await supabase
    .from('bets')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Bet[];
}

export async function deleteBet(betId: string): Promise<void> {
  const { error } = await supabase.from('bets').delete().eq('id', betId);
  if (error) throw error;
}
