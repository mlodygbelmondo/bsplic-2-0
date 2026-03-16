import { Bet, CouponItem } from '@/types/database';

interface CouponLegForCopy {
  id: string;
  bet_id?: string | null;
  selected_option: string;
  result?: 'pending' | 'won' | 'lost';
}

interface BuildCouponItemsInput {
  legs: CouponLegForCopy[];
  bets: Bet[];
  now?: number;
}

interface BuildCouponItemsResult {
  items: CouponItem[];
  skippedCount: number;
}

function isBetOpenForPlacement(bet: Bet, now: number): boolean {
  if (!bet.is_active || bet.winning_option !== null) {
    return false;
  }

  const endsAt = new Date(bet.ends_at).getTime();
  if (!Number.isFinite(endsAt)) {
    return false;
  }

  return endsAt > now;
}

export function buildCouponItemsFromSocial({ legs, bets, now = Date.now() }: BuildCouponItemsInput): BuildCouponItemsResult {
  const betById = new Map(bets.map((bet) => [bet.id, bet]));
  const selectedBetIds = new Set<string>();
  const items: CouponItem[] = [];
  let skippedCount = 0;

  for (const leg of legs) {
    if (leg.result && leg.result !== 'pending') {
      skippedCount += 1;
      continue;
    }

    if (!leg.bet_id) {
      skippedCount += 1;
      continue;
    }

    const bet = betById.get(leg.bet_id);
    if (!bet || selectedBetIds.has(bet.id) || !isBetOpenForPlacement(bet, now)) {
      skippedCount += 1;
      continue;
    }

    const availableOptions = Array.isArray(bet.options) ? bet.options : [];
    const selectedOption = availableOptions.find((option) => option.name === leg.selected_option);
    if (!selectedOption || !Number.isFinite(Number(selectedOption.odds)) || Number(selectedOption.odds) <= 0) {
      skippedCount += 1;
      continue;
    }

    items.push({
      bet,
      selectedOption: selectedOption.name,
      odds: Number(selectedOption.odds),
    });
    selectedBetIds.add(bet.id);
  }

  return {
    items,
    skippedCount,
  };
}
