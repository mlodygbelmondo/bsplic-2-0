import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

import { Bet } from "@/types/database";
import {
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
  const pendingPayloadsRef = useRef<RealtimePostgresChangesPayload<BetRow>[]>(
    [],
  );
  const flushTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchActiveBets(selectedCategory);
        if (mounted) {
          setBets(data);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    const flushPayloadQueue = () => {
      flushTimeoutRef.current = null;

      if (!mounted || pendingPayloadsRef.current.length === 0) {
        pendingPayloadsRef.current = [];
        return;
      }

      const queuedPayloads = pendingPayloadsRef.current;
      pendingPayloadsRef.current = [];

      setBets((previous) =>
        applyBetsRealtimePayloads(previous, queuedPayloads, selectedCategory),
      );
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

    void load();

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
  }, [selectedCategory]);

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
    liveBets,
    sortedBets,
  };
}
