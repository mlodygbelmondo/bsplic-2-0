import { queryOptions } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { parseSpin, parseState, type PendingSpin, type SlotGame, type SlotSpin } from './model';

/**
 * Live slot state (free spins, locked bonus stake, last 10 spins). Lives under
 * the non-persisted `slots-live` root and is dropped as soon as the screen
 * unmounts, so a free-spin count is never replayed from a cache.
 */
export const slotStateQuery = (userId: string | null, game: SlotGame) =>
  queryOptions({
    queryKey: ['slots-live', userId, game] as const,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('casino_slot_state', { p_game: game });
      if (error) throw error;
      return parseState(data);
    },
    enabled: Boolean(userId),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    // Foreground = React Query focus (AppState): resync with the server.
    refetchOnWindowFocus: 'always',
  });

export const slotStateRootKey = (userId: string) => ['slots-live', userId] as const;

export class SlotRpcError extends Error {
  code: string | undefined;
  constructor(message: string, code: string | undefined) {
    super(message);
    this.name = 'SlotRpcError';
    this.code = code;
  }
}

/** Sends (or re-sends) one idempotent spin request; the server returns the stored result for a known id. */
export async function requestSpin(game: SlotGame, request: PendingSpin): Promise<SlotSpin> {
  const { data, error } = await supabase.rpc(request.bonusOnly ? 'casino_slot_bonus_spin' : 'casino_slot_spin', {
    p_game: game,
    p_stake: request.stake,
    p_request_id: request.id,
  });
  if (error) throw new SlotRpcError(error.message, error.code);
  return parseSpin(data);
}
