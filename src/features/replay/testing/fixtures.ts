import type { CouponHistoryEntry } from '@/types/database';

export const REPLAY_TEST_NOW = Date.parse('2026-09-04T12:00:00Z');
export const REPLAY_TEST_USER_ID = '11111111-1111-4111-8111-111111111111';

export function coupon(overrides: Partial<CouponHistoryEntry> = {}): CouponHistoryEntry {
  return {
    id: 'coupon-1', total_odds: 2.5, stake: 10, payout: 25,
    status: 'won', created_at: '2026-09-03T12:00:00Z', legs: null,
    ...overrides,
  };
}

/** Fictional data for tests only. Never imported by production entry points. */
export function replayFixtures(count = 48): CouponHistoryEntry[] {
  const statuses: CouponHistoryEntry['status'][] = ['pending', 'lost', 'won', 'won', 'refund', 'lost', 'won'];
  const titles = ['Wieczór derbowy', 'Finał pod światłami', 'Mecz o wszystko', 'Sobotni klasyk', 'Dogrywka z ekipą'];
  return Array.from({ length: count }, (_, index) => {
    const status = statuses[index % statuses.length];
    const stake = 25 + index % 4 * 25;
    const odds = 1.5 + index % 8 * 0.75;
    return coupon({
      id: `fixture-${String(index).padStart(3, '0')}`,
      status, stake, total_odds: odds,
      payout: status === 'won' ? stake * odds : status === 'refund' ? stake : 0,
      created_at: new Date(REPLAY_TEST_NOW - (index * 16 + 2) * 3_600_000).toISOString(),
      legs: [{ id: `leg-${index}`, bet_id: `bet-${index}`, selected_option: 'Gospodarze', odds_at_time: odds, result: status, bet_title: titles[index % titles.length] }],
    });
  });
}
