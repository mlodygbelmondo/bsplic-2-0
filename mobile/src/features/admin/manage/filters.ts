import type { Bet } from '@/types/database';

import type { EditableBetType } from '../constants';

export type BetStatusFilter = 'all' | 'active' | 'resolved' | 'closed';
export type BetTypeFilter = 'all' | EditableBetType;

function matchesStatusFilter(bet: Bet, status: BetStatusFilter) {
  if (status === 'all') return true;
  if (status === 'active') return bet.is_active && !bet.winning_option;
  if (status === 'resolved') return Boolean(bet.winning_option);
  return !bet.is_active && !bet.winning_option;
}

function matchesTypeFilter(bet: Bet, betType: BetTypeFilter) {
  return betType === 'all' ? true : bet.bet_type === betType;
}

/** Port of the web `manageBetsFilters.ts`: title search AND status AND type. */
export function filterBets({
  bets,
  search,
  status,
  betType,
}: {
  bets: Bet[];
  search: string;
  status: BetStatusFilter;
  betType: BetTypeFilter;
}) {
  const normalizedSearch = search.trim().toLowerCase();

  return bets.filter((bet) => {
    const matchesSearch = !normalizedSearch || bet.title.toLowerCase().includes(normalizedSearch);
    return matchesSearch && matchesStatusFilter(bet, status) && matchesTypeFilter(bet, betType);
  });
}

export const PAGE_SIZE = 15;

/** Page indices with `'ellipsis'` markers (web `getPaginationRange`). */
export function getPaginationRange(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);

  const result: (number | 'ellipsis')[] = [0];

  if (current > 2) result.push('ellipsis');

  const rangeStart = Math.max(1, current - 1);
  const rangeEnd = Math.min(total - 2, current + 1);
  for (let i = rangeStart; i <= rangeEnd; i++) result.push(i);

  if (current < total - 3) result.push('ellipsis');

  result.push(total - 1);
  return result;
}
