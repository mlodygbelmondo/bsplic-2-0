import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export interface BetAkoExclusionDraft {
  betId: string;
  title: string;
  reason: string | null;
  id?: string;
}

export interface BetOptionPayload {
  name: string;
  odds: number;
}

interface BetWithAkoExclusionsInput {
  title: string;
  categoryId: string | null;
  betType: string;
  options: BetOptionPayload[];
  endsAt: string;
  isLive: boolean;
  isBsplicboost: boolean;
  exclusions: BetAkoExclusionDraft[];
}

export type CreateBetWithAkoExclusionsInput = BetWithAkoExclusionsInput;

export interface UpdateBetWithAkoExclusionsInput
  extends BetWithAkoExclusionsInput {
  betId: string;
  isActive: boolean;
}

interface BetAkoExclusionRpcRow {
  id?: string;
  betId?: string;
  title?: string;
  reason?: string | null;
}

function toExclusionPayload(exclusions: BetAkoExclusionDraft[]) {
  return exclusions.map((exclusion) => ({
    betId: exclusion.betId,
    reason: exclusion.reason?.trim() || null,
  }));
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
  const p_exclusions = toExclusionPayload(exclusions);

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

export async function createBetWithAkoExclusions(
  input: CreateBetWithAkoExclusionsInput,
): Promise<string> {
  const { data, error } = await supabase.rpc(
    'admin_create_bet_with_ako_exclusions',
    {
      p_title: input.title,
      p_category_id: input.categoryId,
      p_bet_type: input.betType,
      p_options: input.options as unknown as Json,
      p_ends_at: input.endsAt,
      p_is_live: input.isLive,
      p_is_bsplicboost: input.isBsplicboost,
      p_exclusions: toExclusionPayload(input.exclusions) as unknown as Json,
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  if (typeof data !== 'string') {
    throw new Error('Zakład utworzony bez identyfikatora');
  }

  return data;
}

export async function updateBetWithAkoExclusions(
  input: UpdateBetWithAkoExclusionsInput,
): Promise<string> {
  const { data, error } = await supabase.rpc(
    'admin_update_bet_with_ako_exclusions',
    {
      p_bet_id: input.betId,
      p_title: input.title,
      p_category_id: input.categoryId,
      p_bet_type: input.betType,
      p_options: input.options as unknown as Json,
      p_ends_at: input.endsAt,
      p_is_live: input.isLive,
      p_is_bsplicboost: input.isBsplicboost,
      p_is_active: input.isActive,
      p_exclusions: toExclusionPayload(input.exclusions) as unknown as Json,
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  if (typeof data !== 'string') {
    throw new Error('Zakład zaktualizowany bez identyfikatora');
  }

  return data;
}
