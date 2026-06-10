import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchAdminDashboardSummary } from './dashboardApi';

const rpcMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
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
});
