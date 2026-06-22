import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DailyJackpotSnapshot } from '../types';

import { useDailyJackpot } from './useDailyJackpot';

const getDailyJackpotStateMock = vi.fn();
const buyDailyJackpotTicketMock = vi.fn();
const refreshProfileMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    profile: { id: 'user-1', balance: 500 },
    refreshProfile: refreshProfileMock,
  }),
}));

vi.mock('../api/jackpot', () => ({
  getDailyJackpotState: (...args: unknown[]) =>
    getDailyJackpotStateMock(...args),
  buyDailyJackpotTicket: (...args: unknown[]) =>
    buyDailyJackpotTicketMock(...args),
}));

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

const snapshot: DailyJackpotSnapshot = {
  poolId: 'pool-1',
  poolDate: '2026-06-21',
  status: 'collecting',
  prizeAmount: 2480.75,
  ticketPrice: 100,
  maxTicketsPerPlayer: 2,
  minUniqueUsers: 3,
  participantCount: 18,
  ticketCount: 32,
  drawScheduledAt: '2026-06-21T18:00:00.000Z',
  currentUserHasTicket: true,
  currentUserTicketCount: 1,
  currentUserTicketNumber: 14,
  currentUserTicketNumbers: [14],
  winnerUserId: null,
  winnerUsername: null,
  winnerAvatarUrl: null,
  winningTicketNumber: null,
  maintenanceAutoCreditedCount: 0,
  serverNow: '2026-06-21T12:00:00.000Z',
};

describe('useDailyJackpot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDailyJackpotStateMock.mockResolvedValue(snapshot);
    buyDailyJackpotTicketMock.mockResolvedValue({
      ...snapshot,
      currentUserTicketCount: 2,
      currentUserTicketNumbers: [14, 22],
      ticketCount: 33,
    });
    refreshProfileMock.mockResolvedValue(undefined);
  });

  it('confirms the newly bought ticket number', async () => {
    const { result } = renderHook(() => useDailyJackpot());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.buyTicket();
    });

    expect(buyDailyJackpotTicketMock).toHaveBeenCalledWith('pool-1');
    expect(toastSuccessMock).toHaveBeenCalledWith('Ticket #22 kupiony!');
  });

  it('refreshes the visible balance when state maintenance auto-credits rewards', async () => {
    getDailyJackpotStateMock.mockResolvedValue({
      ...snapshot,
      currentUserHasTicket: false,
      maintenanceAutoCreditedCount: 1,
    });

    const { result } = renderHook(() => useDailyJackpot());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(refreshProfileMock).toHaveBeenCalledTimes(1);
  });
});
