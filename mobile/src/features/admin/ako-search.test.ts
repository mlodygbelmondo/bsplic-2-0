import { describe, expect, it } from 'vitest';

import type { Bet } from '@/types/database';

import { findAkoCandidates } from './ako-search';

const createBet = (id: string, title: string): Bet => ({
  id,
  title,
  category_id: null,
  bet_type: '12',
  options: [],
  ends_at: '2030-01-01T12:00:00.000Z',
  is_live: false,
  is_active: true,
  winning_option: null,
  bet_count: 0,
  created_at: '2030-01-01T10:00:00.000Z',
});

describe('findAkoCandidates', () => {
  it('matches titles case-insensitively and never offers the current bet', () => {
    const bets = [createBet('bet-current', 'Team X aktualny'), createBet('bet-2', 'Team X wygra mecz')];

    expect(
      findAkoCandidates({ availableBets: bets, search: 'team x', currentBetId: 'bet-current', selected: [] }).map(
        (bet) => bet.id,
      ),
    ).toEqual(['bet-2']);
  });

  it('needs at least two characters', () => {
    const bets = [createBet('bet-2', 'Team X wygra mecz')];

    expect(findAkoCandidates({ availableBets: bets, search: ' T ', selected: [] })).toEqual([]);
  });

  it('skips already selected bets and returns at most five', () => {
    const bets = Array.from({ length: 8 }, (_, i) => createBet(`bet-${i}`, `Mecz ${i}`));

    const result = findAkoCandidates({
      availableBets: bets,
      search: 'mecz',
      selected: [{ betId: 'bet-0', title: 'Mecz 0', reason: null }],
    });

    expect(result.map((bet) => bet.id)).toEqual(['bet-1', 'bet-2', 'bet-3', 'bet-4', 'bet-5']);
  });
});
