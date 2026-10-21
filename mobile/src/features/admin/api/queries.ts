import { queryOptions } from '@tanstack/react-query';

import { PAGE_DATA_QUERY_OPTIONS } from '@/lib/query-client';
import { fetchActiveBets, fetchAllBets } from './bets';
import { fetchAdminDashboardSummary } from './dashboard';

/** Invalidate this prefix after any bet write: refreshes both bet lists. */
export const ADMIN_BETS_KEY = ['admin', 'bets'] as const;

export const adminQueries = {
  dashboard: () =>
    queryOptions({
      queryKey: ['admin', 'dashboard'] as const,
      queryFn: fetchAdminDashboardSummary,
      ...PAGE_DATA_QUERY_OPTIONS,
    }),
  bets: () =>
    queryOptions({
      queryKey: [...ADMIN_BETS_KEY, 'all'] as const,
      queryFn: fetchAllBets,
      ...PAGE_DATA_QUERY_OPTIONS,
    }),
  activeBets: () =>
    queryOptions({
      queryKey: [...ADMIN_BETS_KEY, 'active'] as const,
      queryFn: fetchActiveBets,
      ...PAGE_DATA_QUERY_OPTIONS,
    }),
};
