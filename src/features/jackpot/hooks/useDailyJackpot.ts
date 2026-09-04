import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useAuth } from '@/contexts/AuthContext';
import { buyDailyJackpotTicket, getDailyJackpotState } from '../api/jackpot';
import type { DailyJackpotSnapshot } from '../types';

const JACKPOT_POLL_MS = 45_000;

function formatTicketLabel(ticketNumber: number) {
  return `#${String(ticketNumber).padStart(2, '0')}`;
}

function getPurchasedTicketLabel(
  previousSnapshot: DailyJackpotSnapshot,
  nextSnapshot: DailyJackpotSnapshot,
) {
  const previousTicketNumbers = new Set(
    previousSnapshot.currentUserTicketNumbers,
  );
  const newTicketNumber =
    nextSnapshot.currentUserTicketNumbers.find(
      (ticketNumber) => !previousTicketNumbers.has(ticketNumber),
    ) ?? nextSnapshot.currentUserTicketNumber;

  return newTicketNumber === null ? null : formatTicketLabel(newTicketNumber);
}

export function useDailyJackpot() {
  const { profile, refreshProfile } = useAuth();
  const [snapshot, setSnapshot] = useState<DailyJackpotSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const refreshedSettledPoolsRef = useRef<Set<string>>(new Set());
  const loadingRef = useRef(false);
  const buyingRef = useRef(false);
  const lastLoadAtRef = useRef(Number.NEGATIVE_INFINITY);
  const snapshotVersionRef = useRef(0);

  const refreshBalanceAfterStateMaintenance = useCallback(
    async (nextSnapshot: DailyJackpotSnapshot) => {
      if (nextSnapshot.maintenanceAutoCreditedCount > 0) {
        await refreshProfile();
        return;
      }

      const shouldRefreshForSettledPool =
        nextSnapshot.status === 'rolled_over' &&
        nextSnapshot.currentUserHasTicket;

      if (!shouldRefreshForSettledPool) {
        return;
      }

      if (!nextSnapshot.poolId) {
        return;
      }

      if (refreshedSettledPoolsRef.current.has(nextSnapshot.poolId)) {
        return;
      }

      refreshedSettledPoolsRef.current.add(nextSnapshot.poolId);
      await refreshProfile();
    },
    [refreshProfile],
  );

  const load = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (loadingRef.current || buyingRef.current) return;
      loadingRef.current = true;
      lastLoadAtRef.current = Date.now();
      const snapshotVersion = snapshotVersionRef.current;
      if (!silent) {
        setLoading(true);
      }

      try {
        const nextSnapshot = await getDailyJackpotState();
        if (snapshotVersion === snapshotVersionRef.current) {
          setSnapshot(nextSnapshot);
        }
        await refreshBalanceAfterStateMaintenance(nextSnapshot);
      } catch (error) {
        if (!silent) {
          const message =
            error instanceof Error
              ? error.message
              : 'Nie udało się wczytać Jackpotu';
          toast.error(message);
        }
      } finally {
        loadingRef.current = false;
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [refreshBalanceAfterStateMaintenance],
  );

  const buyTicket = useCallback(async () => {
    if (!snapshot?.poolId || buyingRef.current) {
      return;
    }

    buyingRef.current = true;
    snapshotVersionRef.current += 1;
    setBuying(true);
    try {
      const nextSnapshot = await buyDailyJackpotTicket(snapshot.poolId);
      const purchasedTicketLabel = getPurchasedTicketLabel(
        snapshot,
        nextSnapshot,
      );
      setSnapshot(nextSnapshot);
      lastLoadAtRef.current = Date.now();
      await refreshProfile();
      toast.success(
        purchasedTicketLabel
          ? `Ticket ${purchasedTicketLabel} kupiony!`
          : 'Ticket kupiony!',
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Nie udało się kupić ticketu';
      toast.error(message);
    } finally {
      buyingRef.current = false;
      setBuying(false);
    }
  }, [refreshProfile, snapshot]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (snapshot?.status !== 'collecting' && snapshot?.status !== 'locked') {
      return;
    }

    const refreshWhenVisible = () => {
      if (
        document.visibilityState !== 'hidden' &&
        navigator.onLine !== false &&
        Date.now() - lastLoadAtRef.current >= JACKPOT_POLL_MS
      ) {
        void load({ silent: true });
      }
    };
    const intervalId = window.setInterval(refreshWhenVisible, JACKPOT_POLL_MS);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('online', refreshWhenVisible);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('online', refreshWhenVisible);
    };
  }, [load, snapshot?.status]);

  return {
    snapshot,
    loading,
    buying,
    balance: Number(profile?.balance ?? 0),
    buyTicket,
  };
}
