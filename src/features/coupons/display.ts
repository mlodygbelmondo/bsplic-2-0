interface CouponLegForDisplay {
  oddsAtTime: number;
  result?: 'pending' | 'won' | 'lost' | 'refund';
}

interface CouponLegForWinDisplay {
  legPayout?: number;
}

interface CouponLegForStatus {
  result: 'pending' | 'won' | 'lost' | 'refund';
}

interface CouponDisplayInput {
  totalOdds: number;
  legs: CouponLegForDisplay[];
}

interface CouponWinDisplayInput {
  status: 'pending' | 'won' | 'lost' | 'refund';
  isAko: boolean;
  stake: number;
  displayedOdds: number;
  couponPayout: number;
  legs: CouponLegForWinDisplay[];
}

interface CouponStatusInput {
  status: 'pending' | 'won' | 'lost' | 'refund' | null | undefined;
  legs: CouponLegForStatus[];
}

const isPositiveNumber = (value: number) => Number.isFinite(value) && value > 0;
const roundMoney = (value: number) => Math.round(value * 100) / 100;

export function getDisplayedCouponOdds({ totalOdds, legs }: CouponDisplayInput): number {
  if (legs.length > 1 && legs.some((leg) => leg.result === 'refund')) {
    const hasInvalidLegOdds = legs.some((leg) => !isPositiveNumber(leg.oddsAtTime));
    if (!hasInvalidLegOdds) {
      return legs.reduce((product, leg) => {
        const effectiveOdds = leg.result === 'refund' ? 1 : leg.oddsAtTime;
        return product * effectiveOdds;
      }, 1);
    }
  }

  if (legs.length === 1) {
    const legOdds = legs[0]?.oddsAtTime;
    if (isPositiveNumber(legOdds)) return legOdds;
  }

  if (isPositiveNumber(totalOdds)) return totalOdds;
  return 1;
}

export function deriveCouponStatus({ status, legs }: CouponStatusInput): 'pending' | 'won' | 'lost' | 'refund' {
  const hasLegs = legs.length > 0;

  if (status === 'refund' && (!hasLegs || legs.every((leg) => leg.result === 'refund'))) {
    return 'refund';
  }

  const hasLostLeg = legs.some((leg) => leg.result === 'lost');
  if (hasLostLeg) return 'lost';

  const allResolved = hasLegs && legs.every((leg) => leg.result === 'won' || leg.result === 'lost' || leg.result === 'refund');
  const allRefund = hasLegs && legs.every((leg) => leg.result === 'refund');

  if (allResolved && allRefund) return 'refund';
  if (allResolved) return 'won';

  if (status === 'won' || status === 'lost') return status;
  return 'pending';
}

export function getDisplayedCouponWin({
  status,
  isAko,
  stake,
  displayedOdds,
  couponPayout,
  legs,
}: CouponWinDisplayInput): number {
  if (status === 'refund') {
    if (isPositiveNumber(couponPayout)) return couponPayout;
    if (isPositiveNumber(stake)) return roundMoney(stake);
    return 0;
  }

  if (status !== 'won') return 0;

  if (isAko) {
    if (isPositiveNumber(couponPayout)) return couponPayout;
    if (isPositiveNumber(stake) && isPositiveNumber(displayedOdds)) {
      return roundMoney(stake * displayedOdds);
    }
    return 0;
  }

  const legPayout = legs[0]?.legPayout;
  if (isPositiveNumber(legPayout ?? 0)) return legPayout as number;

  if (isPositiveNumber(stake) && isPositiveNumber(displayedOdds)) {
    return roundMoney(stake * displayedOdds);
  }

  if (isPositiveNumber(couponPayout)) return couponPayout;
  return 0;
}
