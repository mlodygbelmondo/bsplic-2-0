import { beforeEach, describe, expect, it, vi } from 'vitest';

import { settleBetWithBackend } from './settlementApi';

const rpcMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

describe('settleBetWithBackend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('settles through the canonical admin RPC', async () => {
    rpcMock.mockResolvedValue({
      data: {
        bet_id: 'bet-1',
        updated_leg_count: 3,
      },
      error: null,
    });

    await expect(
      settleBetWithBackend({
        betId: 'bet-1',
        winningOptionNames: ['Legia', 'Lech'],
        mode: 'normal',
        scope: 'all',
      }),
    ).resolves.toEqual({
      bet_id: 'bet-1',
      updated_leg_count: 3,
    });

    expect(rpcMock).toHaveBeenCalledWith('admin_settle_bet', {
      p_bet_id: 'bet-1',
      p_winning_options: ['Legia', 'Lech'],
      p_mode: 'normal',
      p_scope: 'all',
    });
  });

  it('throws the RPC error so the UI can show a toast', async () => {
    const error = new Error('Brak uprawnień');
    rpcMock.mockResolvedValue({ data: null, error });

    await expect(
      settleBetWithBackend({
        betId: 'bet-1',
        winningOptionNames: [],
        mode: 'refund',
      }),
    ).rejects.toThrow('Brak uprawnień');
  });
});
