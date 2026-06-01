import { describe, expect, it } from 'vitest';

import {
  computeRankingStats,
  type RankingCoupon,
  type RankingPlacedBet,
} from '@/features/rankings/stats';

describe('rankings over settled sportsbook data', () => {
  it('counts a settled single win as one profitable unit', () => {
    const placedBets: RankingPlacedBet[] = [
      {
        couponId: 'single-1',
        result: 'won',
        stake: 10,
        payout: 25,
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

    expect(computeRankingStats({ placedBets, coupons })).toEqual({
      totalBets: 1,
      wonBets: 1,
      lostBets: 0,
      resolvedBets: 1,
      winRate: 100,
      totalProfit: 15,
    });
  });

  it('counts a fully won AKO coupon as one ranking unit', () => {
    const placedBets: RankingPlacedBet[] = [
      {
        couponId: 'ako-1',
        result: 'won',
        stake: 10,
        payout: 15,
      },
      {
        couponId: 'ako-1',
        result: 'won',
        stake: 10,
        payout: 20,
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

  it('counts a lost AKO coupon as one lost unit regardless of winning legs', () => {
    const placedBets: RankingPlacedBet[] = [
      {
        couponId: 'ako-2',
        result: 'won',
        stake: 10,
        payout: 15,
      },
      {
        couponId: 'ako-2',
        result: 'lost',
        stake: 10,
        payout: 0,
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
    const placedBets: RankingPlacedBet[] = [
      {
        couponId: 'ako-3',
        result: 'won',
        stake: 12,
        payout: 34.8,
      },
      {
        couponId: 'ako-3',
        result: 'lost',
        stake: 12,
        payout: 0,
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
