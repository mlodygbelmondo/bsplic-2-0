import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query';

import { PAGE_DATA_QUERY_OPTIONS } from '@/lib/query-client';

import { fetchAkoExclusionsForBets } from '../ako-exclusion-api';
import type { AkoExclusion } from '../ako-exclusions';

const NO_EXCLUSIONS: AkoExclusion[] = [];

export const akoExclusionsQueryOptions = (betIds: string[]) => {
  const ids = Array.from(new Set(betIds)).filter(Boolean).sort();
  return queryOptions({
    queryKey: ['coupon', 'ako-exclusions', ids],
    queryFn: () => fetchAkoExclusionsForBets(ids),
    enabled: ids.length >= 2,
    ...PAGE_DATA_QUERY_OPTIONS,
  });
};

/**
 * Exclusion pairs among the selected bets, fetched on either tab once two or
 * more bets are selected (web `CouponDrawer` effect). A failed fetch counts as
 * no exclusions, like the web; the server still blocks the AKO.
 */
export function useAkoExclusions(betIds: string[]): AkoExclusion[] {
  const options = akoExclusionsQueryOptions(betIds);
  // Keep the previous pairs while a changed selection loads, like the web: a
  // conflict between bets still selected keeps blocking the AKO.
  const { data } = useQuery({ ...options, placeholderData: keepPreviousData });
  return options.enabled && data ? data : NO_EXCLUSIONS;
}
