import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';
import type { Bet } from '@/types/database';

export type BetRow = Database['public']['Tables']['bets']['Row'];
export type BetsRealtimePayload = RealtimePostgresChangesPayload<BetRow>;

/** One page of the home bet list (web `useBets` keeps the same `hasMore` flag). */
export interface BetsPage {
  bets: Bet[];
  hasMore: boolean;
}

function getBetId(input: unknown): string | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const value = (input as { id?: unknown }).id;
  return typeof value === 'string' ? value : null;
}

function toBet(row: BetRow): Bet {
  return row as unknown as Bet;
}

function isBetOpenForPlacement(row: Pick<BetRow, 'ends_at' | 'is_active'>) {
  if (!row.is_active) {
    return false;
  }

  const endsAt = new Date(row.ends_at).getTime();
  return Number.isFinite(endsAt) && endsAt > Date.now();
}

function isBetVisible(row: BetRow, selectedCategory: string | null, includeInProgress = false): boolean {
  if (includeInProgress) {
    if (!row.is_active) {
      return false;
    }
  } else if (!isBetOpenForPlacement(row)) {
    return false;
  }

  if (!selectedCategory) {
    return true;
  }

  return row.category_id === selectedCategory;
}

function upsertBet(previous: Bet[], nextBet: Bet): Bet[] {
  const existingIndex = previous.findIndex((bet) => bet.id === nextBet.id);

  if (existingIndex === -1) {
    return [...previous, nextBet];
  }

  const existing = previous[existingIndex];
  if (existing === nextBet) {
    return previous;
  }

  const next = [...previous];
  next[existingIndex] = nextBet;
  return next;
}

function removeBet(previous: Bet[], betId: string): Bet[] {
  const existingIndex = previous.findIndex((bet) => bet.id === betId);

  if (existingIndex === -1) {
    return previous;
  }

  return previous.filter((bet) => bet.id !== betId);
}

/** Port of the web `applyBetsRealtimePayloads` (`src/features/home/hooks/useBets.ts`). */
export function applyBetsRealtimePayloads(
  previous: Bet[],
  payloads: BetsRealtimePayload[],
  selectedCategory: string | null,
  includeInProgress = false,
): Bet[] {
  let next = previous;

  for (const payload of payloads) {
    if (payload.eventType === 'INSERT') {
      const row = payload.new;
      if (!getBetId(row) || !isBetVisible(row, selectedCategory, includeInProgress)) {
        continue;
      }
      next = upsertBet(next, toBet(row));
      continue;
    }

    if (payload.eventType === 'UPDATE') {
      const newRow = payload.new;
      const oldRow = payload.old;
      const oldId = getBetId(oldRow);

      if (!getBetId(newRow)) {
        if (oldId) {
          next = removeBet(next, oldId);
        }
        continue;
      }

      if (isBetVisible(newRow, selectedCategory, includeInProgress)) {
        next = upsertBet(next, toBet(newRow));
        continue;
      }

      if (oldId) {
        next = removeBet(next, oldId);
      }
      continue;
    }

    if (payload.eventType === 'DELETE') {
      const oldId = getBetId(payload.old);
      if (oldId) {
        next = removeBet(next, oldId);
      }
    }
  }

  return next;
}

/**
 * Applies realtime payloads to a paginated (infinite query) bet list. The
 * loaded bets are treated as one array like on the web; page boundaries are
 * kept so a refetch reloads the same number of pages, and new rows land on
 * the last page.
 */
export function applyBetsRealtimeToPages(
  pages: BetsPage[],
  payloads: BetsRealtimePayload[],
  selectedCategory: string | null,
  includeInProgress = false,
): BetsPage[] {
  if (pages.length === 0) return pages;
  const flat = pages.flatMap((page) => page.bets);
  const next = applyBetsRealtimePayloads(flat, payloads, selectedCategory, includeInProgress);
  if (next === flat) return pages;

  let start = 0;
  return pages.map((page, index) => {
    const end = index === pages.length - 1 ? next.length : Math.min(next.length, start + page.bets.length);
    const bets = next.slice(start, end);
    start = end;
    return { ...page, bets };
  });
}
