import { describe, expect, it } from 'vitest';

import { deriveCouponStatus, getDisplayedCouponOdds, getDisplayedCouponWin } from './display';

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

  it('treats refunded AKO leg as odds 1.00 in displayed odds', () => {
    const displayedOdds = getDisplayedCouponOdds({
      totalOdds: 3.8,
      legs: [
        { oddsAtTime: 2, result: 'won' },
        { oddsAtTime: 1.9, result: 'refund' },
      ],
    });

    expect(displayedOdds).toBe(2);
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

  it('shows refunded amount when coupon status is refund', () => {
    const amount = getDisplayedCouponWin({
      status: 'refund',
      isAko: true,
      stake: 50,
      displayedOdds: 3.2,
      couponPayout: 50,
      legs: [],
    });

    expect(amount).toBe(50);
  });
});

describe('deriveCouponStatus', () => {
  it('marks coupon as lost immediately when at least one leg is lost', () => {
    const status = deriveCouponStatus({
      status: 'pending',
      legs: [
        { result: 'won' },
        { result: 'lost' },
        { result: 'pending' },
      ],
    });

    expect(status).toBe('lost');
  });

  it('marks coupon as won when all legs are resolved and none is lost', () => {
    const status = deriveCouponStatus({
      status: 'pending',
      legs: [
        { result: 'won' },
        { result: 'won' },
      ],
    });

    expect(status).toBe('won');
  });

  it('keeps pending status when there are unresolved legs and no losses', () => {
    const status = deriveCouponStatus({
      status: 'pending',
      legs: [
        { result: 'won' },
        { result: 'pending' },
      ],
    });

    expect(status).toBe('pending');
  });

  it('returns refund for refunded coupons when all legs are refunded', () => {
    const status = deriveCouponStatus({
      status: 'refund',
      legs: [{ result: 'refund' }],
    });

    expect(status).toBe('refund');
  });

  it('marks as won when there is no lost leg and all legs are won or refund', () => {
    const status = deriveCouponStatus({
      status: 'pending',
      legs: [
        { result: 'won' },
        { result: 'refund' },
      ],
    });

    expect(status).toBe('won');
  });
});
