import type { StoreApi } from 'zustand';

import type { RouletteBetRecord, RouletteBetType } from '@/types/database';

import type { PlaceRouletteBetParams, RouletteTableSnapshot } from '../api/roulette';
import { getRouletteCountdownTargetMs, getRouletteNextSyncDelayMs } from '../lib/roulette';
import { upsertLocalRoundParticipant } from '../lib/rouletteGame';
import type { RouletteTableState } from './tableStore';

/**
 * Sync engine of the shared roulette table: a framework-free port of the web
 * `useRouletteTable` hook (snapshot de-duplication, fresh reads after writes,
 * adaptive polling, client-side round advance, resume on foreground). The
 * screen drives it with `setActive` (focused and app in the foreground) and
 * realtime events; React components read the store it writes.
 */

export interface RouletteTableApi {
  getSnapshot: () => Promise<RouletteTableSnapshot>;
  /** First read after mount; may reuse a just-prefetched snapshot. Defaults to `getSnapshot`. */
  getInitialSnapshot?: () => Promise<RouletteTableSnapshot>;
  placeBet: (params: PlaceRouletteBetParams) => Promise<RouletteBetRecord>;
  advance: () => Promise<void>;
}

export interface RouletteIdentity {
  userId: string;
  username: string;
  avatarUrl: string | null;
}

interface Timers {
  setTimeout: (callback: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeout: (id: ReturnType<typeof setTimeout>) => void;
}

export interface RouletteTableControllerDeps {
  store: StoreApi<RouletteTableState>;
  api: RouletteTableApi;
  identity: () => RouletteIdentity;
  refreshProfile: () => Promise<void>;
  /** After the server accepted a bet (optimistic balance). */
  onBetAccepted?: (bet: RouletteBetRecord) => void;
  /** Every fresh snapshot (cache writes). */
  onSnapshot?: (snapshot: RouletteTableSnapshot) => void;
  now?: () => number;
  timers?: Timers;
  warn?: (message: string, error: unknown) => void;
}

export interface PlaceBetInput {
  betType: RouletteBetType;
  betValue: string;
  stake: number;
}

export interface RouletteTableController {
  setActive: (active: boolean) => void;
  syncSnapshot: (withSpinner?: boolean) => Promise<void>;
  syncFreshSnapshot: () => Promise<void>;
  syncRoundState: () => Promise<void>;
  placeBet: (input: PlaceBetInput) => Promise<RouletteBetRecord>;
  dispose: () => void;
}

const ADVANCE_ERROR_LOG_INTERVAL_MS = 30_000;

const defaultTimers: Timers = {
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (id) => clearTimeout(id),
};

/** Keeps the previous reference when the data did not change, so subscribers skip a render. */
function keepIfEqual<T>(previous: T, next: T): T {
  if (previous === next) return previous;
  return JSON.stringify(previous) === JSON.stringify(next) ? previous : next;
}

export function createRouletteTableController({
  store,
  api,
  identity,
  refreshProfile,
  onBetAccepted,
  onSnapshot,
  now = Date.now,
  timers = defaultTimers,
  warn = (message, error) => console.warn(message, error),
}: RouletteTableControllerDeps): RouletteTableController {
  let disposed = false;
  let started = false;
  let active = false;
  let initialReadPending = true;
  let nextSyncTimer: ReturnType<typeof setTimeout> | null = null;
  let snapshotPromise: Promise<void> | null = null;
  let roundStatePromise: Promise<void> | null = null;
  let roundStateRerunRequested = false;
  let lastAdvanceErrorLoggedAt = Number.NEGATIVE_INFINITY;
  let lastSettledRoundId: string | null = null;
  let unsubscribeStore: (() => void) | null = null;

  const setState = (patch: Partial<RouletteTableState>) => {
    if (!disposed) store.setState(patch);
  };

  const syncSnapshot = (withSpinner = false): Promise<void> => {
    if (snapshotPromise) {
      return snapshotPromise;
    }

    if (withSpinner) {
      setState({ isRefreshing: true });
    }

    const read = initialReadPending && api.getInitialSnapshot ? api.getInitialSnapshot : api.getSnapshot;
    initialReadPending = false;

    const promise = (async () => {
      const snapshot = await read();
      if (disposed) return;
      onSnapshot?.(snapshot);

      const previous = store.getState();
      setState({
        currentRound: keepIfEqual(previous.currentRound, snapshot.currentRound),
        recentSpins: keepIfEqual(previous.recentSpins, snapshot.recentSpins),
        recentWins: keepIfEqual(previous.recentWins, snapshot.recentWins),
        activeBets: keepIfEqual(previous.activeBets, snapshot.activeBets),
        roundParticipants: keepIfEqual(previous.roundParticipants, snapshot.roundParticipants),
      });

      const { userId } = identity();
      const newestUserSettledWin = snapshot.recentWins.find((win) => win.user_id === userId) ?? null;
      if (newestUserSettledWin?.round_id && newestUserSettledWin.round_id !== lastSettledRoundId) {
        lastSettledRoundId = newestUserSettledWin.round_id;
        await refreshProfile();
      }

      setState({ tableMessage: null });
    })()
      .catch((error: unknown) => {
        setState({
          tableMessage: error instanceof Error ? error.message : 'Nie udało się zsynchronizować stołu ruletki.',
        });
      })
      .finally(() => {
        setState({ isLoading: false, isRefreshing: false });
        snapshotPromise = null;
      });

    snapshotPromise = promise;
    return promise;
  };

  const syncFreshSnapshot = async () => {
    const pendingSnapshot = snapshotPromise;
    await syncSnapshot();

    // A write must not reuse a snapshot that started before that write. If a
    // request was already in flight, follow it with one guaranteed-fresh read.
    if (pendingSnapshot) {
      await syncSnapshot();
    }
  };

  const syncRoundState = (): Promise<void> => {
    if (roundStatePromise) {
      roundStateRerunRequested = true;
      return roundStatePromise;
    }

    const promise = (async () => {
      const attemptedAdvanceKeys = new Set<string>();

      do {
        roundStateRerunRequested = false;
        let didAdvanceRound = false;
        const round = store.getState().currentRound;

        if (round) {
          const targetMs = getRouletteCountdownTargetMs(round);
          const advanceKey = `${round.id}:${round.phase}`;
          if (targetMs !== null && now() >= targetMs && !attemptedAdvanceKeys.has(advanceKey)) {
            attemptedAdvanceKeys.add(advanceKey);
            // The phase is overdue: nudge the shared round forward ourselves
            // instead of waiting for the backup cron tick.
            try {
              await api.advance();
              didAdvanceRound = true;
            } catch (error) {
              const at = now();
              if (at - lastAdvanceErrorLoggedAt >= ADVANCE_ERROR_LOG_INTERVAL_MS) {
                warn('Roulette round advance failed; retrying shortly.', error);
                lastAdvanceErrorLoggedAt = at;
              }
            }
          }
        }

        if (didAdvanceRound) {
          await syncFreshSnapshot();
        } else {
          await syncSnapshot();
        }
      } while (roundStateRerunRequested && !disposed);
    })().finally(() => {
      if (roundStatePromise === promise) {
        roundStatePromise = null;
      }
    });

    roundStatePromise = promise;
    return promise;
  };

  const clearNextSync = () => {
    if (nextSyncTimer !== null) {
      timers.clearTimeout(nextSyncTimer);
      nextSyncTimer = null;
    }
  };

  const scheduleNextSync = () => {
    clearNextSync();
    if (disposed || !active) {
      return;
    }

    nextSyncTimer = timers.setTimeout(
      () => {
        nextSyncTimer = null;
        void syncRoundState().finally(() => {
          // A snapshot can legitimately return the same round (including
          // null) or fail transiently. Keep polling in both cases.
          scheduleNextSync();
        });
      },
      getRouletteNextSyncDelayMs(store.getState().currentRound, now()),
    );
  };

  const syncOnResume = () => {
    clearNextSync();
    void syncRoundState().finally(scheduleNextSync);
  };

  const setActive = (nextActive: boolean) => {
    if (disposed || nextActive === active) return;
    active = nextActive;

    if (!active) {
      clearNextSync();
      return;
    }

    if (!started) {
      started = true;
      // The poll delay follows the live round: re-arm whenever it changes.
      unsubscribeStore = store.subscribe((state, previous) => {
        if (state.currentRound !== previous.currentRound) scheduleNextSync();
      });
      void syncSnapshot(true);
      scheduleNextSync();
      return;
    }

    syncOnResume();
  };

  const placeBet = async ({ betType, betValue, stake }: PlaceBetInput) => {
    setState({ isPlacingBet: true });

    try {
      const { userId, username, avatarUrl } = identity();
      const acceptedBet = await api.placeBet({ userId, betType, betValue, stake });

      if (!disposed) {
        const { activeBets, roundParticipants } = store.getState();
        setState({
          activeBets: [acceptedBet, ...activeBets],
          roundParticipants: upsertLocalRoundParticipant(roundParticipants, {
            userId,
            username,
            avatarUrl,
            acceptedBet,
          }),
        });
      }
      onBetAccepted?.(acceptedBet);
      await refreshProfile();
      await syncFreshSnapshot();
      return acceptedBet;
    } finally {
      setState({ isPlacingBet: false });
    }
  };

  const dispose = () => {
    disposed = true;
    active = false;
    clearNextSync();
    unsubscribeStore?.();
    unsubscribeStore = null;
  };

  return { setActive, syncSnapshot, syncFreshSnapshot, syncRoundState, placeBet, dispose };
}
