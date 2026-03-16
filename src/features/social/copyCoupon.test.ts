import { describe, expect, it } from 'vitest';

import { Bet } from '@/types/database';

import { buildCouponItemsFromSocial } from './copyCoupon';

function createBet(overrides: Partial<Bet>): Bet {
  return {
    id: 'bet-1',
    title: 'Mecz testowy',
    category_id: null,
    bet_type: '12',
    options: [
      { name: 'Dom', odds: 2.1 },
      { name: 'Wyjazd', odds: 1.8 },
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

interface SocialLegForTest {
  id: string;
  bet_id: string | null;
  selected_option: string;
  odds_at_time: number;
  result: 'pending' | 'won' | 'lost';
  bet_title: string | null;
}

function createLeg(overrides: Partial<SocialLegForTest> = {}): SocialLegForTest {
  return {
    id: 'leg-1',
    bet_id: 'bet-1',
    selected_option: 'Dom',
    odds_at_time: 1.95,
    result: 'pending',
    bet_title: 'Mecz testowy',
    ...overrides,
  };
}

describe('buildCouponItemsFromSocial', () => {
  it('builds coupon item for available leg using current option odds', () => {
    const legs = [createLeg()];
    const bets = [createBet({ id: 'bet-1' })];

    const result = buildCouponItemsFromSocial({
      legs,
      bets,
      now: new Date('2030-01-01T11:00:00.000Z').getTime(),
    });

    expect(result.skippedCount).toBe(0);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].bet.id).toBe('bet-1');
    expect(result.items[0].selectedOption).toBe('Dom');
    expect(result.items[0].odds).toBe(2.1);
  });

  it('skips legs that are ended, resolved, inactive, missing, or have unknown option', () => {
    const legs = [
      createLeg({ id: 'ok', bet_id: 'bet-ok' }),
      createLeg({ id: 'leg-resolved', bet_id: 'bet-leg-resolved', result: 'won' }),
      createLeg({ id: 'ended', bet_id: 'bet-ended' }),
      createLeg({ id: 'resolved', bet_id: 'bet-resolved' }),
      createLeg({ id: 'inactive', bet_id: 'bet-inactive' }),
      createLeg({ id: 'missing-option', bet_id: 'bet-missing-option' }),
      createLeg({ id: 'not-found', bet_id: 'bet-not-found' }),
      createLeg({ id: 'without-id', bet_id: null }),
    ];

    const bets = [
      createBet({ id: 'bet-ok' }),
      createBet({ id: 'bet-leg-resolved' }),
      createBet({ id: 'bet-ended', ends_at: '2030-01-01T10:30:00.000Z' }),
      createBet({ id: 'bet-resolved', winning_option: 'Dom' }),
      createBet({ id: 'bet-inactive', is_active: false }),
      createBet({
        id: 'bet-missing-option',
        options: [
          { name: 'Inna opcja', odds: 2.5 },
          { name: 'Jeszcze inna', odds: 3.1 },
        ],
      }),
    ];

    const result = buildCouponItemsFromSocial({
      legs,
      bets,
      now: new Date('2030-01-01T11:00:00.000Z').getTime(),
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].bet.id).toBe('bet-ok');
    expect(result.skippedCount).toBe(7);
  });
});
