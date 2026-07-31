import type { CouponHistoryEntry } from '@/types/database';

export function getCasinoGameLabel(gameType: string) {
  const normalized = gameType.trim().toLocaleLowerCase('pl-PL');
  return normalized === 'roulette' || normalized === 'ruletka' ? 'Ruletka' : 'Blackjack';
}

type CouponStatus = CouponHistoryEntry['status'];

const isPositiveNumber = (value: number) => Number.isFinite(value) && value > 0;
const roundMoney = (value: number) => Math.round(value * 100) / 100;

export function deriveCouponStatus(coupon: CouponHistoryEntry): CouponStatus {
  const legs = coupon.legs ?? [];

  if (
    coupon.status === 'refund'
    && (legs.length === 0 || legs.every((leg) => leg.result === 'refund'))
  ) {
    return 'refund';
  }
  if (legs.some((leg) => leg.result === 'lost')) return 'lost';

  const allResolved = legs.length > 0 && legs.every(
    (leg) => leg.result === 'won' || leg.result === 'lost' || leg.result === 'refund',
  );
  if (allResolved && legs.every((leg) => leg.result === 'refund')) return 'refund';
  if (allResolved) return 'won';
  if (coupon.status === 'won' || coupon.status === 'lost') return coupon.status;
  return 'pending';
}

export function getDisplayedCouponOdds(coupon: CouponHistoryEntry): number {
  const legs = coupon.legs ?? [];

  if (legs.length > 1 && legs.some((leg) => leg.result === 'refund')) {
    if (legs.every((leg) => isPositiveNumber(Number(leg.odds_at_time)))) {
      return legs.reduce(
        (product, leg) => product * (leg.result === 'refund' ? 1 : Number(leg.odds_at_time)),
        1,
      );
    }
  }

  if (legs.length === 1 && isPositiveNumber(Number(legs[0].odds_at_time))) {
    return Number(legs[0].odds_at_time);
  }
  return isPositiveNumber(Number(coupon.total_odds)) ? Number(coupon.total_odds) : 1;
}

export function getDisplayedCouponWin(
  coupon: CouponHistoryEntry,
  status = deriveCouponStatus(coupon),
): number {
  const stake = Number(coupon.stake);
  const payout = Number(coupon.payout);
  const odds = getDisplayedCouponOdds(coupon);
  const legs = coupon.legs ?? [];

  if (status === 'refund') {
    if (isPositiveNumber(payout)) return payout;
    return isPositiveNumber(stake) ? roundMoney(stake) : 0;
  }
  if (status !== 'won') return 0;

  if (legs.length > 1) {
    if (isPositiveNumber(payout)) return payout;
    return isPositiveNumber(stake) && isPositiveNumber(odds)
      ? roundMoney(stake * odds)
      : 0;
  }

  const legPayout = Number(legs[0]?.leg_payout ?? 0);
  if (isPositiveNumber(legPayout)) return legPayout;
  if (isPositiveNumber(stake) && isPositiveNumber(odds)) return roundMoney(stake * odds);
  return isPositiveNumber(payout) ? payout : 0;
}
