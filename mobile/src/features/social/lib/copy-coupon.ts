import type { Bet, CouponItem, CouponLeg } from '@/types/database';

export function buildCouponItemsFromSocial(legs: CouponLeg[], bets: Bet[], now = Date.now()) {
  const byId = new Map(bets.map((bet) => [bet.id, bet]));
  const used = new Set<string>();
  const items: CouponItem[] = [];
  let skippedCount = 0;

  for (const leg of legs) {
    const bet = leg.bet_id ? byId.get(leg.bet_id) : undefined;
    const option = bet?.options?.find((candidate) => candidate.name === leg.selected_option);
    const closesAt = bet ? new Date(bet.ends_at).getTime() : 0;
    if (!bet || used.has(bet.id) || leg.result !== 'pending' || !bet.is_active || bet.winning_option !== null || !Number.isFinite(closesAt) || closesAt <= now || !option || Number(option.odds) <= 0) {
      skippedCount += 1;
      continue;
    }
    items.push({ bet, selectedOption: option.name, odds: Number(option.odds) });
    used.add(bet.id);
  }
  return { items, skippedCount };
}
