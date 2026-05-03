import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getBlackjackTableInfo,
  getCurrentBlackjackGame,
  blackjackDeclineInsurance,
  blackjackTakeInsurance,
  placeBlackjackBet,
} from './blackjack';

const rpcMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

describe('blackjack api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads the current game through the safe resume RPC and normalizes table metadata', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          id: 'game-1',
          stake: '10.00',
          initial_stake: '10.00',
          status: 'playing',
          player_hand: [
            { id: 'shoe-2-card-1', suit: 'hearts', rank: '8', value: 8 },
          ],
          player_hands: [
            {
              id: 'hand-1',
              cards: [
                { id: 'shoe-2-card-1', suit: 'hearts', rank: '8', value: 8 },
              ],
              stake: '10.00',
              payout: '0.00',
              status: 'playing',
              doubleDownUsed: false,
              isSplitAces: false,
            },
          ],
          active_hand_index: 0,
          dealer_hand: [
            { id: 'shoe-2-card-2', suit: 'clubs', rank: 'K', value: 10 },
          ],
          payout: '0.00',
          double_down_used: false,
          deck_count: 2,
          cards_remaining: 99,
          shoe_number: 2,
          dealer_hidden_count: 1,
          created_at: '2026-05-03T12:00:00.000Z',
        },
      ],
      error: null,
    });

    await expect(
      getCurrentBlackjackGame({ userId: 'user-1' }),
    ).resolves.toMatchObject({
      id: 'game-1',
      status: 'playing',
      deckCount: 2,
      cardsRemaining: 99,
      shoeNumber: 2,
      dealerHiddenCount: 1,
      createdAt: '2026-05-03T12:00:00.000Z',
    });

    expect(rpcMock).toHaveBeenCalledWith('get_current_blackjack_game', {
      p_user_id: 'user-1',
    });
  });

  it('normalizes an insurance offer without exposing the dealer hole card', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          id: 'game-insurance',
          stake: '20.00',
          initial_stake: '20.00',
          status: 'insurance',
          player_hand: [
            { id: 'shoe-3-card-1', suit: 'hearts', rank: '9', value: 9 },
            { id: 'shoe-3-card-3', suit: 'clubs', rank: '7', value: 7 },
          ],
          player_hands: [
            {
              id: 'hand-1',
              cards: [
                { id: 'shoe-3-card-1', suit: 'hearts', rank: '9', value: 9 },
                { id: 'shoe-3-card-3', suit: 'clubs', rank: '7', value: 7 },
              ],
              stake: '20.00',
              payout: '0.00',
              status: 'playing',
              doubleDownUsed: false,
              isSplitAces: false,
            },
          ],
          active_hand_index: 0,
          dealer_hand: [
            { id: 'shoe-3-card-2', suit: 'spades', rank: 'A', value: 11 },
          ],
          payout: '0.00',
          double_down_used: false,
          deck_count: 2,
          cards_remaining: 100,
          shoe_number: 3,
          dealer_hidden_count: 1,
          created_at: '2026-05-03T12:10:00.000Z',
          insurance_status: 'offered',
          insurance_stake: '0.00',
          insurance_payout: '0.00',
        },
      ],
      error: null,
    });

    await expect(
      getCurrentBlackjackGame({ userId: 'user-1' }),
    ).resolves.toMatchObject({
      id: 'game-insurance',
      status: 'insurance',
      dealerHand: [
        { id: 'shoe-3-card-2', suit: 'spades', rank: 'A', value: 11 },
      ],
      dealerHiddenCount: 1,
      insuranceStatus: 'offered',
      insuranceStake: 10,
      insurancePayout: 0,
    });
  });

  it('returns null when there is no active blackjack game to resume', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });

    await expect(
      getCurrentBlackjackGame({ userId: 'user-1' }),
    ).resolves.toBeNull();
  });

  it('loads private table shoe info without exposing future cards', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          deck_count: 2,
          cards_remaining: 78,
          shoe_number: 4,
          hands_played: 11,
          needs_shuffle: false,
        },
      ],
      error: null,
    });

    await expect(getBlackjackTableInfo({ userId: 'user-1' })).resolves.toEqual({
      deckCount: 2,
      cardsRemaining: 78,
      shoeNumber: 4,
      handsPlayed: 11,
      needsShuffle: false,
    });

    expect(rpcMock).toHaveBeenCalledWith('get_blackjack_table_info', {
      p_user_id: 'user-1',
    });
  });

  it('normalizes persistent shoe metadata returned after starting a new hand', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          id: 'game-2',
          stake: 25,
          initial_stake: 25,
          status: 'playing',
          player_hand: [],
          player_hands: [],
          active_hand_index: 0,
          dealer_hand: [],
          payout: 0,
          double_down_used: false,
          deck_count: 2,
          cards_remaining: 100,
          shoe_number: 5,
          dealer_hidden_count: 1,
          created_at: '2026-05-03T12:05:00.000Z',
        },
      ],
      error: null,
    });

    await expect(
      placeBlackjackBet({ userId: 'user-1', stake: 25 }),
    ).resolves.toMatchObject({
      id: 'game-2',
      deckCount: 2,
      cardsRemaining: 100,
      shoeNumber: 5,
      dealerHiddenCount: 1,
    });
  });

  it('calls the take and decline insurance RPCs', async () => {
    const state = {
      id: 'game-insurance',
      stake: 20,
      initial_stake: 20,
      status: 'playing',
      player_hand: [],
      player_hands: [],
      active_hand_index: 0,
      dealer_hand: [],
      payout: 0,
      double_down_used: false,
      deck_count: 2,
      cards_remaining: 100,
      shoe_number: 3,
      dealer_hidden_count: 1,
      created_at: '2026-05-03T12:10:00.000Z',
      insurance_status: 'lost',
      insurance_stake: 10,
      insurance_payout: 0,
    };
    rpcMock.mockResolvedValue({ data: [state], error: null });

    await blackjackTakeInsurance({
      gameId: 'game-insurance',
      userId: 'user-1',
    });
    expect(rpcMock).toHaveBeenCalledWith('blackjack_take_insurance', {
      p_game_id: 'game-insurance',
      p_user_id: 'user-1',
    });

    await blackjackDeclineInsurance({
      gameId: 'game-insurance',
      userId: 'user-1',
    });
    expect(rpcMock).toHaveBeenCalledWith('blackjack_decline_insurance', {
      p_game_id: 'game-insurance',
      p_user_id: 'user-1',
    });
  });
});
