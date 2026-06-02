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

function isBetVisible(row: BetRow, selectedCategory: string | null): boolean {
  if (!row.is_active) {
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
): Bet[] {
  let next = previous;

  for (const payload of payloads) {
    if (payload.eventType === "INSERT") {
      const row = payload.new;
      if (!getBetId(row) || !isBetVisible(row, selectedCategory)) {
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

      if (isBetVisible(newRow, selectedCategory)) {
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

export function useBets(selectedCategory: string | null, sort: SortMode) {
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const pendingPayloadsRef = useRef<RealtimePostgresChangesPayload<BetRow>[]>(
    [],
  );
  const flushTimeoutRef = useRef<number | null>(null);
  const betsRef = useRef<Bet[]>([]);
  const criteriaRef = useRef({ selectedCategory, sort });

  useEffect(() => {
    betsRef.current = bets;
  }, [bets]);

  useEffect(() => {
    criteriaRef.current = { selectedCategory, sort };
  }, [selectedCategory, sort]);

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
        criteria.selectedCategory,
        criteria.sort,
        limit,
        offset,
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

  const refetchVisibleWindow = useCallback(async () => {
    await loadBetsPage({
      offset: 0,
      append: false,
      minimumWindowSize: betsRef.current.length || ACTIVE_BETS_PAGE_SIZE,
    });
  }, [loadBetsPage]);

  useEffect(() => {
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
  }, [loadBetsPage, selectedCategory, sort]);

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
        void refetchVisibleWindow();
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
  }, [refetchVisibleWindow]);

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
