import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchAdminDashboardSummary, getRelativeTime } from './dashboard';

const rpcMock = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

describe('fetchAdminDashboardSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads dashboard stats and recent activity through one aggregate RPC', async () => {
    rpcMock.mockResolvedValue({
      data: {
        stats: {
          total_bets: 12,
          total_pool: 345.5,
          pending_proposals: 3,
          active_bets: 7,
          resolved_today: 2,
          top_category: '⚽ Football',
        },
        recent_activity: [
          {
            id: 'bet-1',
            title: 'Derby',
            winning_option: 'Home',
            resolved_at: '2026-06-11T10:00:00.000Z',
          },
        ],
      },
      error: null,
    });

    await expect(fetchAdminDashboardSummary()).resolves.toEqual({
      stats: {
        totalBets: 12,
        totalPool: 345.5,
        pendingProposals: 3,
        activeBets: 7,
        resolvedToday: 2,
        topCategory: '⚽ Football',
      },
      recentActivity: [
        {
          id: 'bet-1',
          title: 'Derby',
          winningOption: 'Home',
          resolvedAt: '2026-06-11T10:00:00.000Z',
        },
      ],
    });

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith('admin_get_dashboard_summary');
  });

  it('turns missing or non-numeric stats into zero and an empty top category into null', async () => {
    rpcMock.mockResolvedValue({
      data: { stats: { total_bets: 'abc', top_category: '' } },
      error: null,
    });

    await expect(fetchAdminDashboardSummary()).resolves.toEqual({
      stats: {
        totalBets: 0,
        totalPool: 0,
        pendingProposals: 0,
        activeBets: 0,
        resolvedToday: 0,
        topCategory: null,
      },
      recentActivity: [],
    });
  });

  it('throws the RPC error so the tab can show its toast', async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error('Brak uprawnień') });

    await expect(fetchAdminDashboardSummary()).rejects.toThrow('Brak uprawnień');
  });
});

describe('getRelativeTime', () => {
  const now = Date.parse('2026-10-21T12:00:00.000Z');

  it('uses the web relative-time copy', () => {
    expect(getRelativeTime('2026-10-21T11:59:30.000Z', now)).toBe('teraz');
    expect(getRelativeTime('2026-10-21T11:15:00.000Z', now)).toBe('45 min temu');
    expect(getRelativeTime('2026-10-21T07:00:00.000Z', now)).toBe('5 h temu');
    expect(getRelativeTime('2026-10-20T10:00:00.000Z', now)).toBe('wczoraj');
    expect(getRelativeTime('2026-10-17T12:00:00.000Z', now)).toBe('4 dni temu');
  });
});
