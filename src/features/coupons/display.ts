interface CouponLegForDisplay {
  oddsAtTime: number;
}

interface CouponDisplayInput {
  totalOdds: number;
  legs: CouponLegForDisplay[];
}

const isPositiveNumber = (value: number) => Number.isFinite(value) && value > 0;

export function getDisplayedCouponOdds({ totalOdds, legs }: CouponDisplayInput): number {
  if (legs.length === 1) {
    const legOdds = legs[0]?.oddsAtTime;
    if (isPositiveNumber(legOdds)) return legOdds;
  }

  if (isPositiveNumber(totalOdds)) return totalOdds;
  return 1;
}
