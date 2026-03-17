import { describe, expect, it } from 'vitest';

import { addCreditForUser, calculateCreditAmount, calculateLegOutcome, type CouponSettlementSnapshot } from '@/features/admin/settlement';
import { computeRankingStats, type RankingCoupon, type RankingPlacedBet } from '@/features/rankings/stats';

interface SettleLegInput {
  selectedOption: string;
  winningOption: string;
  stake: number;
  oddsAtTime: number;
  couponBefore: CouponSettlementSnapshot | null;
  couponAfter: CouponSettlementSnapshot | null;
}

const settleLeg = ({
  selectedOption,
  winningOption,
  stake,
  oddsAtTime,
  couponBefore,
  couponAfter,
}: SettleLegInput) => {
  const leg = calculateLegOutcome({
    selectedOption,
    winningOption,
    stake,
    oddsAtTime,
  });

  const credit = calculateCreditAmount({
    legWon: leg.won,
    legPayout: leg.payout,
    couponBefore,
    couponAfter,
  });

  return { leg, credit };
};

describe('settlement + rankings integration', () => {
  it('aggregates credits for all winning users on the same settled bet', () => {
    const couponBefore: CouponSettlementSnapshot = {
      stake: 10,
      totalOdds: 1,
      status: 'pending',
      payout: 0,
    };

    const couponAfter: CouponSettlementSnapshot = {
      stake: 10,
      totalOdds: 1,
      status: 'won',
      payout: 10,
    };

    const legA = settleLeg({
      selectedOption: '1',
      winningOption: '1',
      stake: 10,
      oddsAtTime: 2,
      couponBefore,
      couponAfter,
    });

    const legB = settleLeg({
      selectedOption: '1',
      winningOption: '1',
      stake: 5,
      oddsAtTime: 3,
      couponBefore: {
        ...couponBefore,
        stake: 5,
      },
      couponAfter: {
        ...couponAfter,
        stake: 5,
        payout: 5,
      },
    });

    let creditsByUser: Record<string, number> = {};
    creditsByUser = addCreditForUser({
      creditsByUser,
      userId: 'user-a',
      amount: legA.credit,
    });
    creditsByUser = addCreditForUser({
      creditsByUser,
      userId: 'user-b',
      amount: legB.credit,
    });

    expect(creditsByUser).toEqual({
      'user-a': 20,
      'user-b': 15,
    });
  });

  it('credits single win immediately and keeps ranking stats consistent', () => {
    const couponBefore: CouponSettlementSnapshot = {
      stake: 10,
      totalOdds: 1,
      status: 'pending',
      payout: 0,
    };

    const couponAfter: CouponSettlementSnapshot = {
      stake: 10,
      totalOdds: 1,
      status: 'won',
      payout: 10,
    };

    const { leg, credit } = settleLeg({
      selectedOption: '1',
      winningOption: '1',
      stake: 10,
      oddsAtTime: 2.5,
      couponBefore,
      couponAfter,
    });

    expect(credit).toBe(25);

    const placedBets: RankingPlacedBet[] = [
      {
        couponId: 'single-1',
        result: leg.result,
        stake: 10,
        payout: leg.payout,
      },
    ];

    const coupons: RankingCoupon[] = [
      {
        id: 'single-1',
        stake: 10,
        totalOdds: 1,
        payout: 10,
      },
    ];

    const stats = computeRankingStats({ placedBets, coupons });

    expect(stats).toEqual({
      totalBets: 1,
      wonBets: 1,
      lostBets: 0,
      resolvedBets: 1,
      winRate: 100,
      totalProfit: 15,
    });
  });

  it('credits AKO only on transition to won and counts AKO as one ranking unit', () => {
    const couponInitial: CouponSettlementSnapshot = {
      stake: 10,
      totalOdds: 3,
      status: 'pending',
      payout: 0,
    };

    const couponPending: CouponSettlementSnapshot = {
      stake: 10,
      totalOdds: 3,
      status: 'pending',
      payout: 0,
    };

    const couponWon: CouponSettlementSnapshot = {
      stake: 10,
      totalOdds: 3,
      status: 'won',
      payout: 30,
    };

    const firstLeg = settleLeg({
      selectedOption: '1',
      winningOption: '1',
      stake: 10,
      oddsAtTime: 1.5,
      couponBefore: couponInitial,
      couponAfter: couponPending,
    });

    const secondLeg = settleLeg({
      selectedOption: '2',
      winningOption: '2',
      stake: 10,
      oddsAtTime: 2,
      couponBefore: couponPending,
      couponAfter: couponWon,
    });

    expect(firstLeg.credit).toBe(0);
    expect(secondLeg.credit).toBe(30);

    const placedBets: RankingPlacedBet[] = [
      {
        couponId: 'ako-1',
        result: firstLeg.leg.result,
        stake: 10,
        payout: firstLeg.leg.payout,
      },
      {
        couponId: 'ako-1',
        result: secondLeg.leg.result,
        stake: 10,
        payout: secondLeg.leg.payout,
      },
    ];

    const coupons: RankingCoupon[] = [
      {
        id: 'ako-1',
        stake: 10,
        totalOdds: 3,
        payout: 30,
      },
    ];

    const stats = computeRankingStats({ placedBets, coupons });

    expect(stats.totalBets).toBe(1);
    expect(stats.wonBets).toBe(1);
    expect(stats.lostBets).toBe(0);
    expect(stats.resolvedBets).toBe(1);
    expect(stats.winRate).toBe(100);
    expect(stats.totalProfit).toBe(20);
  });

  it('keeps credit at zero for AKO lost and ranking reports one lost unit', () => {
    const couponPending: CouponSettlementSnapshot = {
      stake: 10,
      totalOdds: 3,
      status: 'pending',
      payout: 0,
    };

    const couponLost: CouponSettlementSnapshot = {
      stake: 10,
      totalOdds: 3,
      status: 'lost',
      payout: 0,
    };

    const firstLeg = settleLeg({
      selectedOption: '1',
      winningOption: '1',
      stake: 10,
      oddsAtTime: 1.5,
      couponBefore: couponPending,
      couponAfter: couponPending,
    });

    const secondLeg = settleLeg({
      selectedOption: '2',
      winningOption: '1',
      stake: 10,
      oddsAtTime: 2,
      couponBefore: couponPending,
      couponAfter: couponLost,
    });

    expect(firstLeg.credit).toBe(0);
    expect(secondLeg.credit).toBe(0);

    const placedBets: RankingPlacedBet[] = [
      {
        couponId: 'ako-2',
        result: firstLeg.leg.result,
        stake: 10,
        payout: firstLeg.leg.payout,
      },
      {
        couponId: 'ako-2',
        result: secondLeg.leg.result,
        stake: 10,
        payout: secondLeg.leg.payout,
      },
    ];

    const coupons: RankingCoupon[] = [
      {
        id: 'ako-2',
        stake: 10,
        totalOdds: 3,
        payout: 0,
      },
    ];

    const stats = computeRankingStats({ placedBets, coupons });

    expect(stats.totalBets).toBe(1);
    expect(stats.wonBets).toBe(0);
    expect(stats.lostBets).toBe(1);
    expect(stats.resolvedBets).toBe(1);
    expect(stats.winRate).toBe(0);
    expect(stats.totalProfit).toBe(-10);
  });

  it('prevents positive profit from a lost AKO with one very high winning leg', () => {
    const couponPending: CouponSettlementSnapshot = {
      stake: 12,
      totalOdds: 6,
      status: 'pending',
      payout: 0,
    };

    const couponLost: CouponSettlementSnapshot = {
      stake: 12,
      totalOdds: 6,
      status: 'lost',
      payout: 0,
    };

    const firstLeg = settleLeg({
      selectedOption: '1',
      winningOption: '1',
      stake: 12,
      oddsAtTime: 2.9,
      couponBefore: couponPending,
      couponAfter: couponPending,
    });

    const secondLeg = settleLeg({
      selectedOption: '2',
      winningOption: '1',
      stake: 12,
      oddsAtTime: 2.1,
      couponBefore: couponPending,
      couponAfter: couponLost,
    });

    expect(firstLeg.credit).toBe(0);
    expect(secondLeg.credit).toBe(0);

    const placedBets: RankingPlacedBet[] = [
      {
        couponId: 'ako-3',
        result: firstLeg.leg.result,
        stake: 12,
        payout: firstLeg.leg.payout,
      },
      {
        couponId: 'ako-3',
        result: secondLeg.leg.result,
        stake: 12,
        payout: secondLeg.leg.payout,
      },
    ];

    const coupons: RankingCoupon[] = [
      {
        id: 'ako-3',
        stake: 12,
        totalOdds: 6,
        payout: 0,
      },
    ];

    const stats = computeRankingStats({ placedBets, coupons });

    expect(stats.totalBets).toBe(1);
    expect(stats.wonBets).toBe(0);
    expect(stats.lostBets).toBe(1);
    expect(stats.resolvedBets).toBe(1);
    expect(stats.winRate).toBe(0);
    expect(stats.totalProfit).toBe(-12);
  });
});
