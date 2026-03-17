import { describe, expect, it } from 'vitest';

import { getDisplayedCouponOdds, getDisplayedCouponWin } from './display';

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

describe('getDisplayedCouponWin', () => {
  it('shows single coupon win as stake * displayed odds when coupon payout is stale', () => {
    const amount = getDisplayedCouponWin({
      status: 'won',
      isAko: false,
      stake: 100,
      displayedOdds: 1.3,
      couponPayout: 100,
      legs: [{ legPayout: 130 }],
    });

    expect(amount).toBe(130);
  });

  it('shows AKO payout from coupon payout when available', () => {
    const amount = getDisplayedCouponWin({
      status: 'won',
      isAko: true,
      stake: 20,
      displayedOdds: 4.2,
      couponPayout: 84,
      legs: [],
    });

    expect(amount).toBe(84);
  });

  it('returns 0 when coupon is not won', () => {
    const amount = getDisplayedCouponWin({
      status: 'pending',
      isAko: false,
      stake: 100,
      displayedOdds: 1.3,
      couponPayout: 100,
      legs: [{ legPayout: 130 }],
    });

    expect(amount).toBe(0);
  });
});
