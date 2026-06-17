import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buyDailyJackpotTicket,
  getDailyJackpotState,
} from './jackpot';

const rpcMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

describe('daily jackpot API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads the jackpot state through the aggregate RPC', async () => {
    rpcMock.mockResolvedValue({
      data: {
        pool_id: 'pool-1',
        pool_date: '2026-06-17',
        status: 'collecting',
        prize_amount: 50,
        ticket_price: 5,
        min_unique_users: 3,
        participant_count: 2,
        ticket_count: 2,
        draw_scheduled_at: '2026-06-17T18:00:00.000Z',
        current_user_has_ticket: false,
        current_user_ticket_number: null,
        winner_user_id: null,
        winner_username: null,
        winner_avatar_url: null,
        winning_ticket_number: null,
        server_now: '2026-06-17T12:00:00.000Z',
      },
      error: null,
    });

    await expect(getDailyJackpotState()).resolves.toMatchObject({
      poolId: 'pool-1',
      prizeAmount: 50,
      participantCount: 2,
    });

    expect(rpcMock).toHaveBeenCalledWith('get_daily_jackpot_state');
  });

  it('buys a ticket through the ticket RPC', async () => {
    rpcMock.mockResolvedValue({ data: { pool_id: 'pool-1' }, error: null });

    await buyDailyJackpotTicket('pool-1');

    expect(rpcMock).toHaveBeenCalledWith('buy_daily_jackpot_ticket', {
      p_pool_id: 'pool-1',
    });
  });

  it('throws RPC errors', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: new Error('Masz już ticket w tej puli'),
    });

    await expect(buyDailyJackpotTicket('pool-1')).rejects.toThrow(
      'Masz już ticket w tej puli',
    );
  });
});
