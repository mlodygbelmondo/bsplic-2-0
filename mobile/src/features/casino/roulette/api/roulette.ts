import type { RealtimeChannel } from '@supabase/supabase-js';
import { randomUUID } from 'expo-crypto';

import { isOutcomeUnknown } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import type {
  RouletteBetRecord,
  RouletteBetType,
  RouletteColor,
  RouletteRecentWin,
  RouletteRoundParticipant,
  RouletteRoundParticipantBet,
  RouletteTableRound,
} from '@/types/database';

/**
 * Shared roulette table RPCs (port of the web `src/features/casino/api/roulette.ts`).
 * Only the calls the table uses are ported (spec 12a G17): the snapshot, the
 * bet and the client-side round advance.
 */

export const ROULETTE_TABLE_KEY = 'main';
/** 50 spins of history feed the hot/cold + color distribution stats. */
export const ROULETTE_RECENT_SPINS_LIMIT = 50;
const DEFAULT_RECENT_WINS_LIMIT = 20;

export interface RouletteTableSnapshot {
  currentRound: RouletteTableRound | null;
  recentSpins: RouletteTableRound[];
  recentWins: RouletteRecentWin[];
  activeBets: RouletteBetRecord[];
  roundParticipants: RouletteRoundParticipant[];
  /** The player's bets in the newest settled round (result strip and "Powtórz"). */
  lastSettledBets: RouletteBetRecord[];
}

export interface PlaceRouletteBetParams {
  userId: string;
  betType: RouletteBetType;
  betValue: string;
  stake: number;
  tableKey?: string;
}

export async function getRouletteTableSnapshot(
  tableKey = ROULETTE_TABLE_KEY,
  recentSpinsLimit = ROULETTE_RECENT_SPINS_LIMIT,
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

  const snapshot: unknown = Array.isArray(data) ? data[0] : data;
  return normalizeRouletteTableSnapshot(snapshot);
}

/**
 * Places one bet under a fresh request id. A lost response is retried once at
 * once: the server returns the bet the first call created instead of
 * charging twice.
 */
export async function placeRouletteBet({
  userId,
  betType,
  betValue,
  stake,
  tableKey = ROULETTE_TABLE_KEY,
}: PlaceRouletteBetParams): Promise<RouletteBetRecord> {
  const send = () =>
    supabase.rpc('place_roulette_table_bet', {
      p_table_key: tableKey,
      p_user_id: userId,
      p_bet_type: betType,
      p_bet_value: betValue,
      p_stake: Math.round(stake * 100) / 100,
      p_request_id: requestId,
    });
  const requestId = randomUUID();
  let { data, error } = await send();
  if (error && isOutcomeUnknown(error)) ({ data, error } = await send());

  if (error) {
    throw new Error(error.message || 'Nie udało się przyjąć zakładu');
  }

  const bet: unknown = Array.isArray(data) ? data[0] : data;
  if (!bet) {
    throw new Error('Zakład nie został zapisany');
  }

  return normalizeRouletteBet(bet);
}

export async function advanceRouletteRoundIfDue(tableKey = ROULETTE_TABLE_KEY): Promise<void> {
  const { error } = await supabase.rpc('advance_roulette_round_if_due', {
    p_table_key: tableKey,
  });

  if (error) {
    throw new Error(error.message || 'Nie udało się zsynchronizować rundy ruletki');
  }
}

/** Realtime channel name for the table's round changes (web `subscribeToRouletteRounds`). */
export const rouletteRoundsChannelName = (tableKey = ROULETTE_TABLE_KEY) => `casino-roulette-rounds-${tableKey}`;

/** Attaches the round-change listener; the payload is ignored, every change triggers a snapshot read. */
export function listenToRouletteRounds(channel: RealtimeChannel, onChange: () => void, tableKey = ROULETTE_TABLE_KEY) {
  return channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'casino_roulette_rounds',
      filter: `table_key=eq.${tableKey}`,
    },
    () => onChange(),
  );
}

function normalizeRouletteRound(round: unknown): RouletteTableRound | null {
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
      row.winning_number === null || row.winning_number === undefined ? null : Number(row.winning_number),
    winning_color:
      row.winning_color === null || row.winning_color === undefined
        ? null
        : (String(row.winning_color) as RouletteColor),
    created_at: createdAt,
  };
}

function normalizeRouletteBet(bet: unknown): RouletteBetRecord {
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

function normalizeRecentWin(win: unknown): RouletteRecentWin {
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

function normalizeRoundParticipant(participant: unknown): RouletteRoundParticipant {
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

function normalizeRouletteTableSnapshot(snapshot: unknown): RouletteTableSnapshot {
  const row = (snapshot ?? {}) as Record<string, unknown>;

  return {
    currentRound: normalizeRouletteRound(row.current_round),
    recentSpins: normalizeArray(row.recent_spins, normalizeRouletteRound),
    recentWins: normalizeArray(row.recent_wins, normalizeRecentWin),
    activeBets: normalizeArray(row.active_bets, normalizeRouletteBet),
    roundParticipants: normalizeArray(row.round_participants, normalizeRoundParticipant),
    lastSettledBets: normalizeArray(row.last_settled_bets, normalizeRouletteBet),
  };
}

function normalizeArray<T>(value: unknown, normalize: (row: unknown) => T | null): T[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(normalize).filter((item): item is T => Boolean(item));
}

const BET_TYPES: RouletteBetType[] = ['straight', 'color', 'parity', 'range'];

function normalizeParticipantBets(bets: unknown): RouletteRoundParticipantBet[] {
  if (!Array.isArray(bets)) {
    return [];
  }

  return bets
    .map((bet): RouletteRoundParticipantBet | null => {
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
    .filter(
      (bet): bet is RouletteRoundParticipantBet =>
        bet !== null && BET_TYPES.includes(bet.bet_type) && bet.bet_value !== '' && Number.isFinite(bet.stake),
    );
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
