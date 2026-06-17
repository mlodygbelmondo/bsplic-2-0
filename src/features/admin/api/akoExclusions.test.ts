import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fetchBetAkoExclusions,
  replaceBetAkoExclusions,
} from './akoExclusions';

const rpcMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

describe('admin AKO exclusions API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads exclusions through the admin RPC', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          id: 'row-1',
          betId: 'bet-2',
          title: 'Team X wygra mecz',
          reason: 'Ten sam mecz',
        },
      ],
      error: null,
    });

    await expect(fetchBetAkoExclusions('bet-1')).resolves.toEqual([
      {
        id: 'row-1',
        betId: 'bet-2',
        title: 'Team X wygra mecz',
        reason: 'Ten sam mecz',
      },
    ]);

    expect(rpcMock).toHaveBeenCalledWith('admin_get_bet_ako_exclusions', {
      p_bet_id: 'bet-1',
    });
  });

  it('replaces exclusions through one atomic admin RPC', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });

    await expect(
      replaceBetAkoExclusions('bet-1', [
        {
          betId: 'bet-2',
          title: 'Team X wygra mecz',
          reason: '  Ten sam mecz  ',
        },
      ]),
    ).resolves.toEqual([]);

    expect(rpcMock).toHaveBeenCalledWith('admin_replace_bet_ako_exclusions', {
      p_bet_id: 'bet-1',
      p_exclusions: [{ betId: 'bet-2', reason: 'Ten sam mecz' }],
    });
  });

  it('throws RPC errors', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: new Error('Brak uprawnień administratora'),
    });

    await expect(fetchBetAkoExclusions('bet-1')).rejects.toThrow(
      'Brak uprawnień administratora',
    );
  });
});
