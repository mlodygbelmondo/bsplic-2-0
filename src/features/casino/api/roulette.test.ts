import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getRouletteRoundParticipants,
  getRouletteTableSnapshot,
  placeRouletteBet,
} from './roulette';

const rpcMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

describe('roulette api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an empty participant list when the optional participants RPC is not deployed yet', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        message:
          'Could not find the function public.get_roulette_round_participants(p_round_id) in the schema cache',
      },
    });

    await expect(getRouletteRoundParticipants('round-1')).resolves.toEqual([]);
  });

  it('normalizes participant bet details from the participants RPC', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          user_id: 'user-1',
          username: 'LuckyFox',
          avatar_url: null,
          total_stake: 30,
          bet_count: 2,
          bets: [
            { bet_type: 'color', bet_value: 'red', stake: 20 },
            { bet_type: 'straight', bet_value: '7', stake: 10 },
          ],
        },
      ],
      error: null,
    });

    await expect(getRouletteRoundParticipants('round-1')).resolves.toEqual([
      {
        user_id: 'user-1',
        username: 'LuckyFox',
        avatar_url: null,
        total_stake: 30,
        bet_count: 2,
        bets: [
          { bet_type: 'color', bet_value: 'red', stake: 20 },
          { bet_type: 'straight', bet_value: '7', stake: 10 },
        ],
      },
    ]);
  });

  it('loads the full roulette table through one snapshot RPC', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          current_round: {
            id: 'round-1',
            table_key: 'main',
            round_number: 12,
            phase: 'waiting',
            betting_opens_at: '2026-06-11T10:00:00.000Z',
            betting_closes_at: '2026-06-11T10:00:15.000Z',
            spin_started_at: null,
            settled_at: null,
            winning_number: null,
            winning_color: null,
            created_at: '2026-06-11T10:00:00.000Z',
          },
          recent_spins: [
            {
              id: 'round-0',
              table_key: 'main',
              round_number: 11,
              phase: 'settled',
              betting_opens_at: '2026-06-11T09:59:30.000Z',
              betting_closes_at: '2026-06-11T09:59:45.000Z',
              spin_started_at: '2026-06-11T09:59:45.000Z',
              settled_at: '2026-06-11T09:59:51.000Z',
              winning_number: 7,
              winning_color: 'red',
              created_at: '2026-06-11T09:59:30.000Z',
            },
          ],
          recent_wins: [
            {
              id: 'win-1',
              round_id: 'round-0',
              user_id: 'user-1',
              username: 'LuckyFox',
              avatar_url: null,
              bet_type: 'straight',
              bet_value: '7',
              stake: 5,
              payout: 180,
              is_win: true,
              created_at: '2026-06-11T09:59:35.000Z',
              settled_at: '2026-06-11T09:59:51.000Z',
              round_number: 11,
            },
          ],
          active_bets: [
            {
              id: 'bet-1',
              round_id: 'round-1',
              user_id: 'user-1',
              bet_type: 'color',
              bet_value: 'red',
              stake: 10,
              payout: 0,
              is_win: null,
              created_at: '2026-06-11T10:00:02.000Z',
              settled_at: null,
            },
          ],
          round_participants: [
            {
              user_id: 'user-1',
              username: 'LuckyFox',
              avatar_url: null,
              total_stake: 10,
              bet_count: 1,
              bets: [{ bet_type: 'color', bet_value: 'red', stake: 10 }],
            },
          ],
        },
      ],
      error: null,
    });

    await expect(getRouletteTableSnapshot()).resolves.toMatchObject({
      currentRound: { id: 'round-1', round_number: 12 },
      recentSpins: [{ id: 'round-0', winning_number: 7 }],
      recentWins: [{ id: 'win-1', username: 'LuckyFox', payout: 180 }],
      activeBets: [{ id: 'bet-1', bet_type: 'color', stake: 10 }],
      roundParticipants: [{ user_id: 'user-1', total_stake: 10 }],
    });

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith('get_roulette_table_snapshot', {
      p_table_key: 'main',
      p_recent_spins_limit: 10,
      p_recent_wins_limit: 20,
    });
  });

  it('places a table bet without requiring an existing round id', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          id: 'bet-1',
          round_id: 'round-1',
          user_id: 'user-1',
          bet_type: 'color',
          bet_value: 'red',
          stake: 25,
          payout: 0,
          is_win: null,
          created_at: '2026-06-11T10:00:01.000Z',
          settled_at: null,
        },
      ],
      error: null,
    });

    await expect(
      placeRouletteBet({
        userId: 'user-1',
        betType: 'color',
        betValue: 'red',
        stake: 25,
      }),
    ).resolves.toMatchObject({
      id: 'bet-1',
      round_id: 'round-1',
      bet_type: 'color',
    });

    expect(rpcMock).toHaveBeenCalledWith('place_roulette_table_bet', {
      p_table_key: 'main',
      p_user_id: 'user-1',
      p_bet_type: 'color',
      p_bet_value: 'red',
      p_stake: 25,
    });
  });
});
