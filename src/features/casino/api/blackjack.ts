import { supabase } from '@/integrations/supabase/client';

export interface Card {
  id?: string;
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  rank:
    | '2'
    | '3'
    | '4'
    | '5'
    | '6'
    | '7'
    | '8'
    | '9'
    | '10'
    | 'J'
    | 'Q'
    | 'K'
    | 'A';
  value: number;
}

export interface BlackjackTableInfo {
  deckCount: number;
  cardsRemaining: number;
  shoeNumber: number;
  handsPlayed: number;
  needsShuffle: boolean;
}

// 'betting' is a client-only state used before a game is started.
export type BlackjackGameStatus =
  | 'betting'
  | 'playing'
  | 'won'
  | 'lost'
  | 'push';
export type BlackjackHandStatus =
  | 'playing'
  | 'stand'
  | 'busted'
  | 'won'
  | 'lost'
  | 'push';

export interface BlackjackHandState {
  id: string;
  cards: Card[];
  stake: number;
  payout: number;
  status: BlackjackHandStatus;
  doubleDownUsed: boolean;
  isSplitAces: boolean;
}

// Mirrors the public.blackjack_game_state composite type from the
// server-authoritative migration. The server hides the dealer's hole card
// while the hand is still in progress.
export interface BlackjackGameState {
  id: string;
  stake: number;
  initialStake: number;
  status: 'playing' | 'won' | 'lost' | 'push';
  playerHand: Card[];
  playerHands: BlackjackHandState[];
  activeHandIndex: number;
  dealerHand: Card[];
  payout: number;
  doubleDownUsed: boolean;
  deckCount: number;
  cardsRemaining: number;
  shoeNumber: number;
  dealerHiddenCount: number;
  createdAt: string;
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
  player_hands?: RawBlackjackHandState[] | null;
  active_hand_index?: number | string | null;
  dealer_hand: Card[] | null;
  payout: number | string;
  double_down_used: boolean;
  deck_count?: number | string | null;
  cards_remaining?: number | string | null;
  shoe_number?: number | string | null;
  dealer_hidden_count?: number | string | null;
  created_at?: string | null;
}

interface RawBlackjackTableInfo {
  deck_count: number | string;
  cards_remaining: number | string;
  shoe_number: number | string;
  hands_played: number | string;
  needs_shuffle: boolean;
}

interface RawBlackjackHandState {
  id?: string | number;
  cards?: Card[] | null;
  stake?: number | string | null;
  payout?: number | string | null;
  status?: BlackjackHandStatus | null;
  doubleDownUsed?: boolean | null;
  double_down_used?: boolean | null;
  isSplitAces?: boolean | null;
  is_split_aces?: boolean | null;
}

function normalizeHand(
  raw: RawBlackjackHandState,
  index: number,
): BlackjackHandState {
  return {
    id: String(raw.id ?? `hand-${index + 1}`),
    cards: Array.isArray(raw.cards) ? raw.cards : [],
    stake: Number(raw.stake ?? 0),
    payout: Number(raw.payout ?? 0),
    status: raw.status ?? 'playing',
    doubleDownUsed: Boolean(raw.doubleDownUsed ?? raw.double_down_used),
    isSplitAces: Boolean(raw.isSplitAces ?? raw.is_split_aces),
  };
}

function normalizeState(raw: unknown): BlackjackGameState {
  const row = (
    Array.isArray(raw) ? raw[0] : raw
  ) as RawBlackjackGameState | null;

  if (!row || !row.id) {
    throw new Error('Brak danych gry');
  }

  const playerHands = Array.isArray(row.player_hands)
    ? row.player_hands.map(normalizeHand)
    : [
        {
          id: 'hand-1',
          cards: Array.isArray(row.player_hand) ? row.player_hand : [],
          stake: Number(row.stake),
          payout: Number(row.payout ?? 0),
          status: row.status === 'playing' ? 'playing' : row.status,
          doubleDownUsed: Boolean(row.double_down_used),
          isSplitAces: false,
        },
      ];

  const activeHandIndex = Math.max(
    0,
    Math.min(
      Number(row.active_hand_index ?? 0),
      Math.max(playerHands.length - 1, 0),
    ),
  );

  return {
    id: row.id,
    stake: Number(row.stake),
    initialStake: Number(row.initial_stake),
    status: row.status,
    playerHand: playerHands[activeHandIndex]?.cards ?? [],
    playerHands,
    activeHandIndex,
    dealerHand: Array.isArray(row.dealer_hand) ? row.dealer_hand : [],
    payout: Number(row.payout ?? 0),
    doubleDownUsed: Boolean(row.double_down_used),
    deckCount: Number(row.deck_count ?? 2),
    cardsRemaining: Number(row.cards_remaining ?? 0),
    shoeNumber: Number(row.shoe_number ?? 1),
    dealerHiddenCount: Number(row.dealer_hidden_count ?? 0),
    createdAt: row.created_at ?? '',
  };
}

function normalizeTableInfo(raw: RawBlackjackTableInfo): BlackjackTableInfo {
  return {
    deckCount: Number(raw.deck_count),
    cardsRemaining: Number(raw.cards_remaining),
    shoeNumber: Number(raw.shoe_number),
    handsPlayed: Number(raw.hands_played),
    needsShuffle: Boolean(raw.needs_shuffle),
  };
}

export async function getBlackjackTableInfo({
  userId,
}: {
  userId: string;
}): Promise<BlackjackTableInfo> {
  const { data, error } = await supabase.rpc('get_blackjack_table_info', {
    p_user_id: userId,
  });

  if (error) {
    throw new Error(error.message || 'Nie udało się pobrać stołu blackjacka');
  }

  const row = (
    Array.isArray(data) ? data[0] : data
  ) as RawBlackjackTableInfo | null;

  if (!row) {
    throw new Error('Brak danych stołu blackjacka');
  }

  return normalizeTableInfo(row);
}

export async function getCurrentBlackjackGame({
  userId,
}: {
  userId: string;
}): Promise<BlackjackGameState | null> {
  const { data, error } = await supabase.rpc('get_current_blackjack_game', {
    p_user_id: userId,
  });

  if (error) {
    throw new Error(error.message || 'Nie udało się wznowić gry blackjacka');
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (!row) {
    return null;
  }

  return normalizeState(row);
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

export async function blackjackSplit({
  gameId,
  userId,
}: BlackjackActionParams): Promise<BlackjackGameState> {
  const { data, error } = await supabase.rpc('blackjack_split', {
    p_game_id: gameId,
    p_user_id: userId,
  });

  if (error) {
    throw new Error(error.message || 'Nie udało się rozdzielić kart');
  }

  return normalizeState(data);
}
