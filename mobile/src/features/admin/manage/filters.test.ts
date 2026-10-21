import { describe, expect, it } from 'vitest';

import type { Bet } from '@/types/database';

import { filterBets, getPaginationRange } from './filters';

const baseBet: Bet = {
  id: 'filter-bet-1',
  title: 'Testowy zakład',
  category_id: null,
  bet_type: '12',
  options: [
    { name: '1', odds: 2 },
    { name: '2', odds: 2 },
  ],
  ends_at: '2026-04-13T12:00:00.000Z',
  is_live: false,
  is_bsplicboost: false,
  is_active: true,
  winning_option: null,
  bet_count: 0,
  created_at: '2026-04-13T10:00:00.000Z',
};

describe('filterBets', () => {
  it('filters bets by search text, status and bet type together', () => {
    const filterableBets: Bet[] = [
      baseBet,
      {
        ...baseBet,
        id: 'filter-bet-2',
        title: 'Premier League zwycięzca',
        bet_type: 'single',
        is_active: false,
        winning_option: 'Arsenal',
      },
      {
        ...baseBet,
        id: 'filter-bet-3',
        title: 'Bundesliga remis',
        bet_type: '1x2',
        is_active: false,
        winning_option: '__refund__',
      },
    ];

    expect(
      filterBets({
        bets: filterableBets,
        search: 'league',
        status: 'resolved',
        betType: 'single',
      }).map((bet) => bet.id),
    ).toEqual(['filter-bet-2']);
  });

  it('returns only active bets for active status filter', () => {
    const filterableBets: Bet[] = [
      baseBet,
      {
        ...baseBet,
        id: 'filter-bet-2',
        is_active: false,
        winning_option: '1',
      },
    ];

    expect(
      filterBets({
        bets: filterableBets,
        search: '',
        status: 'active',
        betType: 'all',
      }).map((bet) => bet.id),
    ).toEqual(['filter-bet-1']);
  });

  it('treats inactive bets without a winner as closed', () => {
    const filterableBets: Bet[] = [
      baseBet,
      { ...baseBet, id: 'closed', is_active: false },
      { ...baseBet, id: 'resolved', is_active: false, winning_option: '2' },
    ];

    expect(
      filterBets({ bets: filterableBets, search: '  ', status: 'closed', betType: 'all' }).map(
        (bet) => bet.id,
      ),
    ).toEqual(['closed']);
  });
});

describe('getPaginationRange', () => {
  it('lists every page when there are seven or fewer', () => {
    expect(getPaginationRange(0, 5)).toEqual([0, 1, 2, 3, 4]);
  });

  it('shows the first, the current page with neighbours and the last', () => {
    expect(getPaginationRange(5, 12)).toEqual([0, 'ellipsis', 4, 5, 6, 'ellipsis', 11]);
    expect(getPaginationRange(0, 12)).toEqual([0, 1, 'ellipsis', 11]);
    expect(getPaginationRange(11, 12)).toEqual([0, 'ellipsis', 10, 11]);
  });
});
