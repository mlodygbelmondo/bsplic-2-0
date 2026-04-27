import { supabase } from '@/integrations/supabase/client';

export interface Card {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  rank: '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
  value: number;
}

// 'betting' is a client-only state used before a game is started.
export type BlackjackGameStatus = 'betting' | 'playing' | 'won' | 'lost' | 'push';

// Mirrors the public.blackjack_game_state composite type from the
// server-authoritative migration. The server hides the dealer's hole card
// while the hand is still in progress.
export interface BlackjackGameState {
  id: string;
  stake: number;
  initialStake: number;
  status: 'playing' | 'won' | 'lost' | 'push';
  playerHand: Card[];
  dealerHand: Card[];
  payout: number;
  doubleDownUsed: boolean;
}

export interface PlaceBlackjackBetParams {
  userId: string;
  stake: number;
}

export interface BlackjackActionParams {
  gameId: string;
  userId: string;
}

interface RawBlackjackGameState {
  id: string;
  stake: number | string;
  initial_stake: number | string;
  status: 'playing' | 'won' | 'lost' | 'push';
  player_hand: Card[] | null;
  dealer_hand: Card[] | null;
  payout: number | string;
  double_down_used: boolean;
}

function normalizeState(raw: unknown): BlackjackGameState {
  const row = (Array.isArray(raw) ? raw[0] : raw) as RawBlackjackGameState | null;

  if (!row || !row.id) {
    throw new Error('Brak danych gry');
  }

  return {
    id: row.id,
    stake: Number(row.stake),
    initialStake: Number(row.initial_stake),
    status: row.status,
    playerHand: Array.isArray(row.player_hand) ? row.player_hand : [],
    dealerHand: Array.isArray(row.dealer_hand) ? row.dealer_hand : [],
    payout: Number(row.payout ?? 0),
    doubleDownUsed: Boolean(row.double_down_used),
  };
}

export async function placeBlackjackBet({
  userId,
  stake,
}: PlaceBlackjackBetParams): Promise<BlackjackGameState> {
  const { data, error } = await supabase.rpc('place_blackjack_bet', {
    p_user_id: userId,
    p_stake: Math.round(stake * 100) / 100,
  });

  if (error) {
    throw new Error(error.message || 'Nie udało się rozpocząć gry');
  }

  return normalizeState(data);
}

export async function blackjackHit({
  gameId,
  userId,
}: BlackjackActionParams): Promise<BlackjackGameState> {
  const { data, error } = await supabase.rpc('blackjack_hit', {
    p_game_id: gameId,
    p_user_id: userId,
  });

  if (error) {
    throw new Error(error.message || 'Nie udało się dobrać karty');
  }

  return normalizeState(data);
}

export async function blackjackStand({
  gameId,
  userId,
}: BlackjackActionParams): Promise<BlackjackGameState> {
  const { data, error } = await supabase.rpc('blackjack_stand', {
    p_game_id: gameId,
    p_user_id: userId,
  });

  if (error) {
    throw new Error(error.message || 'Nie udało się zakończyć gry');
  }

  return normalizeState(data);
}

export async function blackjackDoubleDown({
  gameId,
  userId,
}: BlackjackActionParams): Promise<BlackjackGameState> {
  const { data, error } = await supabase.rpc('blackjack_double_down', {
    p_game_id: gameId,
    p_user_id: userId,
  });

  if (error) {
    throw new Error(error.message || 'Nie udało się podwoić stawki');
  }

  return normalizeState(data);
}
