export interface CouponSettlementSnapshot {
  stake: number;
  totalOdds: number;
  status: 'pending' | 'won' | 'lost' | 'refund';
  payout: number;
}

export type LegSettlementMode = 'normal' | 'refund' | 'force_lost';
export type LegResult = 'won' | 'lost' | 'refund';

interface CalculateLegOutcomeInput {
  selectedOption: string;
  winningOption: string;
  stake: number;
  oddsAtTime: number;
  mode?: LegSettlementMode;
}

interface CalculateCreditAmountInput {
  legWon: boolean;
  legPayout: number;
  legResult?: LegResult;
  couponBefore: CouponSettlementSnapshot | null;
  couponAfter: CouponSettlementSnapshot | null;
}

interface CalculateCreditDeltaAmountInput {
  previousLegResult: LegResult | 'pending';
  previousLegPayout: number;
  nextLegResult: LegResult;
  nextLegPayout: number;
  couponBefore: CouponSettlementSnapshot | null;
  couponAfter: CouponSettlementSnapshot | null;
}

interface AddCreditForUserInput {
  creditsByUser: Record<string, number>;
  userId: string;
  amount: number;
}

const roundMoney = (value: number) => Math.round(value * 100) / 100;

const getLegBalanceImpact = (result: LegResult | 'pending', payout: number): number => {
  if (result === 'won' || result === 'refund') return roundMoney(payout);
  return 0;
};

const getCouponBalanceImpact = (coupon: CouponSettlementSnapshot | null): number => {
  if (!coupon) return 0;

  if (coupon.status === 'won') {
    const resolvedPayout = coupon.payout > 0
      ? coupon.payout
      : coupon.stake * coupon.totalOdds;
    return roundMoney(resolvedPayout);
  }

  if (coupon.status === 'refund') {
    const resolvedPayout = coupon.payout > 0
      ? coupon.payout
      : coupon.stake;
    return roundMoney(resolvedPayout);
  }

  return 0;
};

export function addCreditForUser({ creditsByUser, userId, amount }: AddCreditForUserInput): Record<string, number> {
  if (amount === 0) return creditsByUser;

  const previous = creditsByUser[userId] ?? 0;
  return {
    ...creditsByUser,
    [userId]: roundMoney(previous + amount),
  };
}

export function calculateCreditDeltaAmount({
  previousLegResult,
  previousLegPayout,
  nextLegResult,
  nextLegPayout,
  couponBefore,
  couponAfter,
}: CalculateCreditDeltaAmountInput): number {
  const isAkoCoupon = Boolean(couponBefore || couponAfter)
    && ((couponBefore?.totalOdds ?? 1) > 1 || (couponAfter?.totalOdds ?? 1) > 1);

  if (!isAkoCoupon) {
    const beforeImpact = getLegBalanceImpact(previousLegResult, previousLegPayout);
    const afterImpact = getLegBalanceImpact(nextLegResult, nextLegPayout);
    return roundMoney(afterImpact - beforeImpact);
  }

  const beforeImpact = getCouponBalanceImpact(couponBefore);
  const afterImpact = getCouponBalanceImpact(couponAfter);
  return roundMoney(afterImpact - beforeImpact);
}

export function calculateLegOutcome({
  selectedOption,
  winningOption,
  stake,
  oddsAtTime,
  mode = 'normal',
}: CalculateLegOutcomeInput): { result: LegResult; won: boolean; payout: number } {
  if (mode === 'force_lost') {
    return {
      result: 'lost',
      won: false,
      payout: 0,
    };
  }

  if (mode === 'refund') {
    return {
      result: 'refund',
      won: false,
      payout: roundMoney(stake),
    };
  }

  const won = selectedOption === winningOption;
  const payout = won ? roundMoney(stake * oddsAtTime) : 0;

  return {
    result: won ? 'won' : 'lost',
    won,
    payout,
  };
}

export function calculateCreditAmount({
  legWon,
  legPayout,
  legResult,
  couponBefore,
  couponAfter,
}: CalculateCreditAmountInput): number {
  const resolvedLegResult: LegResult = legResult ?? (legWon ? 'won' : 'lost');
  const delta = calculateCreditDeltaAmount({
    previousLegResult: 'pending',
    previousLegPayout: 0,
    nextLegResult: resolvedLegResult,
    nextLegPayout: legPayout,
    couponBefore,
    couponAfter,
  });

  return delta > 0 ? delta : 0;
}
