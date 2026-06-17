import { supabase } from '@/integrations/supabase/client';

import type { AkoExclusion } from './akoExclusions';

interface AkoExclusionRow {
  bet_id_a: string;
  bet_id_b: string;
  reason: string | null;
}

export async function fetchAkoExclusionsForBets(
  betIds: string[],
): Promise<AkoExclusion[]> {
  const uniqueBetIds = Array.from(new Set(betIds)).filter(Boolean);

  if (uniqueBetIds.length < 2) {
    return [];
  }

  const idList = uniqueBetIds.join(',');
  const { data, error } = await supabase
    .from('bet_ako_exclusions')
    .select('bet_id_a, bet_id_b, reason')
    .or(`bet_id_a.in.(${idList}),bet_id_b.in.(${idList})`);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as AkoExclusionRow[]).map((row) => ({
    betIdA: row.bet_id_a,
    betIdB: row.bet_id_b,
    reason: row.reason,
  }));
}
