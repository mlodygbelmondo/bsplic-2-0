import { Bet } from '@/types/database';

export type SortMode = 'newest' | 'popular' | 'ending_soon';

function toTimestamp(value: string): number {
  const timestamp = new Date(value).getTime();
  if (Number.isFinite(timestamp)) {
    return timestamp;
  }
  return Number.POSITIVE_INFINITY;
}

function compareByNewest(a: Bet, b: Bet): number {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

function compareByPopular(a: Bet, b: Bet): number {
  const popularityDiff = Number(b.bet_count) - Number(a.bet_count);
  if (popularityDiff !== 0) {
    return popularityDiff;
  }
  return compareByNewest(a, b);
}

function compareByEndingSoon(a: Bet, b: Bet): number {
  const endDiff = toTimestamp(a.ends_at) - toTimestamp(b.ends_at);
  if (endDiff !== 0) {
    return endDiff;
  }
  return compareByNewest(a, b);
}

export function sortBetsByMode(mode: SortMode, a: Bet, b: Bet): number {
  if (mode === 'popular') {
    return compareByPopular(a, b);
  }

  if (mode === 'ending_soon') {
    return compareByEndingSoon(a, b);
  }

  return compareByNewest(a, b);
}
