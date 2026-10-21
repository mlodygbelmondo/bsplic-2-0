import { describe, expect, it } from 'vitest';

import { buildReplay, formatReplayDate, formatReplayMoney, parseReplayHistory, replayChart } from './model';
import { coupon, REPLAY_TEST_NOW } from './testing/fixtures';

const parse = (rows: unknown) => parseReplayHistory(rows, REPLAY_TEST_NOW);

describe('Replay history contract', () => {
  it('normalizes numeric database strings without trusting malformed rows', () => {
    expect(parse([{ ...coupon(), stake: '10.20', payout: '25.50', total_odds: '2.5' }]).coupons[0]).toMatchObject({ stake: 10.2, payout: 25.5, total_odds: 2.5 });
  });
  const invalidInputs = [null, {}, [null], [coupon({ created_at: 'not-a-date' })], [coupon({ created_at: '2026-09-03T12:00:00' })], [coupon({ stake: -1 })], [coupon({ payout: Infinity })], [coupon({ payout: NaN })], [{ ...coupon(), stake: '' }], [{ ...coupon(), payout: null }], [{ ...coupon(), status: 'mystery' }], [coupon({ stake: Number.MAX_SAFE_INTEGER })]];
  it.each(invalidInputs.map((input) => [input]))('rejects invalid input %j', (input) => {
    expect(() => parse(input)).toThrow();
  });
  it('deduplicates and sorts without mutating the input', () => {
    const older = coupon({ id: 'older', created_at: '2026-09-01T12:00:00Z' });
    const rows = [older, coupon(), coupon()];
    expect(parse(rows).coupons.map((row) => row.id)).toEqual(['coupon-1', 'older']);
    expect(rows[0]).toBe(older);
    expect(rows).toHaveLength(3);
  });
  it('uses the sentinel to disclose a capped history', () => {
    const history = parse(Array.from({ length: 201 }, (_, index) => coupon({ id: String(index) })));
    expect(history.coupons).toHaveLength(200);
    expect(history.hasMore).toBe(true);
    expect(buildReplay(history, 'all').limited).toBe(true);
    expect(buildReplay(history, '30').coverageLabel).toContain('limit 200');
  });
  it('does not label a fully covered short period as partial', () => {
    const history = parse([coupon(), coupon({ id: 'old', created_at: '2026-01-01T00:00:00Z' })]);
    history.hasMore = true;
    expect(buildReplay(history, '7').limited).toBe(false);
    expect(buildReplay(history, 'all').limited).toBe(true);
  });
});

describe('honest Replay statistics', () => {
  it('uses settled net profit, includes refunds and excludes pending stakes', () => {
    const model = buildReplay(parse([
      coupon(),
      coupon({ id: 'loss', status: 'lost', stake: 8, payout: 0 }),
      coupon({ id: 'refund', status: 'refund', stake: 30, payout: 30 }),
      coupon({ id: 'pending', status: 'pending', stake: 1000, payout: 9000 }),
    ]), '30');
    expect(model.counts).toEqual({ won: 1, lost: 1, refund: 1, pending: 1 });
    expect(model.stakeCents).toBe(4800);
    expect(model.payoutCents).toBe(5500);
    expect(model.netCents).toBe(700);
    expect(model.settledCount).toBe(3);
    expect(model.winRate).toBe(50);
    expect(model.timeline[model.timeline.length - 1]?.cumulativeCents).toBe(700);
  });
  it('sums integer cents rather than floating point currency', () => {
    const model = buildReplay(parse([coupon({ stake: 0.1, payout: 0.3 }), coupon({ id: 'two', stake: 0.2, payout: 0.4 })]), '30');
    expect(model.netCents).toBe(40);
  });
  it('retains negative results instead of inventing a winning highlight', () => {
    const model = buildReplay(parse([coupon({ status: 'lost', payout: 0 })]), 'all');
    expect(model.netCents).toBe(-1000);
    expect(model.winRate).toBe(0);
    expect(model.highlight?.status).toBe('lost');
    expect(formatReplayMoney(model.netCents, true)).toContain('-10,00');
  });
  it('has no invented accuracy or loss for pending-only history', () => {
    const model = buildReplay(parse([coupon({ status: 'pending', payout: 0 })]), 'all');
    expect(model.netCents).toBe(0);
    expect(model.winRate).toBeNull();
    expect(model.timeline).toEqual([]);
  });
  it('handles empty history', () => {
    expect(buildReplay(parse([]), 'all')).toMatchObject({ coupons: [], highlight: null, activeDays: 0, netCents: 0, winRate: null });
  });
  it('selects the biggest actual winning payout, not total odds or pending payout', () => {
    const model = buildReplay(parse([coupon(), coupon({ id: 'big', payout: 100, total_odds: 1.5 }), coupon({ id: 'pending', status: 'pending', payout: 10000 })]), 'all');
    expect(model.highlight?.id).toBe('big');
  });
  it('filters inclusively by the creation timestamp and excludes future rows', () => {
    const boundary = new Date(REPLAY_TEST_NOW - 7 * 86_400_000).toISOString();
    const model = buildReplay(parse([coupon(), coupon({ id: 'boundary', created_at: boundary }), coupon({ id: 'old', created_at: '2026-08-28T11:59:59Z' }), coupon({ id: 'future', created_at: '2026-09-05T00:00:00Z' })]), '7');
    expect(model.coupons.map((row) => row.id)).toEqual(['boundary', 'coupon-1']);
  });
  it('counts days in Warsaw rather than the browser timezone', () => {
    const model = buildReplay(parse([coupon({ created_at: '2026-09-02T22:30:00Z' }), coupon({ id: 'two', created_at: '2026-09-03T00:30:00Z' })]), '7');
    expect(model.activeDays).toBe(1);
    expect(formatReplayDate('2026-09-02T22:30:00Z')).toBe(formatReplayDate('2026-09-03T00:30:00Z'));
  });
});

describe('Replay curve', () => {
  const examples = [[], [0], [10], [-10], [10, -20, 30], [0, 0]];
  it.each(examples.map((values) => [values]))('keeps the zero origin and finite coordinates: %j', (values) => {
    const chart = replayChart(values);
    expect(chart.points).toHaveLength(values.length + 1);
    expect(chart.points[0].x).toBe(24);
    expect(chart.path).not.toMatch(/NaN|Infinity/);
    chart.points.forEach(({ x, y }) => {
      expect(x).toBeGreaterThanOrEqual(24);
      expect(x).toBeLessThanOrEqual(976);
      expect(y).toBeGreaterThanOrEqual(40);
      expect(y).toBeLessThanOrEqual(280);
    });
  });
});

// Expected strings are the web's Intl output ('pl-PL', Europe/Warsaw) captured from Node's ICU.
describe('Replay formatting matches the web', () => {
  it.each([
    [0, '0,00 zł'],
    [5, '0,05 zł'],
    [1500, '15,00 zł'],
    [123450, '1234,50 zł'],
    [1234550, '12 345,50 zł'],
    [123456789, '1 234 567,89 zł'],
    [-1000, '-10,00 zł'],
    [-1234568, '-12 345,68 zł'],
  ])('formats %d cents as %s', (cents, expected) => {
    expect(formatReplayMoney(cents)).toBe(expected);
  });
  it('adds a plus sign only to positive signed amounts', () => {
    expect(formatReplayMoney(1500, true)).toBe('+15,00 zł');
    expect(formatReplayMoney(0, true)).toBe('0,00 zł');
    expect(formatReplayMoney(-1000, true)).toBe('-10,00 zł');
  });
  it.each([
    ['2026-03-28T22:30:00Z', '28 mar 2026'],
    ['2026-10-24T22:30:00Z', '25 paź 2026'],
    ['2026-10-25T22:30:00Z', '25 paź 2026'],
    ['2026-06-30T22:30:00Z', '1 lip 2026'],
    ['2025-12-31T23:30:00Z', '1 sty 2026'],
    ['2026-09-03T12:00:00.123456+00:00', '3 wrz 2026'],
  ])('formats %s in Warsaw time as %s', (value, expected) => {
    expect(formatReplayDate(value)).toBe(expected);
  });
  it('labels the range with an em dash and the empty state with the capture date', () => {
    const model = buildReplay(parse([coupon(), coupon({ id: 'old', created_at: '2026-08-30T10:00:00Z' })]), '30');
    expect(model.rangeLabel).toBe('30 sie 2026 — 3 wrz 2026');
    expect(buildReplay(parse([]), '7').rangeLabel).toBe('Stan na 4 wrz 2026');
  });
});
