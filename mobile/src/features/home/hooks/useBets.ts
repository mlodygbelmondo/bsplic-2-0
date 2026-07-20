import 'expo-sqlite/localStorage/install';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

import { Bet } from "@/types/database";
import {
  ACTIVE_BETS_PAGE_SIZE,
  fetchActiveBets,
  subscribeToBetsChanges,
} from "@/features/home/api/bets";
import type { Database } from "@/integrations/supabase/types";
import { SortMode, sortBetsByMode } from "@/features/home/hooks/sortBets";

export type { SortMode } from "@/features/home/hooks/sortBets";

type BetRow = Database["public"]["Tables"]["bets"]["Row"];

const REALTIME_BATCH_MS = 150;
const BETS_CACHE_PREFIX = 'bsplic.home.bets.v1.';

function betsCacheKey(selectedCategory: string | null, sort: SortMode, includeInProgress: boolean) {
  return `${BETS_CACHE_PREFIX}${selectedCategory ?? 'all'}.${sort}.${includeInProgress ? 'all-active' : 'open'}`;
}

function readCachedBets(key: string): Bet[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(value) ? value as Bet[] : [];
  } catch { return []; }
}

function cacheBets(key: string, bets: Bet[]) {
  try { localStorage.setItem(key, JSON.stringify(bets.slice(0, 100))); } catch { /* in-memory state remains available */ }
}

function getBetId(input: unknown): string | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const value = (input as { id?: unknown }).id;
  return typeof value === "string" ? value : null;
}

function toBet(row: BetRow): Bet {
  return row as unknown as Bet;
}

function isBetOpenForPlacement(row: Pick<BetRow, "ends_at" | "is_active">) {
  if (!row.is_active) {
    return false;
  }

  const endsAt = new Date(row.ends_at).getTime();
  return Number.isFinite(endsAt) && endsAt > Date.now();
}

function isBetVisible(
  row: BetRow,
  selectedCategory: string | null,
  includeInProgress = false,
): boolean {
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

export function applyBetsRealtimePayloads(
  previous: Bet[],
  payloads: RealtimePostgresChangesPayload<BetRow>[],
  selectedCategory: string | null,
  includeInProgress = false,
): Bet[] {
  let next = previous;

  for (const payload of payloads) {
    if (payload.eventType === "INSERT") {
      const row = payload.new;
      if (
        !getBetId(row) ||
        !isBetVisible(row, selectedCategory, includeInProgress)
      ) {
        continue;
      }
      next = upsertBet(next, toBet(row));
      continue;
    }

    if (payload.eventType === "UPDATE") {
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

    if (payload.eventType === "DELETE") {
      const oldId = getBetId(payload.old);
      if (oldId) {
        next = removeBet(next, oldId);
      }
    }
  }

  return next;
}

export function useBets(
  selectedCategory: string | null,
  sort: SortMode,
  includeInProgress = false,
  enabled = true,
) {
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const pendingPayloadsRef = useRef<RealtimePostgresChangesPayload<BetRow>[]>(
    [],
  );
  const flushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const betsRef = useRef<Bet[]>([]);
  const criteriaRef = useRef({ selectedCategory, sort, includeInProgress });

  useEffect(() => {
    betsRef.current = bets;
  }, [bets]);

  useEffect(() => {
    criteriaRef.current = { selectedCategory, sort, includeInProgress };
  }, [selectedCategory, sort, includeInProgress]);

  const loadBetsPage = useCallback(
    async ({
      offset,
      append,
      minimumWindowSize = ACTIVE_BETS_PAGE_SIZE,
      shouldApply = () => true,
    }: {
      offset: number;
      append: boolean;
      minimumWindowSize?: number;
      shouldApply?: () => boolean;
    }) => {
      const criteria = criteriaRef.current;
      const cacheKey = betsCacheKey(criteria.selectedCategory, criteria.sort, criteria.includeInProgress);
      const limit = Math.max(minimumWindowSize, ACTIVE_BETS_PAGE_SIZE) + 1;
      const data = await fetchActiveBets(
        criteria.selectedCategory,
        criteria.sort,
        limit,
        offset,
        criteria.includeInProgress,
      );
      const visiblePage = data.slice(0, limit - 1);

      if (!shouldApply()) {
        return;
      }

      setHasMore(data.length === limit);
      setError(null);
      setBets((previous) => {
        const next = append ? [...previous, ...visiblePage] : visiblePage;
        cacheBets(cacheKey, next);
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    if (!enabled) return;
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        await loadBetsPage({
          offset: 0,
          append: false,
          shouldApply: () => mounted,
        });
      } catch (cause) {
        const cached = readCachedBets(betsCacheKey(selectedCategory, sort, includeInProgress));
        if (mounted && cached.length > 0) setBets(cached);
        if (mounted) setError(cause instanceof Error ? cause.message : 'Nie udało się wczytać zakładów');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [enabled, loadBetsPage, selectedCategory, sort, includeInProgress, refreshKey]);

  useEffect(() => {
    if (!enabled) return;
    let mounted = true;

    const flushPayloadQueue = () => {
      flushTimeoutRef.current = null;

      if (!mounted || pendingPayloadsRef.current.length === 0) {
        pendingPayloadsRef.current = [];
        return;
      }

      const queuedPayloads = pendingPayloadsRef.current;
      pendingPayloadsRef.current = [];

      if (queuedPayloads.length > 0) {
        const criteria = criteriaRef.current;
        setBets((previous) =>
          applyBetsRealtimePayloads(
            previous,
            queuedPayloads,
            criteria.selectedCategory,
            criteria.includeInProgress,
          ),
        );
      }
    };

    const scheduleFlushPayloadQueue = () => {
      if (flushTimeoutRef.current !== null) {
        return;
      }

      flushTimeoutRef.current = setTimeout(
        flushPayloadQueue,
        REALTIME_BATCH_MS,
      );
    };

    const unsubscribe = subscribeToBetsChanges((payload) => {
      pendingPayloadsRef.current.push(payload);
      scheduleFlushPayloadQueue();
    });

    return () => {
      mounted = false;
      pendingPayloadsRef.current = [];
      if (flushTimeoutRef.current !== null) {
        clearTimeout(flushTimeoutRef.current);
        flushTimeoutRef.current = null;
      }
      unsubscribe();
    };
  }, [enabled]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) {
      return;
    }

    setLoadingMore(true);
    try {
      await loadBetsPage({
        offset: betsRef.current.length,
        append: true,
      });
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadBetsPage, loadingMore]);

  const sortByMode = useCallback(
    (a: Bet, b: Bet) => {
      return sortBetsByMode(sort, a, b);
    },
    [sort],
  );

  const liveBets = useMemo(() => {
    return bets.filter((bet) => bet.is_live).sort(sortByMode);
  }, [bets, sortByMode]);

  const regularBets = useMemo(() => {
    return bets.filter((bet) => !bet.is_live);
  }, [bets]);

  const sortedBets = useMemo(() => {
    return [...regularBets].sort(sortByMode);
  }, [regularBets, sortByMode]);

  return {
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore,
    refresh: () => setRefreshKey((current) => current + 1),
    liveBets,
    sortedBets,
  };
}
