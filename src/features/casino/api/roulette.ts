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
  round: RouletteRoundRow | CurrentRoundRpcRow | RecentSpinRpcRow | null,
): RouletteTableRound | null {
  if (!round) {
    return null;
  }

  return {
    id: round.id,
    table_key: round.table_key,
    round_number: Number(round.round_number),
    phase: round.phase as RouletteTableRound['phase'],
    betting_opens_at: round.betting_opens_at,
    betting_closes_at: round.betting_closes_at,
    spin_started_at: round.spin_started_at,
    settled_at: round.settled_at,
    winning_number:
      round.winning_number === null || round.winning_number === undefined
        ? null
        : Number(round.winning_number),
    winning_color:
      round.winning_color === null || round.winning_color === undefined
        ? null
        : (round.winning_color as RouletteColor),
    created_at: round.created_at,
  };
}

function normalizeRouletteBet(bet: RouletteBetRow): RouletteBetRecord {
  return {
    id: bet.id,
    round_id: bet.round_id,
    user_id: bet.user_id,
    bet_type: bet.bet_type as RouletteBetType,
    bet_value: bet.bet_value,
    stake: Number(bet.stake),
    payout: Number(bet.payout),
    is_win: bet.is_win,
    created_at: bet.created_at,
    settled_at: bet.settled_at,
  };
}

function normalizeRecentWin(win: RecentWinRpcRow): RouletteRecentWin {
  return {
    id: win.id,
    round_id: win.round_id,
    user_id: win.user_id,
    username: win.username,
    avatar_url: win.avatar_url,
    bet_type: win.bet_type as RouletteBetType,
    bet_value: win.bet_value,
    stake: Number(win.stake),
    payout: Number(win.payout),
    is_win: win.is_win,
    created_at: win.created_at,
    settled_at: win.settled_at,
    round_number: Number(win.round_number),
  };
}

function normalizeRoundParticipant(
  participant: RoundParticipantRpcRow,
): RouletteRoundParticipant {
  return {
    user_id: participant.user_id,
    username: participant.username,
    avatar_url: participant.avatar_url,
    total_stake: Number(participant.total_stake),
    bet_count: Number(participant.bet_count),
    bets: normalizeParticipantBets(participant.bets),
  };
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
