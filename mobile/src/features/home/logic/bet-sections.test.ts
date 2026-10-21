import { describe, expect, it } from 'vitest';

import type { Bet } from '@/types/database';

import { buildBetSections, getNextBetsOffset } from './bet-sections';

function createBet(overrides: Partial<Bet>): Bet {
  return {
    id: 'bet-1',
    title: 'Test',
    category_id: null,
    bet_type: '12',
    options: [
      { name: 'A', odds: 2 },
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

describe('buildBetSections', () => {
  it('puts live bets in their own block and sorts both blocks by the mode', () => {
    const pages = [
      {
        bets: [
          createBet({ id: 'regular-low', bet_count: 1 }),
          createBet({ id: 'live-low', is_live: true, bet_count: 2 }),
          createBet({ id: 'regular-high', bet_count: 7 }),
          createBet({ id: 'live-high', is_live: true, bet_count: 9 }),
        ],
        hasMore: false,
      },
    ];

    const { liveBets, sortedBets } = buildBetSections(pages, 'popular');

    expect(liveBets.map((bet) => bet.id)).toEqual(['live-high', 'live-low']);
    expect(sortedBets.map((bet) => bet.id)).toEqual(['regular-high', 'regular-low']);
  });

  it('shows a bet repeated on two pages only once', () => {
    const pages = [
      { bets: [createBet({ id: 'a' }), createBet({ id: 'b' })], hasMore: true },
      { bets: [createBet({ id: 'b' }), createBet({ id: 'c' })], hasMore: false },
    ];

    const { sortedBets } = buildBetSections(pages, 'newest');

    expect(sortedBets.map((bet) => bet.id).sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('getNextBetsOffset', () => {
  it('continues after every loaded row while the last page reports more', () => {
    const pages = [
      { bets: [createBet({ id: 'a' }), createBet({ id: 'b' })], hasMore: true },
      { bets: [createBet({ id: 'c' })], hasMore: true },
    ];

    expect(getNextBetsOffset(pages)).toBe(3);
  });

  it('stops when the last page has no more rows', () => {
    expect(getNextBetsOffset([{ bets: [createBet({ id: 'a' })], hasMore: false }])).toBeUndefined();
  });
});
