import { useIsRestoring, useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';

import { authActions, useBalance, useUserId } from '@/features/auth/auth-store';
import { useBootHold } from '@/features/boot/boot-store';
import { getErrorMessage } from '@/lib/errors';
import { useHasBeenFocused, useScreenActive } from '@/lib/focus';
import { haptics } from '@/lib/haptics';
import { queryClient } from '@/lib/query-client';
import { toast } from '@/lib/toast';

import { buyDailyJackpotTicket, getDailyJackpotState } from '../api/jackpot';
import { jackpotDrawQueryOptions, jackpotStateQueryKey, type JackpotStateEntry } from '../api/queries';
import { getPurchaseToastMessage } from '../lib/buyModel';
import { getPurchasedTicketLabel, isLiveJackpotStatus } from '../lib/cardModel';
import type { DailyJackpotSnapshot } from '../types';

/** Web `JACKPOT_POLL_MS`: poll and refresh-when-visible interval while the pool is live. */
const JACKPOT_POLL_MS = 45_000;

/** Bumped by purchases so a poll that started before a purchase cannot overwrite it. */
let stateVersion = 0;
/** Settled pools whose refunds were already reflected in the balance (web `refreshedSettledPoolsRef`). */
const refreshedSettledPools = new Set<string>();

function refreshBalanceAfterStateMaintenance(snapshot: DailyJackpotSnapshot) {
  if (snapshot.maintenanceAutoCreditedCount > 0) {
    void authActions.refreshProfile();
    return;
  }
  if (snapshot.status !== 'rolled_over' || !snapshot.currentUserHasTicket || !snapshot.poolId) return;
  if (refreshedSettledPools.has(snapshot.poolId)) return;
  refreshedSettledPools.add(snapshot.poolId);
  void authActions.refreshProfile();
}

async function fetchJackpotState(queryKey: ReturnType<typeof jackpotStateQueryKey>): Promise<JackpotStateEntry> {
  const version = stateVersion;
  let snapshot: DailyJackpotSnapshot;
  try {
    snapshot = await getDailyJackpotState();
  } catch (error) {
    // The web toasts only the visible (first) load; background polls fail silently.
    if (!queryClient.getQueryData(queryKey)) {
      toast.error(getErrorMessage(error, 'Nie udało się wczytać Jackpotu'));
    }
    throw error;
  }
  const cached = queryClient.getQueryData<JackpotStateEntry>(queryKey);
  if (version !== stateVersion && cached) return cached;
  refreshBalanceAfterStateMaintenance(snapshot);
  return { snapshot, receivedAt: Date.now() };
}

/**
 * Daily jackpot state for the home card (web `useDailyJackpot`): loads on
 * first focus, polls every 45 s while the pool is collecting or locked, and
 * refreshes overdue data when the screen or app becomes active again or the
 * connection returns. Nothing runs while the home tab is not on screen.
 */
export function useDailyJackpot() {
  const hasBeenFocused = useHasBeenFocused();
  const active = useScreenActive();
  const restoring = useIsRestoring();
  const balance = Number(useBalance());
  const queryKey = jackpotStateQueryKey(useUserId());
  const [buying, setBuying] = useState(false);
  const buyingRef = useRef(false);

  const query = useQuery({
    queryKey,
    queryFn: () => fetchJackpotState(queryKey),
    enabled: hasBeenFocused,
    // Inactive (other tab, app in background): no polling; re-activation refetches overdue data.
    subscribed: active,
    staleTime: JACKPOT_POLL_MS,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchInterval: (current) =>
      !buying && isLiveJackpotStatus(current.state.data?.snapshot.status) ? JACKPOT_POLL_MS : false,
    // Offline polls are skipped and resume once the connection returns.
    networkMode: 'online',
    retry: false,
  });

  // The home screen appears once with the card's data: hold boot during the first load.
  useBootHold(restoring || (query.fetchStatus === 'fetching' && !query.isFetchedAfterMount));

  const entry = query.data ?? null;

  /**
   * Buys `count` tickets one RPC call at a time (the RPC sells one ticket and
   * enforces the per-player limit). Resolves `true` when every ticket was bought.
   */
  const buyTickets = async (count = 1): Promise<boolean> => {
    const current = entry?.snapshot;
    const poolId = current?.poolId;
    if (!current || !poolId || buyingRef.current) return false;

    buyingRef.current = true;
    stateVersion += 1;
    setBuying(true);
    haptics.medium();
    let latest = current;
    let runningBalance = balance;
    let purchasedCount = 0;
    const purchasedLabels: string[] = [];

    try {
      await queryClient.cancelQueries({ queryKey });
      for (let index = 0; index < count; index += 1) {
        const nextSnapshot = await buyDailyJackpotTicket(poolId);
        const purchasedLabel = getPurchasedTicketLabel(latest, nextSnapshot);
        if (purchasedLabel) purchasedLabels.push(purchasedLabel);
        purchasedCount += 1;
        latest = nextSnapshot;
        queryClient.setQueryData<JackpotStateEntry>(queryKey, {
          snapshot: nextSnapshot,
          receivedAt: Date.now(),
        });
        // The RPC debits exactly the ticket price; show it at once, the profile refresh confirms it.
        runningBalance = Math.round((runningBalance - current.ticketPrice) * 100) / 100;
        authActions.updateProfileBalance(runningBalance);
      }
      haptics.success();
      toast.success(getPurchaseToastMessage(purchasedLabels, purchasedCount));
      return true;
    } catch (error) {
      if (purchasedCount > 0) toast.success(getPurchaseToastMessage(purchasedLabels, purchasedCount));
      haptics.error();
      toast.error(getErrorMessage(error, 'Nie udało się kupić ticketu'));
      return false;
    } finally {
      buyingRef.current = false;
      setBuying(false);
      // A failed balance refresh is retried by the next profile load; the purchase already succeeded.
      if (purchasedCount > 0) void authActions.refreshProfile().catch(() => undefined);
    }
  };

  const prefetchDraw = (poolId: string) => {
    void queryClient.prefetchQuery(jackpotDrawQueryOptions(poolId));
  };

  return {
    snapshot: entry?.snapshot ?? null,
    receivedAt: entry?.receivedAt ?? 0,
    loading: query.isLoading,
    buying,
    balance,
    active,
    buyTickets,
    prefetchDraw,
  };
}
