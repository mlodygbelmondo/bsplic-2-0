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

interface AddCreditForUserInput {
  creditsByUser: Record<string, number>;
  userId: string;
  amount: number;
}

const roundMoney = (value: number) => Math.round(value * 100) / 100;

export function addCreditForUser({ creditsByUser, userId, amount }: AddCreditForUserInput): Record<string, number> {
  if (amount <= 0) return creditsByUser;

  const previous = creditsByUser[userId] ?? 0;
  return {
    ...creditsByUser,
    [userId]: roundMoney(previous + amount),
  };
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

  if (resolvedLegResult === 'lost') return 0;

  if (!couponBefore || !couponAfter) {
    if (resolvedLegResult === 'refund') {
      return roundMoney(legPayout);
    }

    return legWon ? legPayout : 0;
  }

  const isAkoCoupon = couponBefore.totalOdds > 1 || couponAfter.totalOdds > 1;

  if (!isAkoCoupon) {
    if (resolvedLegResult === 'refund') {
      return roundMoney(legPayout);
    }

    return legWon ? legPayout : 0;
  }

  if (couponBefore.status !== 'won' && couponAfter.status === 'won') {
    const resolvedPayout = couponAfter.payout > 0
      ? couponAfter.payout
      : couponAfter.stake * couponAfter.totalOdds;

    return roundMoney(resolvedPayout);
  }

  if (couponBefore.status !== 'refund' && couponAfter.status === 'refund') {
    const resolvedPayout = couponAfter.payout > 0
      ? couponAfter.payout
      : couponAfter.stake;

    return roundMoney(resolvedPayout);
  }

  return 0;
}
