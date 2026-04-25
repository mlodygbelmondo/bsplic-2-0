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
});
