import { describe, expect, it } from 'vitest';

import type { CouponHistoryEntry } from '@/types/database';

import {
  deriveCouponStatus,
  getCasinoGameLabel,
  getDisplayedCouponOdds,
  getDisplayedCouponWin,
} from './profile-history';

function coupon(overrides: Partial<CouponHistoryEntry> = {}): CouponHistoryEntry {
  return {
    id: 'coupon-1',
    total_odds: 1,
    stake: 10,
    payout: 0,
    status: 'pending',
    created_at: '2026-07-21T10:00:00.000Z',
    legs: [],
    ...overrides,
  };
}

describe('profile history display', () => {
  it('accepts both RPC and canonical roulette labels', () => {
    expect(getCasinoGameLabel('Ruletka')).toBe('Ruletka');
    expect(getCasinoGameLabel('roulette')).toBe('Ruletka');
    expect(getCasinoGameLabel('blackjack')).toBe('Blackjack');
  });

  it('derives a lost coupon from a lost leg before the stale coupon status', () => {
    const row = coupon({
      status: 'pending',
      legs: [{ id: 'leg-1', selected_option: 'A', odds_at_time: 2, result: 'lost', bet_title: 'Test' }],
    });

    expect(deriveCouponStatus(row)).toBe('lost');
  });

  it('uses single-leg odds when the legacy total odds value is one', () => {
    const row = coupon({
      legs: [{ id: 'leg-1', selected_option: 'A', odds_at_time: 2.25, result: 'won', bet_title: 'Test' }],
    });

    expect(getDisplayedCouponOdds(row)).toBe(2.25);
  });

  it('removes refunded legs from effective AKO odds and fallback winnings', () => {
    const row = coupon({
      status: 'won',
      legs: [
        { id: 'leg-1', selected_option: 'A', odds_at_time: 2, result: 'won', bet_title: 'One' },
        { id: 'leg-2', selected_option: 'B', odds_at_time: 3, result: 'refund', bet_title: 'Two' },
      ],
    });

    expect(getDisplayedCouponOdds(row)).toBe(2);
    expect(getDisplayedCouponWin(row, 'won')).toBe(20);
  });
});
