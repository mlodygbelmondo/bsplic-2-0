import { describe, expect, it } from 'vitest';

import {
  addCreditForUser,
  calculateAssetCreditQuantity,
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

  it('does not credit PLN for asset-backed stake', () => {
    const credit = calculateCreditAmount({
      legWon: true,
      legPayout: 70,
      couponBefore: null,
      couponAfter: null,
      useAssetStake: true,
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

describe('calculateAssetCreditQuantity', () => {
  it('credits single win with odds multiplier', () => {
    const quantity = calculateAssetCreditQuantity({
      legWon: true,
      oddsAtTime: 2.5,
      couponBefore: null,
      couponAfter: null,
      stakeAssetQuantity: 2,
    });

    expect(quantity).toBe(5);
  });

  it('credits AKO only when coupon becomes won', () => {
    const quantity = calculateAssetCreditQuantity({
      legWon: true,
      oddsAtTime: 1.8,
      stakeAssetQuantity: 3,
      couponBefore: {
        stake: 200,
        totalOdds: 4.2,
        status: 'pending',
        payout: 0,
      },
      couponAfter: {
        stake: 200,
        totalOdds: 4.2,
        status: 'won',
        payout: 840,
      },
    });

    expect(quantity).toBe(12.6);
  });

  it('does not credit asset when leg or coupon is not won', () => {
    const quantity = calculateAssetCreditQuantity({
      legWon: false,
      oddsAtTime: 2.2,
      stakeAssetQuantity: 1,
      couponBefore: {
        stake: 100,
        totalOdds: 3.1,
        status: 'pending',
        payout: 0,
      },
      couponAfter: {
        stake: 100,
        totalOdds: 3.1,
        status: 'lost',
        payout: 0,
      },
    });

    expect(quantity).toBe(0);
  });
});

describe('addCreditForUser', () => {
  it('adds first credit entry for user', () => {
    const credits = addCreditForUser({
      creditsByUser: {},
      userId: 'user-1',
      amount: 12.5,
    });

    expect(credits).toEqual({
      'user-1': 12.5,
    });
  });

  it('accumulates multiple credits for the same user', () => {
    const once = addCreditForUser({
      creditsByUser: {},
      userId: 'user-1',
      amount: 12.5,
    });

    const twice = addCreditForUser({
      creditsByUser: once,
      userId: 'user-1',
      amount: 7.25,
    });

    expect(twice).toEqual({
      'user-1': 19.75,
    });
  });

  it('accumulates credits for multiple users independently', () => {
    const base = addCreditForUser({
      creditsByUser: {},
      userId: 'user-1',
      amount: 10,
    });

    const next = addCreditForUser({
      creditsByUser: base,
      userId: 'user-2',
      amount: 15,
    });

    expect(next).toEqual({
      'user-1': 10,
      'user-2': 15,
    });
  });

  it('ignores non-positive credits', () => {
    const credits = addCreditForUser({
      creditsByUser: {
        'user-1': 10,
      },
      userId: 'user-1',
      amount: 0,
    });

    expect(credits).toEqual({
      'user-1': 10,
    });
  });
});
