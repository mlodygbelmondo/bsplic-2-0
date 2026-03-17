interface CouponLegForDisplay {
  oddsAtTime: number;
}

interface CouponLegForWinDisplay {
  legPayout?: number;
}

interface CouponDisplayInput {
  totalOdds: number;
  legs: CouponLegForDisplay[];
}

interface CouponWinDisplayInput {
  status: 'pending' | 'won' | 'lost';
  isAko: boolean;
  stake: number;
  displayedOdds: number;
  couponPayout: number;
  legs: CouponLegForWinDisplay[];
}

const isPositiveNumber = (value: number) => Number.isFinite(value) && value > 0;
const roundMoney = (value: number) => Math.round(value * 100) / 100;

export function getDisplayedCouponOdds({ totalOdds, legs }: CouponDisplayInput): number {
  if (legs.length === 1) {
    const legOdds = legs[0]?.oddsAtTime;
    if (isPositiveNumber(legOdds)) return legOdds;
  }

  if (isPositiveNumber(totalOdds)) return totalOdds;
  return 1;
}

export function getDisplayedCouponWin({
  status,
  isAko,
  stake,
  displayedOdds,
  couponPayout,
  legs,
}: CouponWinDisplayInput): number {
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
