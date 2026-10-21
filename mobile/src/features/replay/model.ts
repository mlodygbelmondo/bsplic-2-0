import type { CouponHistoryEntry, CouponLeg } from '@/types/database';

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

type Status = CouponHistoryEntry['status'];
const STATUSES = new Set<unknown>(['won', 'lost', 'pending', 'refund']);

class ReplayDataError extends Error {
  constructor(field: string) {
    super(`Nieprawidłowe dane Replay (${field}).`);
  }
}

/** Web zod `numeric`: numeric strings are converted; the result must be finite and >= 0. */
function numeric(value: unknown, field: string): number {
  const parsed = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof parsed !== 'number' || !Number.isFinite(parsed) || parsed < 0) throw new ReplayDataError(field);
  return parsed;
}

/** Keep even a full 200-coupon sum inside the integer-cent precision boundary. */
function money(value: unknown, field: string): number {
  const parsed = numeric(value, field);
  if (!Number.isSafeInteger(Math.round(parsed * 100)) || parsed > Number.MAX_SAFE_INTEGER / (REPLAY_LIMIT * 100)) {
    throw new ReplayDataError(field);
  }
  return parsed;
}

function status(value: unknown, field: string): Status {
  if (!STATUSES.has(value)) throw new ReplayDataError(field);
  return value as Status;
}

function string(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new ReplayDataError(field);
  return value;
}

function nullableString(value: unknown, field: string): string | null {
  return value === null ? null : string(value, field);
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new ReplayDataError(field);
  return value as Record<string, unknown>;
}

function parseLeg(input: unknown): CouponLeg {
  const row = record(input, 'legs');
  const leg: CouponLeg = {
    id: string(row.id, 'legs.id'),
    selected_option: string(row.selected_option, 'legs.selected_option'),
    odds_at_time: numeric(row.odds_at_time, 'legs.odds_at_time'),
    result: status(row.result, 'legs.result'),
    bet_title: nullableString(row.bet_title, 'legs.bet_title'),
  };
  if (row.bet_id !== undefined) leg.bet_id = nullableString(row.bet_id, 'legs.bet_id');
  return leg;
}

/** Unknown keys are dropped, like the web's zod object schema. */
function parseCoupon(input: unknown): CouponHistoryEntry {
  const row = record(input, 'coupon');
  const id = string(row.id, 'id');
  if (id.length === 0) throw new ReplayDataError('id');
  const createdAt = string(row.created_at, 'created_at');
  if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(createdAt) || !Number.isFinite(Date.parse(createdAt))) {
    throw new ReplayDataError('created_at');
  }
  if (row.legs !== null && !Array.isArray(row.legs)) throw new ReplayDataError('legs');
  return {
    id,
    total_odds: numeric(row.total_odds, 'total_odds'),
    stake: money(row.stake, 'stake'),
    payout: money(row.payout, 'payout'),
    status: status(row.status, 'status'),
    created_at: createdAt,
    legs: row.legs === null ? null : (row.legs as unknown[]).map(parseLeg),
  };
}

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
  if (!Array.isArray(input)) throw new ReplayDataError('history');
  const rows = input.map(parseCoupon);
  const unique = [...new Map(rows.map((row) => [row.id, row])).values()];
  unique.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || a.id.localeCompare(b.id));
  return {
    coupons: unique.slice(0, REPLAY_LIMIT),
    hasMore: rows.length > REPLAY_LIMIT,
    capturedAt,
  };
}

/*
 * The web formats with Intl ('pl-PL', Europe/Warsaw). Hermes delegates Intl to
 * the platform, whose ICU data and grouping rules differ, so the same output is
 * produced here deterministically: Polish short months, CET/CEST (EU rule:
 * summer time from the last Sunday of March to the last Sunday of October,
 * switching at 01:00 UTC), U+00A0 grouping from five integer digits.
 */
const MONTHS = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
const HOUR_MS = 3_600_000;

function lastSundayAt1Utc(year: number, month: number): number {
  const lastDay = new Date(Date.UTC(year, month + 1, 0));
  return Date.UTC(year, month, lastDay.getUTCDate() - lastDay.getUTCDay(), 1);
}

function warsawDate(value: string | number): Date {
  const time = new Date(value).getTime();
  const year = new Date(time).getUTCFullYear();
  const summer = time >= lastSundayAt1Utc(year, 2) && time < lastSundayAt1Utc(year, 9);
  return new Date(time + (summer ? 2 : 1) * HOUR_MS);
}

function warsawDayKey(value: string): string {
  const date = warsawDate(value);
  return `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
}

export function formatReplayDate(value: string | number): string {
  const date = warsawDate(value);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function formatPolishAmount(value: number): string {
  const [integer, fraction] = Math.abs(value).toFixed(2).split('.');
  const grouped = integer.length >= 5 ? integer.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : integer;
  return `${value < 0 ? '-' : ''}${grouped},${fraction}`;
}

export function formatReplayMoney(cents: number, signed = false): string {
  return `${signed && cents > 0 ? '+' : ''}${formatPolishAmount(cents / 100)} zł`;
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
    activeDays: new Set(coupons.map((coupon) => warsawDayKey(coupon.created_at))).size,
    winRate: decidedCount ? Math.round(counts.won / decidedCount * 100) : null,
    netCents: payoutCents - stakeCents,
    stakeCents,
    payoutCents,
    timeline,
    highlight: highlight ?? coupons[coupons.length - 1] ?? null,
  };
}

export interface ReplayChartPoint {
  x: number;
  y: number;
}

/**
 * Include a zero origin. The curve is coupon-order performance, never wallet
 * balance. Coordinates live in the web's 1000 × 320 design space.
 */
export function replayChart(values: number[]) {
  const series = [0, ...values];
  const min = Math.min(0, ...series);
  const max = Math.max(0, ...series);
  const span = max - min || 1;
  const y = (value: number) => max === min ? 160 : 280 - (value - min) / span * 240;
  const points: ReplayChartPoint[] = series.map((value, index) => ({
    x: 24 + index / Math.max(1, series.length - 1) * 952,
    y: y(value),
  }));
  return {
    points,
    zeroY: y(0),
    path: points.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' '),
  };
}
