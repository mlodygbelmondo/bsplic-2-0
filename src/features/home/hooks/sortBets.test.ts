import { describe, expect, it } from 'vitest';

import { Bet } from '@/types/database';

import { sortBetsByMode } from './sortBets';

function createBet(overrides: Partial<Bet>): Bet {
  return {
    id: 'bet-1',
    title: 'Test',
    category_id: null,
    bet_type: '12',
    options: [
      { name: 'A', odds: 2.0 },
      { name: 'B', odds: 1.8 },
    ],
    ends_at: '2030-01-01T12:00:00.000Z',
    is_live: false,
    is_active: true,
    winning_option: null,
    bet_count: 0,
    created_at: '2030-01-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('sortBetsByMode', () => {
  it('sorts popular by bet_count descending and then newest', () => {
    const lessPopular = createBet({ id: 'a', bet_count: 5, created_at: '2030-01-01T11:00:00.000Z' });
    const morePopular = createBet({ id: 'b', bet_count: 9, created_at: '2030-01-01T09:00:00.000Z' });
    const samePopularityOlder = createBet({ id: 'c', bet_count: 5, created_at: '2030-01-01T08:00:00.000Z' });

    const sorted = [lessPopular, morePopular, samePopularityOlder].sort((a, b) =>
      sortBetsByMode('popular', a, b),
    );

    expect(sorted.map((bet) => bet.id)).toEqual(['b', 'a', 'c']);
  });

  it('sorts newest by created_at descending', () => {
    const oldest = createBet({ id: 'a', created_at: '2030-01-01T08:00:00.000Z' });
    const newest = createBet({ id: 'b', created_at: '2030-01-01T12:00:00.000Z' });
    const middle = createBet({ id: 'c', created_at: '2030-01-01T10:00:00.000Z' });

    const sorted = [oldest, newest, middle].sort((a, b) => sortBetsByMode('newest', a, b));

    expect(sorted.map((bet) => bet.id)).toEqual(['b', 'c', 'a']);
  });

  it('sorts ending_soon by the closest ends_at date first', () => {
    const latest = createBet({ id: 'a', ends_at: '2030-01-01T13:00:00.000Z' });
    const soonest = createBet({ id: 'b', ends_at: '2030-01-01T11:00:00.000Z' });
    const middle = createBet({ id: 'c', ends_at: '2030-01-01T12:00:00.000Z' });

    const sorted = [latest, soonest, middle].sort((a, b) => sortBetsByMode('ending_soon', a, b));

    expect(sorted.map((bet) => bet.id)).toEqual(['b', 'c', 'a']);
  });

  it('puts invalid ends_at values after valid ones in ending_soon mode', () => {
    const invalid = createBet({ id: 'invalid', ends_at: 'not-a-date' });
    const valid = createBet({ id: 'valid', ends_at: '2030-01-01T11:00:00.000Z' });

    const sorted = [invalid, valid].sort((a, b) => sortBetsByMode('ending_soon', a, b));

    expect(sorted.map((bet) => bet.id)).toEqual(['valid', 'invalid']);
  });
});
