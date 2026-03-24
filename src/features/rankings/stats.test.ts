import { describe, expect, it } from 'vitest';

import { computeRankingStats, type RankingCoupon, type RankingPlacedBet } from './stats';

const createCoupon = (id: string, totalOdds: number, stake = 20, payout = 0): RankingCoupon => ({
  id,
  stake,
  totalOdds,
  payout,
});

const createBet = (overrides: Partial<RankingPlacedBet>): RankingPlacedBet => ({
  couponId: null,
  result: 'pending',
  stake: 10,
  payout: 0,
  ...overrides,
});

describe('computeRankingStats', () => {
  it('calculates winrate from resolved units only', () => {
    const placedBets: RankingPlacedBet[] = [
      createBet({ result: 'won', stake: 10, payout: 21 }),
      createBet({ result: 'won', stake: 12, payout: 24 }),
      createBet({ result: 'lost', stake: 8, payout: 0 }),
      createBet({ result: 'pending', stake: 5, payout: 0 }),
    ];

    const stats = computeRankingStats({ placedBets, coupons: [] });

    expect(stats).toEqual({
      totalBets: 4,
      wonBets: 2,
      lostBets: 1,
      resolvedBets: 3,
      winRate: 66.7,
      totalProfit: 15,
    });
  });

  it('counts AKO coupon as one ranking unit when all legs are won', () => {
    const coupons = [createCoupon('ako-1', 6.2, 20, 124)];
    const placedBets: RankingPlacedBet[] = [
      createBet({ couponId: 'ako-1', result: 'won' }),
      createBet({ couponId: 'ako-1', result: 'won' }),
      createBet({ couponId: 'ako-1', result: 'won' }),
      createBet({ result: 'won' }),
    ];

    const stats = computeRankingStats({ placedBets, coupons });

    expect(stats.totalBets).toBe(2);
    expect(stats.wonBets).toBe(2);
    expect(stats.lostBets).toBe(0);
    expect(stats.resolvedBets).toBe(2);
    expect(stats.winRate).toBe(100);
    expect(stats.totalProfit).toBe(104);
  });

  it('marks AKO coupon as lost when any leg is lost', () => {
    const coupons = [createCoupon('ako-1', 4.8, 30, 0)];
    const placedBets: RankingPlacedBet[] = [
      createBet({ couponId: 'ako-1', result: 'won' }),
      createBet({ couponId: 'ako-1', result: 'lost' }),
      createBet({ result: 'won' }),
    ];

    const stats = computeRankingStats({ placedBets, coupons });

    expect(stats.totalBets).toBe(2);
    expect(stats.wonBets).toBe(1);
    expect(stats.lostBets).toBe(1);
    expect(stats.resolvedBets).toBe(2);
    expect(stats.winRate).toBe(50);
    expect(stats.totalProfit).toBe(-30);
  });

  it('keeps unresolved AKO outside winrate denominator', () => {
    const coupons = [createCoupon('ako-1', 3.5)];
    const placedBets: RankingPlacedBet[] = [
      createBet({ couponId: 'ako-1', result: 'won' }),
      createBet({ couponId: 'ako-1', result: 'pending' }),
      createBet({ result: 'lost' }),
    ];

    const stats = computeRankingStats({ placedBets, coupons });

    expect(stats.totalBets).toBe(2);
    expect(stats.wonBets).toBe(0);
    expect(stats.lostBets).toBe(1);
    expect(stats.resolvedBets).toBe(1);
    expect(stats.winRate).toBe(0);
    expect(stats.totalProfit).toBe(-10);
  });

  it('treats coupon with total odds <= 1 as single bets', () => {
    const coupons = [createCoupon('single-coupon', 1)];
    const placedBets: RankingPlacedBet[] = [
      createBet({ couponId: 'single-coupon', result: 'won' }),
      createBet({ couponId: 'single-coupon', result: 'lost' }),
    ];

    const stats = computeRankingStats({ placedBets, coupons });

    expect(stats.totalBets).toBe(2);
    expect(stats.wonBets).toBe(1);
    expect(stats.lostBets).toBe(1);
    expect(stats.resolvedBets).toBe(2);
    expect(stats.winRate).toBe(50);
    expect(stats.totalProfit).toBe(-10);
  });

  it('uses fallback AKO payout stake * total odds when coupon payout is missing', () => {
    const coupons = [createCoupon('ako-1', 3.4, 15, 0)];
    const placedBets: RankingPlacedBet[] = [
      createBet({ couponId: 'ako-1', result: 'won' }),
      createBet({ couponId: 'ako-1', result: 'won' }),
    ];

    const stats = computeRankingStats({ placedBets, coupons });

    expect(stats.totalBets).toBe(1);
    expect(stats.wonBets).toBe(1);
    expect(stats.lostBets).toBe(0);
    expect(stats.resolvedBets).toBe(1);
    expect(stats.winRate).toBe(100);
    expect(stats.totalProfit).toBe(36);
  });

  it('marks refunded AKO as refund unit and keeps profit neutral', () => {
    const coupons = [createCoupon('ako-r', 3.4, 15, 15)];
    const placedBets: RankingPlacedBet[] = [
      createBet({ couponId: 'ako-r', result: 'refund' }),
      createBet({ couponId: 'ako-r', result: 'refund' }),
    ];

    const stats = computeRankingStats({ placedBets, coupons });

    expect(stats.totalBets).toBe(1);
    expect(stats.wonBets).toBe(0);
    expect(stats.lostBets).toBe(0);
    expect(stats.resolvedBets).toBe(0);
    expect(stats.winRate).toBe(0);
    expect(stats.totalProfit).toBe(0);
  });

  it('treats mixed won+refund AKO as won without loss', () => {
    const coupons = [createCoupon('ako-wr', 2.8, 20, 56)];
    const placedBets: RankingPlacedBet[] = [
      createBet({ couponId: 'ako-wr', result: 'won' }),
      createBet({ couponId: 'ako-wr', result: 'refund' }),
    ];

    const stats = computeRankingStats({ placedBets, coupons });

    expect(stats.totalBets).toBe(1);
    expect(stats.wonBets).toBe(1);
    expect(stats.lostBets).toBe(0);
    expect(stats.resolvedBets).toBe(1);
    expect(stats.winRate).toBe(100);
    expect(stats.totalProfit).toBe(36);
  });
});
