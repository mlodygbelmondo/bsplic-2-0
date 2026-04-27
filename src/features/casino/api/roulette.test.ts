import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getRouletteRoundParticipants } from './roulette';

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
        message: 'Could not find the function public.get_roulette_round_participants(p_round_id) in the schema cache',
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
});
