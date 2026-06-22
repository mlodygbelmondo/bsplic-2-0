import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useAuth } from '@/contexts/AuthContext';
import {
  buyDailyJackpotTicket,
  getDailyJackpotState,
} from '../api/jackpot';
import type { DailyJackpotSnapshot } from '../types';

const JACKPOT_POLL_MS = 45_000;

function formatTicketLabel(ticketNumber: number) {
  return `#${String(ticketNumber).padStart(2, '0')}`;
}

function getPurchasedTicketLabel(
  previousSnapshot: DailyJackpotSnapshot,
  nextSnapshot: DailyJackpotSnapshot,
) {
  const previousTicketNumbers = new Set(previousSnapshot.currentUserTicketNumbers);
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
      if (!silent) {
        setLoading(true);
      }

      try {
        const nextSnapshot = await getDailyJackpotState();
        setSnapshot(nextSnapshot);
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
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [refreshBalanceAfterStateMaintenance],
  );

  const buyTicket = useCallback(async () => {
    if (!snapshot?.poolId || buying) {
      return;
    }

    setBuying(true);
    try {
      const nextSnapshot = await buyDailyJackpotTicket(snapshot.poolId);
      const purchasedTicketLabel = getPurchasedTicketLabel(snapshot, nextSnapshot);
      setSnapshot(nextSnapshot);
      await refreshProfile();
      toast.success(
        purchasedTicketLabel
          ? `Ticket ${purchasedTicketLabel} kupiony!`
          : 'Ticket kupiony!',
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Nie udało się kupić ticketu';
      toast.error(message);
    } finally {
      setBuying(false);
    }
  }, [buying, refreshProfile, snapshot]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (
      snapshot?.status !== 'collecting' &&
      snapshot?.status !== 'locked'
    ) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void load({ silent: true });
    }, JACKPOT_POLL_MS);

    return () => window.clearInterval(intervalId);
  }, [load, snapshot?.status]);

  return {
    snapshot,
    loading,
    buying,
    balance: Number(profile?.balance ?? 0),
    buyTicket,
  };
}
