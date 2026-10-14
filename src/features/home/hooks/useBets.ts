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
const CATEGORY_KEY_SEPARATOR = "|";

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
  categoryIds: readonly string[] | null,
  includeInProgress = false,
): boolean {
  if (includeInProgress) {
    if (!row.is_active) {
      return false;
    }
  } else if (!isBetOpenForPlacement(row)) {
    return false;
  }

  if (!categoryIds || categoryIds.length === 0) {
    return true;
  }

  return row.category_id !== null && categoryIds.includes(row.category_id);
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
  categoryIds: readonly string[] | null,
  includeInProgress = false,
): Bet[] {
  let next = previous;

  for (const payload of payloads) {
    if (payload.eventType === "INSERT") {
      const row = payload.new;
      if (
        !getBetId(row) ||
        !isBetVisible(row, categoryIds, includeInProgress)
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

      if (isBetVisible(newRow, categoryIds, includeInProgress)) {
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

/**
 * Active bets in the given categories (`null` = all). The id list may be a new
 * array on every render; only its contents trigger a reload. While `enabled`
 * is false nothing is fetched and the list stays in its loading state.
 */
export function useBets(
  categoryIds: readonly string[] | null,
  sort: SortMode,
  includeInProgress = false,
  enabled = true,
) {
  const categoryKey =
    categoryIds && categoryIds.length > 0
      ? categoryIds.join(CATEGORY_KEY_SEPARATOR)
      : null;
  const stableCategoryIds = useMemo(
    () => (categoryKey === null ? null : categoryKey.split(CATEGORY_KEY_SEPARATOR)),
    [categoryKey],
  );
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const pendingPayloadsRef = useRef<RealtimePostgresChangesPayload<BetRow>[]>(
    [],
  );
  const flushTimeoutRef = useRef<number | null>(null);
  const betsRef = useRef<Bet[]>([]);
  const criteriaRef = useRef({
    categoryIds: stableCategoryIds,
    sort,
    includeInProgress,
  });

  useEffect(() => {
    betsRef.current = bets;
  }, [bets]);

  useEffect(() => {
    criteriaRef.current = {
      categoryIds: stableCategoryIds,
      sort,
      includeInProgress,
    };
  }, [stableCategoryIds, sort, includeInProgress]);

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
      const limit = Math.max(minimumWindowSize, ACTIVE_BETS_PAGE_SIZE) + 1;
      const data = await fetchActiveBets(
        criteria.categoryIds,
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
      setBets((previous) =>
        append ? [...previous, ...visiblePage] : visiblePage,
      );
    },
    [],
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        await loadBetsPage({
          offset: 0,
          append: false,
          shouldApply: () => mounted,
        });
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
  }, [enabled, loadBetsPage, stableCategoryIds, sort, includeInProgress]);

  useEffect(() => {
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
            criteria.categoryIds,
            criteria.includeInProgress,
          ),
        );
      }
    };

    const scheduleFlushPayloadQueue = () => {
      if (flushTimeoutRef.current !== null) {
        return;
      }

      flushTimeoutRef.current = window.setTimeout(
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
        window.clearTimeout(flushTimeoutRef.current);
        flushTimeoutRef.current = null;
      }
      unsubscribe();
    };
  }, []);

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
    loadMore,
    liveBets,
    sortedBets,
  };
}
