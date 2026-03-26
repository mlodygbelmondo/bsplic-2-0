import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { Bet } from '@/types/database';

type BetRow = Database['public']['Tables']['bets']['Row'];

export async function fetchActiveBets(selectedCategory: string | null) {
  let query = supabase.from('bets').select('*').eq('is_active', true);

  if (selectedCategory) {
    query = query.eq('category_id', selectedCategory);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as Bet[];
}

export async function fetchBetsByIds(ids: string[]) {
  if (ids.length === 0) {
    return [] as Bet[];
  }

  const { data, error } = await supabase.from('bets').select('*').in('id', ids);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as Bet[];
}

export function subscribeToBetsChanges(onChange: (payload: RealtimePostgresChangesPayload<BetRow>) => void) {
  const channel = supabase
    .channel('bets-realtime')
    .on<BetRow>('postgres_changes', { event: '*', schema: 'public', table: 'bets' }, onChange)
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
