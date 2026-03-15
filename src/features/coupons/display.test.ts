import { describe, expect, it } from 'vitest';

import { getDisplayedCouponOdds } from './display';

describe('getDisplayedCouponOdds', () => {
  it('uses coupon total odds for AKO coupons', () => {
    const displayedOdds = getDisplayedCouponOdds({
      totalOdds: 5.75,
      legs: [
        { oddsAtTime: 1.9 },
        { oddsAtTime: 1.85 },
      ],
    });

    expect(displayedOdds).toBe(5.75);
  });

  it('uses leg odds for single coupon to avoid showing 1.00', () => {
    const displayedOdds = getDisplayedCouponOdds({
      totalOdds: 1,
      legs: [{ oddsAtTime: 2.35 }],
    });

    expect(displayedOdds).toBe(2.35);
  });

  it('falls back to coupon odds when leg odds are missing', () => {
    const displayedOdds = getDisplayedCouponOdds({
      totalOdds: 1,
      legs: [{ oddsAtTime: 0 }],
    });

    expect(displayedOdds).toBe(1);
  });

  it('returns 1 as safe fallback when values are invalid', () => {
    const displayedOdds = getDisplayedCouponOdds({
      totalOdds: Number.NaN,
      legs: [],
    });

    expect(displayedOdds).toBe(1);
  });
});
