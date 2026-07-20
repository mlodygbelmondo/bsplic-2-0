import { supabase } from '@/integrations/supabase/client';

export interface AkoExclusion { betIdA: string; betIdB: string; reason: string | null }
export interface AkoConflict { titleA: string; titleB: string; reason: string | null }

export async function fetchAkoExclusionsForBets(betIds: string[]): Promise<AkoExclusion[]> {
  const ids = Array.from(new Set(betIds)).filter(Boolean);
  if (ids.length < 2) return [];
  const idList = ids.join(',');
  const { data, error } = await supabase.from('bet_ako_exclusions').select('bet_id_a, bet_id_b, reason').or(`bet_id_a.in.(${idList}),bet_id_b.in.(${idList})`);
  if (error) throw error;
  return (data ?? []).map(row => ({ betIdA: row.bet_id_a, betIdB: row.bet_id_b, reason: row.reason }));
}

export function findAkoConflict(selections: Array<{ betId: string; title: string }>, exclusions: AkoExclusion[]): AkoConflict | null {
  const byId = new Map(selections.map(item => [item.betId, item]));
  for (const exclusion of exclusions) {
    const left = byId.get(exclusion.betIdA); const right = byId.get(exclusion.betIdB);
    if (left && right && left.betId !== right.betId) return { titleA: left.title, titleB: right.title, reason: exclusion.reason };
  }
  return null;
}

export function formatAkoConflict(conflict: AkoConflict) {
  return `Tych zdarzeń nie można łączyć na AKO: ${conflict.titleA} + ${conflict.titleB}${conflict.reason ? `. Powód: ${conflict.reason}` : ''}`;
}
