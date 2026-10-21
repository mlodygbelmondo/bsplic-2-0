import { infiniteQueryOptions } from '@tanstack/react-query';

import { PAGE_DATA_QUERY_OPTIONS } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';
import type { Bet } from '@/types/database';
import { getNextBetsOffset } from '../logic/bet-sections';
import type { BetsPage } from '../logic/bets-realtime';
import type { SortMode } from '../logic/sort-bets';

export type { BetsPage } from '../logic/bets-realtime';

export const ACTIVE_BETS_PAGE_SIZE = 80;

/** Root of every home bet list query; realtime updates patch all of them. */
export const BETS_QUERY_ROOT = ['home', 'bets'] as const;

export interface BetsCriteria {
  category: string | null;
  sort: SortMode;
  /** Aktywne off: also show bets past `ends_at` that wait for settlement. */
  includeInProgress: boolean;
}

/** Web `fetchActiveBets` (`src/features/home/api/bets.ts`). */
export async function fetchActiveBets(criteria: BetsCriteria, limit: number, offset: number): Promise<Bet[]> {
  let query = supabase.from('bets').select('*').eq('is_active', true);

  if (!criteria.includeInProgress) {
    query = query.gt('ends_at', new Date().toISOString());
  }

  if (criteria.category) {
    query = query.eq('category_id', criteria.category);
  }

  if (criteria.sort === 'popular') {
    query = query.order('bet_count', { ascending: false }).order('created_at', { ascending: false });
  } else if (criteria.sort === 'ending_soon') {
    query = query.order('ends_at', { ascending: true }).order('created_at', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const { data, error } = await query.range(offset, offset + limit - 1);
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []) as unknown as Bet[];
}

/** Asks for one row more than a page; its presence means another page exists. */
export async function fetchBetsPage(criteria: BetsCriteria, offset: number): Promise<BetsPage> {
  const limit = ACTIVE_BETS_PAGE_SIZE + 1;
  const data = await fetchActiveBets(criteria, limit, offset);
  return { bets: data.slice(0, ACTIVE_BETS_PAGE_SIZE), hasMore: data.length === limit };
}

export const betsQueryKey = (criteria: BetsCriteria) => [...BETS_QUERY_ROOT, criteria] as const;

export const betsQueryOptions = (criteria: BetsCriteria) =>
  infiniteQueryOptions({
    queryKey: betsQueryKey(criteria),
    queryFn: ({ pageParam }) => fetchBetsPage(criteria, pageParam),
    initialPageParam: 0,
    getNextPageParam: (_lastPage, allPages) => getNextBetsOffset(allPages),
    ...PAGE_DATA_QUERY_OPTIONS,
  });

/** Reads the criteria back from a cached bets query key. */
export function criteriaFromQueryKey(queryKey: readonly unknown[]): BetsCriteria | null {
  const criteria = queryKey[2];
  if (!criteria || typeof criteria !== 'object') return null;
  const { category, sort, includeInProgress } = criteria as Partial<BetsCriteria>;
  if (typeof sort !== 'string' || typeof includeInProgress !== 'boolean') return null;
  return { category: typeof category === 'string' ? category : null, sort, includeInProgress };
}
