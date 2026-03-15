export interface CouponSettlementSnapshot {
  stake: number;
  totalOdds: number;
  status: 'pending' | 'won' | 'lost';
  payout: number;
}

interface CalculateLegOutcomeInput {
  selectedOption: string;
  winningOption: string;
  stake: number;
  oddsAtTime: number;
}

interface CalculateCreditAmountInput {
  legWon: boolean;
  legPayout: number;
  couponBefore: CouponSettlementSnapshot | null;
  couponAfter: CouponSettlementSnapshot | null;
}

const roundMoney = (value: number) => Math.round(value * 100) / 100;

export function calculateLegOutcome({
  selectedOption,
  winningOption,
  stake,
  oddsAtTime,
}: CalculateLegOutcomeInput): { result: 'won' | 'lost'; won: boolean; payout: number } {
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
  couponBefore,
  couponAfter,
}: CalculateCreditAmountInput): number {
  if (!legWon) return 0;

  if (!couponBefore || !couponAfter) {
    return legPayout;
  }

  const isAkoCoupon = couponBefore.totalOdds > 1 || couponAfter.totalOdds > 1;

  if (!isAkoCoupon) {
    return legPayout;
  }

  if (couponBefore.status !== 'won' && couponAfter.status === 'won') {
    const resolvedPayout = couponAfter.payout > 0
      ? couponAfter.payout
      : couponAfter.stake * couponAfter.totalOdds;

    return roundMoney(resolvedPayout);
  }

  return 0;
}
