import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export interface BetAkoExclusionDraft {
  betId: string;
  title: string;
  reason: string | null;
  id?: string;
}

interface BetAkoExclusionRpcRow {
  id?: string;
  betId?: string;
  title?: string;
  reason?: string | null;
}

function normalizeRows(data: unknown): BetAkoExclusionDraft[] {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((row): BetAkoExclusionDraft | null => {
      const value = row as BetAkoExclusionRpcRow;
      if (!value.betId || !value.title) {
        return null;
      }

      return {
        id: value.id,
        betId: value.betId,
        title: value.title,
        reason: value.reason ?? null,
      };
    })
    .filter((row): row is BetAkoExclusionDraft => row !== null);
}

export async function fetchBetAkoExclusions(
  betId: string,
): Promise<BetAkoExclusionDraft[]> {
  const { data, error } = await supabase.rpc('admin_get_bet_ako_exclusions', {
    p_bet_id: betId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return normalizeRows(data);
}

export async function replaceBetAkoExclusions(
  betId: string,
  exclusions: BetAkoExclusionDraft[],
): Promise<BetAkoExclusionDraft[]> {
  const p_exclusions = exclusions.map((exclusion) => ({
    betId: exclusion.betId,
    reason: exclusion.reason?.trim() || null,
  }));

  const { data, error } = await supabase.rpc(
    'admin_replace_bet_ako_exclusions',
    {
      p_bet_id: betId,
      p_exclusions: p_exclusions as unknown as Json,
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  return normalizeRows(data);
}
