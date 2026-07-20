export interface RankingPlacedBet {
  couponId: string | null;
  result: 'pending' | 'won' | 'lost' | 'refund';
  stake: number;
  payout: number;
}

export interface RankingCoupon {
  id: string;
  stake: number;
  totalOdds: number;
  payout: number;
}

interface RankingUnit {
  result: 'pending' | 'won' | 'lost' | 'refund';
}

interface ComputeRankingStatsInput {
  placedBets: RankingPlacedBet[];
  coupons: RankingCoupon[];
}

interface RankingStats {
  totalBets: number;
  wonBets: number;
  lostBets: number;
  resolvedBets: number;
  winRate: number;
  totalProfit: number;
}

const roundMoney = (value: number) => Math.round(value * 100) / 100;
const roundPercent = (value: number) => Math.round(value * 10) / 10;

function computeCouponUnit(legs: RankingPlacedBet[]): RankingUnit {
  const lostCount = legs.filter((leg) => leg.result === 'lost').length;
  const resolvedCount = legs.filter((leg) => leg.result === 'won' || leg.result === 'lost' || leg.result === 'refund').length;
  const refundCount = legs.filter((leg) => leg.result === 'refund').length;

  if (lostCount > 0) return { result: 'lost' };
  if (legs.length > 0 && refundCount === legs.length) return { result: 'refund' };
  if (legs.length > 0 && resolvedCount === legs.length) return { result: 'won' };
  return { result: 'pending' };
}

function buildRankingUnits(input: ComputeRankingStatsInput): RankingUnit[] {
  const couponById = new Map(input.coupons.map((coupon) => [coupon.id, coupon]));
  const legsByCoupon = new Map<string, RankingPlacedBet[]>();
  const units: RankingUnit[] = [];

  for (const bet of input.placedBets) {
    if (!bet.couponId) {
      units.push({ result: bet.result });
      continue;
    }

    const coupon = couponById.get(bet.couponId);
    if (!coupon || coupon.totalOdds <= 1) {
      units.push({ result: bet.result });
      continue;
    }

    const current = legsByCoupon.get(bet.couponId) ?? [];
    current.push(bet);
    legsByCoupon.set(bet.couponId, current);
  }

  for (const legs of legsByCoupon.values()) {
    units.push(computeCouponUnit(legs));
  }

  return units;
}

export function computeRankingStats(input: ComputeRankingStatsInput): RankingStats {
  const units = buildRankingUnits(input);
  const couponById = new Map(input.coupons.map((coupon) => [coupon.id, coupon]));
  const akoLegsByCoupon = new Map<string, RankingPlacedBet[]>();

  let totalProfitRaw = 0;

  for (const bet of input.placedBets) {
    const coupon = bet.couponId ? couponById.get(bet.couponId) : null;
    const isAkoCoupon = Boolean(coupon && coupon.totalOdds > 1);

    if (isAkoCoupon && bet.couponId) {
      const current = akoLegsByCoupon.get(bet.couponId) ?? [];
      current.push(bet);
      akoLegsByCoupon.set(bet.couponId, current);
      continue;
    }

    if (bet.result === 'won') {
      const resolvedPayout = bet.payout > 0 ? bet.payout : bet.stake;
      totalProfitRaw += resolvedPayout - bet.stake;
      continue;
    }

    if (bet.result === 'lost') {
      totalProfitRaw -= bet.stake;
    }
  }

  for (const [couponId, legs] of akoLegsByCoupon.entries()) {
    const coupon = couponById.get(couponId);
    if (!coupon) continue;

    const lostCount = legs.filter((leg) => leg.result === 'lost').length;
    const resolvedCount = legs.filter((leg) => leg.result === 'won' || leg.result === 'lost' || leg.result === 'refund').length;
    const refundCount = legs.filter((leg) => leg.result === 'refund').length;

    if (lostCount > 0) {
      totalProfitRaw -= coupon.stake;
      continue;
    }

    if (legs.length > 0 && refundCount === legs.length) {
      continue;
    }

    if (legs.length > 0 && resolvedCount === legs.length) {
      const resolvedPayout = coupon.payout > 0
        ? coupon.payout
        : coupon.stake * coupon.totalOdds;

      totalProfitRaw += resolvedPayout - coupon.stake;
    }
  }

  const totalBets = units.length;
  const wonBets = units.filter((unit) => unit.result === 'won').length;
  const lostBets = units.filter((unit) => unit.result === 'lost').length;
  const resolvedBets = wonBets + lostBets;

  const winRate = resolvedBets > 0 ? roundPercent((wonBets / resolvedBets) * 100) : 0;
  const totalProfit = roundMoney(totalProfitRaw);

  return {
    totalBets,
    wonBets,
    lostBets,
    resolvedBets,
    winRate,
    totalProfit,
  };
}
