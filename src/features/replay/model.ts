import { z } from 'zod';

import type { CouponHistoryEntry } from '@/types/database';

export const REPLAY_LIMIT = 200;
export type ReplayPeriod = '7' | '30' | 'all';
export const PERIOD_LABELS: Record<ReplayPeriod, string> = {
  '7': '7 dni',
  '30': '30 dni',
  all: 'Ostatnie kupony',
};
export const STATUS_LABELS: Record<CouponHistoryEntry['status'], string> = {
  won: 'Wygrany',
  lost: 'Przegrany',
  pending: 'W grze',
  refund: 'Zwrot',
};

const numeric = z.preprocess(
  (value) => typeof value === 'string' && value.trim() !== '' ? Number(value) : value,
  z.number().finite().nonnegative(),
);
// Keep even a full 200-coupon sum inside the integer-cent precision boundary.
const money = numeric.refine((value) =>
  Number.isSafeInteger(Math.round(value * 100))
  && value <= Number.MAX_SAFE_INTEGER / (REPLAY_LIMIT * 100),
);
const status = z.enum(['won', 'lost', 'pending', 'refund']);
const couponSchema = z.object({
  id: z.string().min(1),
  total_odds: numeric,
  stake: money,
  payout: money,
  status,
  created_at: z.string().refine((value) =>
    /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) && Number.isFinite(Date.parse(value)),
  ),
  legs: z.array(z.object({
    id: z.string(),
    bet_id: z.string().nullable().optional(),
    selected_option: z.string(),
    odds_at_time: numeric,
    result: status,
    bet_title: z.string().nullable(),
  })).nullable(),
});

export interface ReplayHistory {
  coupons: CouponHistoryEntry[];
  hasMore: boolean;
  capturedAt: number;
}

export interface ReplayMoment {
  coupon: CouponHistoryEntry;
  netCents: number;
  cumulativeCents: number;
}

export interface ReplayModel {
  period: ReplayPeriod;
  periodLabel: string;
  rangeLabel: string;
  coverageLabel: string;
  limited: boolean;
  coupons: CouponHistoryEntry[];
  counts: Record<CouponHistoryEntry['status'], number>;
  settledCount: number;
  activeDays: number;
  winRate: number | null;
  netCents: number;
  stakeCents: number;
  payoutCents: number;
  timeline: ReplayMoment[];
  highlight: CouponHistoryEntry | null;
}

export function parseReplayHistory(input: unknown, capturedAt = Date.now()): ReplayHistory {
  const rows = z.array(couponSchema).parse(input);
  const unique = [...new Map(rows.map((row) => [row.id, row])).values()];
  unique.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || a.id.localeCompare(b.id));
  return {
    coupons: unique.slice(0, REPLAY_LIMIT),
    hasMore: rows.length > REPLAY_LIMIT,
    capturedAt,
  };
}

const dateFormatter = new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Warsaw',
});
const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Warsaw',
});
const moneyFormatter = new Intl.NumberFormat('pl-PL', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

export function formatReplayDate(value: string | number): string {
  return dateFormatter.format(new Date(value));
}

export function formatReplayMoney(cents: number, signed = false): string {
  return `${signed && cents > 0 ? '+' : ''}${moneyFormatter.format(cents / 100)} zł`;
}

export function buildReplay(history: ReplayHistory, period: ReplayPeriod): ReplayModel {
  const cutoff = period === 'all' ? -Infinity : history.capturedAt - Number(period) * 86_400_000;
  const coupons = history.coupons
    .filter((coupon) => Date.parse(coupon.created_at) >= cutoff && Date.parse(coupon.created_at) <= history.capturedAt)
    .slice()
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.id.localeCompare(b.id));
  const oldest = history.coupons[history.coupons.length - 1];
  const limited = history.hasMore && (!oldest || Date.parse(oldest.created_at) >= cutoff);
  const counts: ReplayModel['counts'] = { won: 0, lost: 0, refund: 0, pending: 0 };
  let stakeCents = 0;
  let payoutCents = 0;
  let highlight: CouponHistoryEntry | null = null;
  const timeline: ReplayMoment[] = [];
  for (const coupon of coupons) {
    counts[coupon.status] += 1;
    if (coupon.status === 'won' && (!highlight || coupon.payout >= highlight.payout)) {
      highlight = coupon;
    }
    if (coupon.status === 'pending') continue;
    const stake = Math.round(coupon.stake * 100);
    const payout = Math.round(coupon.payout * 100);
    stakeCents += stake;
    payoutCents += payout;
    timeline.push({ coupon, netCents: payout - stake, cumulativeCents: payoutCents - stakeCents });
  }
  const decidedCount = counts.won + counts.lost;
  return {
    period,
    periodLabel: PERIOD_LABELS[period],
    rangeLabel: coupons.length
      ? `${formatReplayDate(coupons[0].created_at)} — ${formatReplayDate(coupons[coupons.length - 1].created_at)}`
      : `Stan na ${formatReplayDate(history.capturedAt)}`,
    coverageLabel: limited ? 'Część historii · limit 200 kuponów' : 'Pełny dostępny zakres',
    limited,
    coupons,
    counts,
    settledCount: timeline.length,
    activeDays: new Set(coupons.map((coupon) => dayFormatter.format(new Date(coupon.created_at)))).size,
    winRate: decidedCount ? Math.round(counts.won / decidedCount * 100) : null,
    netCents: payoutCents - stakeCents,
    stakeCents,
    payoutCents,
    timeline,
    highlight: highlight ?? coupons[coupons.length - 1] ?? null,
  };
}

/** Include a zero origin. The curve is coupon-order performance, never wallet balance. */
export function replayChart(values: number[]) {
  const series = [0, ...values];
  const min = Math.min(0, ...series);
  const max = Math.max(0, ...series);
  const span = max - min || 1;
  const y = (value: number) => max === min ? 160 : 280 - (value - min) / span * 240;
  const points = series.map((value, index) => ({
    x: 24 + index / Math.max(1, series.length - 1) * 952,
    y: y(value),
  }));
  return {
    points,
    zeroY: y(0),
    path: points.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' '),
  };
}
