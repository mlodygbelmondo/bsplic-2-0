import { describe, expect, it } from 'vitest';

import { computeRankingStats, type RankingCoupon, type RankingPlacedBet } from './stats';

describe('ranking profit alignment with RPC expectations', () => {
  it('reports non-positive profit for user with 0% win rate on AKO units', () => {
    const placedBets: RankingPlacedBet[] = [
      { couponId: 'coupon-a', result: 'won', stake: 12, payout: 34.8 },
      { couponId: 'coupon-a', result: 'lost', stake: 12, payout: 0 },
      { couponId: 'coupon-b', result: 'won', stake: 12, payout: 22.8 },
      { couponId: 'coupon-b', result: 'lost', stake: 12, payout: 0 },
    ];

    const coupons: RankingCoupon[] = [
      { id: 'coupon-a', stake: 12, totalOdds: 5, payout: 0 },
      { id: 'coupon-b', stake: 12, totalOdds: 4, payout: 0 },
    ];

    const stats = computeRankingStats({ placedBets, coupons });

    expect(stats.totalBets).toBe(2);
    expect(stats.wonBets).toBe(0);
    expect(stats.lostBets).toBe(2);
    expect(stats.winRate).toBe(0);
    expect(stats.totalProfit).toBe(-24);
  });
});
