import { supabase } from '@/integrations/supabase/client';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

import type { Database } from '@/integrations/supabase/types';
import type {
  RouletteBetRecord,
  RouletteBetType,
  RouletteColor,
  RouletteRecentWin,
  RouletteRoundParticipantBet,
  RouletteRoundParticipant,
  RouletteTableRound,
} from '@/types/database';

interface PlaceRouletteBetParams {
  roundId: string;
  userId: string;
  betType: RouletteBetType;
  betValue: string;
  stake: number;
}

const DEFAULT_TABLE_KEY = 'main';
const DEFAULT_RECENT_SPINS_LIMIT = 10;
const DEFAULT_RECENT_WINS_LIMIT = 20;

type LegacyPlayRouletteRoundRow =
  Database['public']['Functions']['play_roulette_round']['Returns'][number];
type RouletteRoundRow = Database['public']['Tables']['casino_roulette_rounds']['Row'];
type RouletteBetRow = Database['public']['Tables']['casino_roulette_bets']['Row'];
type CurrentRoundRpcRow =
  Database['public']['Functions']['get_current_roulette_round']['Returns'][number] | null;
type RecentSpinRpcRow =
  Database['public']['Functions']['get_recent_roulette_spins']['Returns'][number];
type RecentWinRpcRow =
  Database['public']['Functions']['get_recent_roulette_wins']['Returns'][number];
type RoundParticipantRpcRow =
  Database['public']['Functions']['get_roulette_round_participants']['Returns'][number] & {
    bets?: unknown;
  };
type RouletteSnapshotRpcRow =
  Database['public']['Functions']['get_roulette_table_snapshot']['Returns'][number];

export interface RouletteTableSnapshot {
  currentRound: RouletteTableRound | null;
  recentSpins: RouletteTableRound[];
  recentWins: RouletteRecentWin[];
  activeBets: RouletteBetRecord[];
  roundParticipants: RouletteRoundParticipant[];
}

export async function playRouletteRoundLegacy({
  userId,
  betType,
  betValue,
  stake,
}: {
  userId: string;
  betType: RouletteBetType;
  betValue: string;
  stake: number;
}) {
  const { data, error } = await supabase.rpc('play_roulette_round', {
    p_user_id: userId,
    p_bet_type: betType,
    p_bet_value: betValue,
    p_stake: Math.round(stake * 100) / 100,
  });

  if (error) {
    throw new Error(error.message || 'Nie udało się rozegrać rundy ruletki');
  }

  const round = Array.isArray(data) ? data[0] : data;

  if (!round) {
    throw new Error('Nie udało się odebrać wyniku rundy');
  }

  return round as LegacyPlayRouletteRoundRow;
}

export async function getCurrentRouletteRound(
  tableKey = DEFAULT_TABLE_KEY,
): Promise<RouletteTableRound | null> {
  const { data, error } = await supabase.rpc('get_current_roulette_round', {
    p_table_key: tableKey,
  });

  if (error) {
    throw new Error(error.message || 'Nie udało się pobrać bieżącej rundy ruletki');
  }

  const round = Array.isArray(data) ? data[0] : data;
  return normalizeRouletteRound(round as CurrentRoundRpcRow);
}

export async function getRecentRouletteSpins(
  tableKey = DEFAULT_TABLE_KEY,
  limit = 10,
): Promise<RouletteTableRound[]> {
  const { data, error } = await supabase.rpc('get_recent_roulette_spins', {
    p_table_key: tableKey,
    p_limit: limit,
  });

  if (error) {
    throw new Error(error.message || 'Nie udało się pobrać historii spinów');
  }

  return (data ?? []).map((round) => normalizeRouletteRound(round as RecentSpinRpcRow)).filter(Boolean) as RouletteTableRound[];
}

export async function getRecentRouletteWins(
  tableKey = DEFAULT_TABLE_KEY,
  limit = 20,
): Promise<RouletteRecentWin[]> {
  const { data, error } = await supabase.rpc('get_recent_roulette_wins', {
    p_table_key: tableKey,
    p_limit: limit,
  });

  if (error) {
    throw new Error(error.message || 'Nie udało się pobrać ostatnich wygranych');
  }

  return (data ?? []).map((win) => normalizeRecentWin(win as RecentWinRpcRow));
}

export async function getMyCurrentRouletteBets(
  roundId: string,
): Promise<RouletteBetRecord[]> {
  const { data, error } = await supabase.rpc('get_my_current_roulette_bets', {
    p_round_id: roundId,
  });

  if (error) {
    throw new Error(error.message || 'Nie udało się pobrać Twoich zakładów');
  }

  return (data ?? []).map((bet) => normalizeRouletteBet(bet as RouletteBetRow));
}

export async function getRouletteRoundParticipants(
  roundId: string,
): Promise<RouletteRoundParticipant[]> {
  const { data, error } = await supabase.rpc('get_roulette_round_participants', {
    p_round_id: roundId,
  });

  if (error) {
    if (error.message?.includes('get_roulette_round_participants')) {
      return [];
    }
    throw new Error(error.message || 'Nie udało się pobrać graczy rundy');
  }

  return ((data ?? []) as RoundParticipantRpcRow[]).map(normalizeRoundParticipant);
}

export async function getRouletteTableSnapshot(
  tableKey = DEFAULT_TABLE_KEY,
  recentSpinsLimit = DEFAULT_RECENT_SPINS_LIMIT,
  recentWinsLimit = DEFAULT_RECENT_WINS_LIMIT,
): Promise<RouletteTableSnapshot> {
  const { data, error } = await supabase.rpc('get_roulette_table_snapshot', {
    p_table_key: tableKey,
    p_recent_spins_limit: recentSpinsLimit,
    p_recent_wins_limit: recentWinsLimit,
  });

  if (error) {
    throw new Error(error.message || 'Nie udało się pobrać stanu stołu ruletki');
  }

  const snapshot = Array.isArray(data) ? data[0] : data;
  return normalizeRouletteTableSnapshot(snapshot as RouletteSnapshotRpcRow | null);
}

export async function placeRouletteBet({
  roundId,
  userId,
  betType,
  betValue,
  stake,
}: PlaceRouletteBetParams): Promise<RouletteBetRecord> {
  const { data, error } = await supabase.rpc('place_roulette_bet', {
    p_round_id: roundId,
    p_user_id: userId,
    p_bet_type: betType,
    p_bet_value: betValue,
    p_stake: Math.round(stake * 100) / 100,
  });

  if (error) {
    throw new Error(error.message || 'Nie udało się przyjąć zakładu');
  }

  const bet = Array.isArray(data) ? data[0] : data;

  if (!bet) {
    throw new Error('Zakład nie został zapisany');
  }

  return normalizeRouletteBet(bet as RouletteBetRow);
}

export async function advanceRouletteRoundIfDue(
  tableKey = DEFAULT_TABLE_KEY,
): Promise<void> {
  const { error } = await supabase.rpc('advance_roulette_round_if_due', {
    p_table_key: tableKey,
  });

  if (error) {
    throw new Error(error.message || 'Nie udało się zsynchronizować rundy ruletki');
  }
}

export function subscribeToRouletteRounds(
  onChange: () => void,
  tableKey = DEFAULT_TABLE_KEY,
) {
  const channel = supabase
    .channel(`casino-roulette-rounds-${tableKey}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'casino_roulette_rounds',
        filter: `table_key=eq.${tableKey}`,
      },
      (_payload: RealtimePostgresChangesPayload<RouletteRoundRow>) => onChange(),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

function normalizeRouletteRound(
  round: RouletteRoundRow | CurrentRoundRpcRow | RecentSpinRpcRow | unknown,
): RouletteTableRound | null {
  if (!round || typeof round !== 'object') {
    return null;
  }

  const row = round as Record<string, unknown>;
  const id = getRequiredString(row, 'id');
  const tableKey = getRequiredString(row, 'table_key');
  const phase = getRequiredString(row, 'phase');
  const bettingOpensAt = getRequiredString(row, 'betting_opens_at');
  const bettingClosesAt = getRequiredString(row, 'betting_closes_at');
  const createdAt = getRequiredString(row, 'created_at');

  if (!id || !tableKey || !phase || !bettingOpensAt || !bettingClosesAt || !createdAt) {
    return null;
  }

  return {
    id,
    table_key: tableKey,
    round_number: Number(row.round_number),
    phase: phase as RouletteTableRound['phase'],
    betting_opens_at: bettingOpensAt,
    betting_closes_at: bettingClosesAt,
    spin_started_at: getNullableString(row, 'spin_started_at'),
    settled_at: getNullableString(row, 'settled_at'),
    winning_number:
      row.winning_number === null || row.winning_number === undefined
        ? null
        : Number(row.winning_number),
    winning_color:
      row.winning_color === null || row.winning_color === undefined
        ? null
        : (String(row.winning_color) as RouletteColor),
    created_at: createdAt,
  };
}

function normalizeRouletteBet(bet: RouletteBetRow | unknown): RouletteBetRecord {
  const row = (bet ?? {}) as Record<string, unknown>;

  return {
    id: getRequiredString(row, 'id'),
    round_id: getRequiredString(row, 'round_id'),
    user_id: getNullableString(row, 'user_id') ?? undefined,
    bet_type: getRequiredString(row, 'bet_type') as RouletteBetType,
    bet_value: getRequiredString(row, 'bet_value'),
    stake: Number(row.stake),
    payout: Number(row.payout),
    is_win: typeof row.is_win === 'boolean' ? row.is_win : null,
    created_at: getRequiredString(row, 'created_at'),
    settled_at: getNullableString(row, 'settled_at'),
  };
}

function normalizeRecentWin(win: RecentWinRpcRow | unknown): RouletteRecentWin {
  const row = (win ?? {}) as Record<string, unknown>;

  return {
    id: getRequiredString(row, 'id'),
    round_id: getRequiredString(row, 'round_id'),
    user_id: getRequiredString(row, 'user_id'),
    username: getRequiredString(row, 'username'),
    avatar_url: getNullableString(row, 'avatar_url'),
    bet_type: getRequiredString(row, 'bet_type') as RouletteBetType,
    bet_value: getRequiredString(row, 'bet_value'),
    stake: Number(row.stake),
    payout: Number(row.payout),
    is_win: typeof row.is_win === 'boolean' ? row.is_win : null,
    created_at: getRequiredString(row, 'created_at'),
    settled_at: getNullableString(row, 'settled_at'),
    round_number: Number(row.round_number),
  };
}

function normalizeRoundParticipant(
  participant: RoundParticipantRpcRow | unknown,
): RouletteRoundParticipant {
  const row = (participant ?? {}) as Record<string, unknown>;

  return {
    user_id: getRequiredString(row, 'user_id'),
    username: getRequiredString(row, 'username'),
    avatar_url: getNullableString(row, 'avatar_url'),
    total_stake: Number(row.total_stake),
    bet_count: Number(row.bet_count),
    bets: normalizeParticipantBets(row.bets),
  };
}

function normalizeRouletteTableSnapshot(
  snapshot: RouletteSnapshotRpcRow | null,
): RouletteTableSnapshot {
  const row = (snapshot ?? {}) as Record<string, unknown>;

  return {
    currentRound: normalizeRouletteRound(row.current_round),
    recentSpins: normalizeArray(row.recent_spins, normalizeRouletteRound),
    recentWins: normalizeArray(row.recent_wins, normalizeRecentWin),
    activeBets: normalizeArray(row.active_bets, normalizeRouletteBet),
    roundParticipants: normalizeArray(row.round_participants, normalizeRoundParticipant),
  };
}

function normalizeArray<T>(
  value: unknown,
  normalize: (row: unknown) => T | null,
): T[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(normalize).filter((item): item is T => Boolean(item));
}

function normalizeParticipantBets(bets: unknown): RouletteRoundParticipantBet[] {
  if (!Array.isArray(bets)) {
    return [];
  }

  return bets
    .map((bet) => {
      if (!bet || typeof bet !== 'object') {
        return null;
      }

      const rawBet = bet as Record<string, unknown>;
      return {
        bet_type: rawBet.bet_type as RouletteBetType,
        bet_value: String(rawBet.bet_value ?? ''),
        stake: Number(rawBet.stake),
      };
    })
    .filter((bet): bet is RouletteRoundParticipantBet => (
      Boolean(bet)
      && ['straight', 'color', 'parity', 'range'].includes(bet.bet_type)
      && bet.bet_value !== ''
      && Number.isFinite(bet.stake)
    ));
}

function getRequiredString(row: Record<string, unknown>, key: string) {
  const value = row[key];
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return '';
}

function getNullableString(row: Record<string, unknown>, key: string) {
  const value = row[key];
  if (value === null || value === undefined) {
    return null;
  }
  return typeof value === 'string' ? value : String(value);
}
