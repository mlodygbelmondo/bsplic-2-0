import { supabase } from '@/integrations/supabase/client';

export interface Card {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  rank: '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
  value: number;
}

export type BlackjackGameStatus = 'betting' | 'playing' | 'won' | 'lost' | 'push';

export interface PlaceBlackjackBetParams {
  userId: string;
  stake: number;
}

export interface SettleBlackjackGameParams {
  gameId: string;
  userId: string;
  status: 'won' | 'lost' | 'push';
  payout: number;
  playerHand: Card[];
  dealerHand: Card[];
}

export interface AddBlackjackStakeParams {
  gameId: string;
  userId: string;
  additionalStake: number;
}

export async function placeBlackjackBet({
  userId,
  stake,
}: PlaceBlackjackBetParams) {
  const { data, error } = await supabase.rpc('place_blackjack_bet', {
    p_user_id: userId,
    p_stake: Math.round(stake * 100) / 100,
  });

  if (error) {
    throw new Error(error.message || 'Nie udało się rozpocząć gry');
  }

  const result = Array.isArray(data) ? data[0] : data;

  if (!result) {
      throw new Error('Brak identyfikatora gry');
  }

  return {
    id: result.id,
    stake: Number(result.stake),
  };
}

export async function settleBlackjackGame({
  gameId,
  userId,
  status,
  payout,
  playerHand,
  dealerHand,
}: SettleBlackjackGameParams) {
  const { error } = await supabase.rpc('settle_blackjack_game', {
    p_game_id: gameId,
    p_user_id: userId,
    p_status: status,
    p_payout: Math.round(payout * 100) / 100,
    p_player_hand: playerHand as unknown as Record<string, unknown>,
    p_dealer_hand: dealerHand as unknown as Record<string, unknown>,
  });

  if (error) {
    throw new Error(error.message || 'Nie udało się zakończyć gry');
  }
}

export async function addBlackjackStake({
  gameId,
  userId,
  additionalStake,
}: AddBlackjackStakeParams) {
  const { data, error } = await supabase.rpc('add_blackjack_stake', {
    p_game_id: gameId,
    p_user_id: userId,
    p_additional_stake: Math.round(additionalStake * 100) / 100,
  });

  if (error) {
    throw new Error(error.message || 'Nie udało się zwiększyć stawki');
  }

  return data;
}
