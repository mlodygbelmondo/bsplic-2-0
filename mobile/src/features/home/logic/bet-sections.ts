import type { Bet } from '@/types/database';

import type { BetsPage } from './bets-realtime';
import { sortBetsByMode, type SortMode } from './sort-bets';

export interface BetSections {
  /** `is_live` bets, shown first (web live block). */
  liveBets: Bet[];
  /** Every other bet (web regular block). */
  sortedBets: Bet[];
}

/**
 * Flattens the loaded pages and splits them into the live and regular blocks,
 * each sorted by the current mode (web `useBets`). Rows repeated across pages
 * (offset pagination shifted by realtime changes) are shown once.
 */
export function buildBetSections(pages: BetsPage[], sort: SortMode): BetSections {
  const seen = new Set<string>();
  const liveBets: Bet[] = [];
  const sortedBets: Bet[] = [];

  for (const page of pages) {
    for (const bet of page.bets) {
      if (seen.has(bet.id)) continue;
      seen.add(bet.id);
      if (bet.is_live) {
        liveBets.push(bet);
      } else {
        sortedBets.push(bet);
      }
    }
  }

  const compare = (a: Bet, b: Bet) => sortBetsByMode(sort, a, b);
  liveBets.sort(compare);
  sortedBets.sort(compare);
  return { liveBets, sortedBets };
}

/** Offset of the next page: every loaded row, like the web's `betsRef.current.length`. */
export function getNextBetsOffset(pages: BetsPage[]): number | undefined {
  const last = pages[pages.length - 1];
  if (!last?.hasMore) return undefined;
  return pages.reduce((count, page) => count + page.bets.length, 0);
}
