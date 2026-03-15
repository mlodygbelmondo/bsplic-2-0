import { describe, expect, it } from 'vitest';

import {
  calculateCreditAmount,
  calculateLegOutcome,
  type CouponSettlementSnapshot,
} from './settlement';

describe('calculateLegOutcome', () => {
  it('marks winning leg and calculates payout', () => {
    const outcome = calculateLegOutcome({
      selectedOption: '1',
      winningOption: '1',
      stake: 25,
      oddsAtTime: 2.4,
    });

    expect(outcome).toEqual({
      result: 'won',
      won: true,
      payout: 60,
    });
  });

  it('marks losing leg and returns zero payout', () => {
    const outcome = calculateLegOutcome({
      selectedOption: '1',
      winningOption: '2',
      stake: 25,
      oddsAtTime: 2.4,
    });

    expect(outcome).toEqual({
      result: 'lost',
      won: false,
      payout: 0,
    });
  });
});

describe('calculateCreditAmount', () => {
  it('credits single bet instantly when leg is won', () => {
    const credit = calculateCreditAmount({
      legWon: true,
      legPayout: 37.5,
      couponBefore: null,
      couponAfter: null,
    });

    expect(credit).toBe(37.5);
  });

  it('does not credit single bet when leg is lost', () => {
    const credit = calculateCreditAmount({
      legWon: false,
      legPayout: 0,
      couponBefore: null,
      couponAfter: null,
    });

    expect(credit).toBe(0);
  });

  it('does not credit AKO leg before the coupon is fully resolved', () => {
    const couponBefore: CouponSettlementSnapshot = {
      stake: 20,
      totalOdds: 6.5,
      status: 'pending',
      payout: 0,
    };

    const couponAfter: CouponSettlementSnapshot = {
      stake: 20,
      totalOdds: 6.5,
      status: 'pending',
      payout: 0,
    };

    const credit = calculateCreditAmount({
      legWon: true,
      legPayout: 20,
      couponBefore,
      couponAfter,
    });

    expect(credit).toBe(0);
  });

  it('credits full coupon payout when AKO transitions from pending to won', () => {
    const couponBefore: CouponSettlementSnapshot = {
      stake: 20,
      totalOdds: 6.5,
      status: 'pending',
      payout: 0,
    };

    const couponAfter: CouponSettlementSnapshot = {
      stake: 20,
      totalOdds: 6.5,
      status: 'won',
      payout: 130,
    };

    const credit = calculateCreditAmount({
      legWon: true,
      legPayout: 20,
      couponBefore,
      couponAfter,
    });

    expect(credit).toBe(130);
  });

  it('does not credit AKO more than once when coupon is already won', () => {
    const couponBefore: CouponSettlementSnapshot = {
      stake: 20,
      totalOdds: 4,
      status: 'won',
      payout: 80,
    };

    const couponAfter: CouponSettlementSnapshot = {
      stake: 20,
      totalOdds: 4,
      status: 'won',
      payout: 80,
    };

    const credit = calculateCreditAmount({
      legWon: true,
      legPayout: 20,
      couponBefore,
      couponAfter,
    });

    expect(credit).toBe(0);
  });

  it('does not credit AKO when coupon transitions to lost', () => {
    const couponBefore: CouponSettlementSnapshot = {
      stake: 20,
      totalOdds: 4,
      status: 'pending',
      payout: 0,
    };

    const couponAfter: CouponSettlementSnapshot = {
      stake: 20,
      totalOdds: 4,
      status: 'lost',
      payout: 0,
    };

    const credit = calculateCreditAmount({
      legWon: false,
      legPayout: 0,
      couponBefore,
      couponAfter,
    });

    expect(credit).toBe(0);
  });

  it('falls back to stake * total odds when won coupon payout is still zero', () => {
    const couponBefore: CouponSettlementSnapshot = {
      stake: 15,
      totalOdds: 3.4,
      status: 'pending',
      payout: 0,
    };

    const couponAfter: CouponSettlementSnapshot = {
      stake: 15,
      totalOdds: 3.4,
      status: 'won',
      payout: 0,
    };

    const credit = calculateCreditAmount({
      legWon: true,
      legPayout: 17,
      couponBefore,
      couponAfter,
    });

    expect(credit).toBe(51);
  });
});
