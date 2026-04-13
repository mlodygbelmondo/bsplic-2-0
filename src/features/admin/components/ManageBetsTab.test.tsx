import { describe, expect, it } from 'vitest';

import type { Bet } from '@/types/database';

import { filterBets } from './manageBetsFilters';

const baseBet: Bet = {
  id: 'bet-1',
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
    const bets: Bet[] = [
      baseBet,
      {
        ...baseBet,
        id: 'bet-2',
        title: 'Premier League zwycięzca',
        bet_type: 'single',
        is_active: false,
        winning_option: 'Arsenal',
      },
      {
        ...baseBet,
        id: 'bet-3',
        title: 'Bundesliga remis',
        bet_type: '1x2',
        is_active: false,
        winning_option: '__refund__',
      },
    ];

    expect(
      filterBets({
        bets,
        search: 'league',
        status: 'resolved',
        betType: 'single',
      }).map((bet) => bet.id),
    ).toEqual(['bet-2']);
  });

  it('returns only active bets for active status filter', () => {
    const bets: Bet[] = [
      baseBet,
      {
        ...baseBet,
        id: 'bet-2',
        is_active: false,
        winning_option: '1',
      },
    ];

    expect(
      filterBets({
        bets,
        search: '',
        status: 'active',
        betType: 'all',
      }).map((bet) => bet.id),
    ).toEqual(['bet-1']);
  });
});
