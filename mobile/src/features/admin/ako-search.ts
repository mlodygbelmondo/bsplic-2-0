import type { Bet } from '@/types/database';

import type { BetAkoExclusionDraft } from './api/ako-exclusions';

/**
 * Candidates for the AKO exclusions picker (web `AkoExclusionsEditor`):
 * at least 2 characters, never the bet being edited or an already selected
 * bet, case-insensitive title match, at most 5 results.
 */
export function findAkoCandidates({
  availableBets,
  search,
  currentBetId,
  selected,
}: {
  availableBets: Bet[];
  search: string;
  currentBetId?: string;
  selected: BetAkoExclusionDraft[];
}): Bet[] {
  const normalizedSearch = search.trim().toLowerCase();
  if (normalizedSearch.length < 2) {
    return [];
  }

  const selectedIds = new Set(selected.map((exclusion) => exclusion.betId));
  return availableBets
    .filter((bet) => bet.id !== currentBetId)
    .filter((bet) => !selectedIds.has(bet.id))
    .filter((bet) => bet.title.toLowerCase().includes(normalizedSearch))
    .slice(0, 5);
}
