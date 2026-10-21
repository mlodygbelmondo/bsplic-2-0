import { describe, expect, it } from 'vitest';

import type { CouponHistoryEntry, CouponLeg } from '@/types/database';
import { deriveSportsbookCouponRows, mergeById } from './historyRows';

function leg(id: string, result: CouponLeg['result']): CouponLeg {
  return { id, selected_option: 'TAK', odds_at_time: 2, result, bet_title: `Zakład ${id}` };
}

function coupon(id: string, status: CouponHistoryEntry['status'], legs: CouponLeg[] | null): CouponHistoryEntry {
  return { id, total_odds: 4, stake: 10, payout: 0, status, created_at: '2026-05-01T12:00:00.000Z', legs };
}

describe('mergeById', () => {
  it('appends loaded batches after the preview and drops entries that shifted into the preview', () => {
    const preview = [{ id: 'a', v: 'preview' }, { id: 'b', v: 'preview' }];
    const more = [{ id: 'b', v: 'batch' }, { id: 'c', v: 'batch' }];

    expect(mergeById(preview, more)).toEqual([
      { id: 'a', v: 'preview' },
      { id: 'b', v: 'preview' },
      { id: 'c', v: 'batch' },
    ]);
  });
});

describe('deriveSportsbookCouponRows', () => {
  const coupons = [
    // Server still says pending, but a leg already lost: shown and filtered as lost.
    coupon('ako-lost-leg', 'pending', [leg('1', 'lost'), leg('2', 'pending')]),
    coupon('single-won', 'won', [leg('3', 'won')]),
    coupon('single-pending', 'pending', [leg('4', 'pending')]),
    coupon('refunded', 'refund', [leg('5', 'refund'), leg('6', 'refund')]),
  ];

  it('filters by the status derived from the legs, not the raw server status', () => {
    expect(deriveSportsbookCouponRows(coupons, 'lost').map((row) => row.id)).toEqual(['ako-lost-leg']);
    expect(deriveSportsbookCouponRows(coupons, 'pending').map((row) => row.id)).toEqual(['single-pending']);
    expect(deriveSportsbookCouponRows(coupons, 'refund').map((row) => row.id)).toEqual(['refunded']);
  });

  it('keeps every coupon for "all" with the derived status on each row', () => {
    expect(deriveSportsbookCouponRows(coupons, 'all').map((row) => [row.id, row.status])).toEqual([
      ['ako-lost-leg', 'lost'],
      ['single-won', 'won'],
      ['single-pending', 'pending'],
      ['refunded', 'refund'],
    ]);
  });
});
