import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buyDailyJackpotTicket,
  claimDailyJackpotReward,
  getDailyJackpotDraw,
  getDailyJackpotState,
  revealDailyJackpotDraw,
} from './jackpot';
import * as jackpotApi from './jackpot';

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
        ticket_price: 100,
        max_tickets_per_player: 2,
        min_unique_users: 3,
        participant_count: 2,
        ticket_count: 2,
        draw_scheduled_at: '2026-06-17T18:00:00.000Z',
        current_user_has_ticket: false,
        current_user_ticket_count: 0,
        current_user_ticket_number: null,
        winner_user_id: null,
        winner_username: null,
        winner_avatar_url: null,
        winning_ticket_number: null,
        maintenance_auto_credited_count: 2,
        server_now: '2026-06-17T12:00:00.000Z',
      },
      error: null,
    });

    await expect(getDailyJackpotState()).resolves.toMatchObject({
      poolId: 'pool-1',
      prizeAmount: 50,
      ticketPrice: 100,
      maxTicketsPerPlayer: 2,
      participantCount: 2,
      currentUserTicketCount: 0,
      maintenanceAutoCreditedCount: 2,
    });

    expect(rpcMock).toHaveBeenCalledWith('get_daily_jackpot_state');
  });

  it('normalizes an empty jackpot pool explicitly', async () => {
    rpcMock.mockResolvedValue({
      data: {
        pool_id: null,
        pool_date: '2026-06-17',
        status: 'collecting',
        prize_amount: 0,
        ticket_price: 100,
        max_tickets_per_player: 2,
        min_unique_users: 3,
        participant_count: 0,
        ticket_count: 0,
        draw_scheduled_at: '2026-06-17T18:00:00.000Z',
        current_user_has_ticket: false,
        current_user_ticket_count: 0,
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
      poolId: null,
      prizeAmount: 0,
      ticketPrice: 100,
      maxTicketsPerPlayer: 2,
      currentUserTicketCount: 0,
    });
  });

  it('rejects unknown jackpot statuses instead of treating them as collecting', async () => {
    rpcMock.mockResolvedValue({
      data: {
        pool_id: 'pool-1',
        status: 'mystery',
      },
      error: null,
    });

    await expect(getDailyJackpotState()).rejects.toThrow(
      'Nieznany status Jackpotu',
    );
  });

  it('buys a ticket through the ticket RPC', async () => {
    rpcMock.mockResolvedValue({
      data: {
        pool_id: 'pool-1',
        pool_date: '2026-06-17',
        status: 'collecting',
        prize_amount: 50,
        ticket_price: 100,
        max_tickets_per_player: 2,
        min_unique_users: 3,
        participant_count: 2,
        ticket_count: 3,
        draw_scheduled_at: '2026-06-17T18:00:00.000Z',
        current_user_has_ticket: true,
        current_user_ticket_count: 1,
        current_user_ticket_number: 3,
        current_user_ticket_numbers: [3],
        winner_user_id: null,
        winner_username: null,
        winner_avatar_url: null,
        winning_ticket_number: null,
        server_now: '2026-06-17T12:00:00.000Z',
      },
      error: null,
    });

    await expect(buyDailyJackpotTicket('pool-1')).resolves.toMatchObject({
      currentUserTicketNumber: 3,
      currentUserTicketNumbers: [3],
    });

    expect(rpcMock).toHaveBeenCalledWith('buy_daily_jackpot_ticket', {
      p_pool_id: 'pool-1',
    });
  });

  it('loads a draw replay without requiring the client to credit rewards', async () => {
    rpcMock.mockResolvedValue({
      data: {
        pool_id: 'pool-1',
        pool_date: '2026-06-17',
        status: 'drawn',
        prize_amount: 125,
        ticket_price: 100,
        min_unique_users: 3,
        participant_count: 3,
        ticket_count: 4,
        draw_scheduled_at: '2026-06-17T18:00:00.000Z',
        drawn_at: '2026-06-17T18:03:00.000Z',
        winner_user_id: null,
        winner_username: null,
        winner_avatar_url: null,
        winning_ticket_number: null,
        current_user_has_ticket: true,
        current_user_ticket_count: 1,
        current_user_is_winner: false,
        result_viewed_at: null,
        reward_claimed_at: null,
        reward_auto_credited_at: null,
        reward_credit_status: 'pending',
        reward_credit_event_id: null,
        participants: [
          {
            user_id: 'winner-1',
            username: 'LuckyWinner',
            avatar_url: null,
            ticket_numbers: [4],
            ticket_count: 1,
          },
        ],
        server_now: '2026-06-17T18:04:00.000Z',
      },
      error: null,
    });

    await expect(getDailyJackpotDraw('pool-1')).resolves.toMatchObject({
      poolId: 'pool-1',
      currentUserIsWinner: false,
      winnerUserId: null,
      winningTicketNumber: null,
      rewardCreditStatus: 'pending',
      participants: [
        {
          username: 'LuckyWinner',
          ticketNumbers: [4],
        },
      ],
    });

    expect(rpcMock).toHaveBeenCalledWith('get_daily_jackpot_draw', {
      p_pool_id: 'pool-1',
    });
  });

  it('reveals the draw result through the explicit reveal RPC', async () => {
    rpcMock.mockResolvedValue({
      data: {
        pool_id: 'pool-1',
        pool_date: '2026-06-17',
        status: 'drawn',
        prize_amount: 125,
        ticket_price: 100,
        min_unique_users: 3,
        participant_count: 3,
        ticket_count: 4,
        draw_scheduled_at: '2026-06-17T18:00:00.000Z',
        drawn_at: '2026-06-17T18:03:00.000Z',
        winner_user_id: 'winner-1',
        winner_username: 'LuckyWinner',
        winner_avatar_url: null,
        winning_ticket_number: 4,
        current_user_has_ticket: true,
        current_user_ticket_count: 1,
        current_user_is_winner: true,
        result_viewed_at: '2026-06-17T18:04:00.000Z',
        reward_claimed_at: null,
        reward_auto_credited_at: null,
        reward_credit_status: 'pending',
        reward_credit_event_id: null,
        participants: [],
        server_now: '2026-06-17T18:04:00.000Z',
      },
      error: null,
    });

    await expect(revealDailyJackpotDraw('pool-1')).resolves.toMatchObject({
      winnerUserId: 'winner-1',
      winnerUsername: 'LuckyWinner',
      winningTicketNumber: 4,
      currentUserIsWinner: true,
      resultViewedAt: '2026-06-17T18:04:00.000Z',
    });

    expect(rpcMock).toHaveBeenCalledWith('reveal_daily_jackpot_draw', {
      p_pool_id: 'pool-1',
    });
  });

  it('does not expose the revoked viewed wrapper in the client API', () => {
    expect(jackpotApi).not.toHaveProperty('markDailyJackpotResultViewed');
  });

  it('claims the jackpot reward through the idempotent RPC', async () => {
    rpcMock.mockResolvedValue({
      data: {
        pool_id: 'pool-1',
        amount: 125,
        balance_after: 625,
        reward_credit_status: 'claimed',
        reward_claimed_at: '2026-06-17T18:05:00.000Z',
        reward_auto_credited_at: null,
        already_credited: false,
      },
      error: null,
    });

    await expect(claimDailyJackpotReward('pool-1')).resolves.toMatchObject({
      poolId: 'pool-1',
      amount: 125,
      balanceAfter: 625,
      rewardCreditStatus: 'claimed',
      alreadyCredited: false,
    });

    expect(rpcMock).toHaveBeenCalledWith('claim_daily_jackpot_reward', {
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
