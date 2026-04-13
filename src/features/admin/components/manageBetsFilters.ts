import type { Bet } from '@/types/database';

import type { EditableBetType } from '../constants';

type BetStatusFilter = 'all' | 'active' | 'resolved' | 'closed';
type BetTypeFilter = 'all' | EditableBetType;

function matchesStatusFilter(bet: Bet, status: BetStatusFilter) {
  if (status === 'all') return true;
  if (status === 'active') return bet.is_active && !bet.winning_option;
  if (status === 'resolved') return Boolean(bet.winning_option);
  return !bet.is_active && !bet.winning_option;
}

function matchesTypeFilter(bet: Bet, betType: BetTypeFilter) {
  return betType === 'all' ? true : bet.bet_type === betType;
}

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

export type { BetStatusFilter, BetTypeFilter };
