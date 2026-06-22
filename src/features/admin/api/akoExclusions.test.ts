import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createBetWithAkoExclusions,
  fetchBetAkoExclusions,
  replaceBetAkoExclusions,
  updateBetWithAkoExclusions,
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

  it('creates a bet and AKO exclusions through one atomic admin RPC', async () => {
    rpcMock.mockResolvedValue({ data: 'bet-1', error: null });

    await expect(
      createBetWithAkoExclusions({
        title: 'Team X wygra mecz',
        categoryId: 'category-1',
        betType: '12',
        options: [{ name: '1', odds: 2 }],
        endsAt: '2030-01-01T12:00:00.000Z',
        isLive: false,
        isBsplicboost: true,
        exclusions: [
          {
            betId: 'bet-2',
            title: 'Team X wygra mapę 1',
            reason: 'Ten sam mecz',
          },
        ],
      }),
    ).resolves.toBe('bet-1');

    expect(rpcMock).toHaveBeenCalledWith(
      'admin_create_bet_with_ako_exclusions',
      {
        p_title: 'Team X wygra mecz',
        p_category_id: 'category-1',
        p_bet_type: '12',
        p_options: [{ name: '1', odds: 2 }],
        p_ends_at: '2030-01-01T12:00:00.000Z',
        p_is_live: false,
        p_is_bsplicboost: true,
        p_exclusions: [{ betId: 'bet-2', reason: 'Ten sam mecz' }],
      },
    );
  });

  it('updates a bet and AKO exclusions through one atomic admin RPC', async () => {
    rpcMock.mockResolvedValue({ data: 'bet-1', error: null });

    await updateBetWithAkoExclusions({
      betId: 'bet-1',
      title: 'Team X wygra mecz',
      categoryId: null,
      betType: 'multi',
      options: [{ name: 'Mapa 1', odds: 1.5 }],
      endsAt: '2030-01-01T12:00:00.000Z',
      isLive: true,
      isBsplicboost: false,
      isActive: true,
      exclusions: [],
    });

    expect(rpcMock).toHaveBeenCalledWith(
      'admin_update_bet_with_ako_exclusions',
      {
        p_bet_id: 'bet-1',
        p_title: 'Team X wygra mecz',
        p_category_id: null,
        p_bet_type: 'multi',
        p_options: [{ name: 'Mapa 1', odds: 1.5 }],
        p_ends_at: '2030-01-01T12:00:00.000Z',
        p_is_live: true,
        p_is_bsplicboost: false,
        p_is_active: true,
        p_exclusions: [],
      },
    );
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
