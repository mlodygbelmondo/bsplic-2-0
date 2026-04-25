import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  advanceRouletteRoundIfDue,
  getCurrentRouletteRound,
  getMyCurrentRouletteBets,
  getRecentRouletteSpins,
  getRecentRouletteWins,
  getRouletteRoundParticipants,
  placeRouletteBet,
  subscribeToRouletteRounds,
} from '@/features/casino/api/roulette';
import {
  formatRouletteCountdown,
  getRouletteCountdownTargetMs,
} from '@/features/casino/lib/roulette';
import type {
  RouletteBetRecord,
  RouletteBetType,
  RouletteRecentWin,
  RouletteRoundParticipant,
  RouletteRoundPhase,
  RouletteTableRound,
} from '@/types/database';

interface UseRouletteTableArgs {
  userId: string;
  refreshProfile: () => Promise<void>;
}

interface PlaceBetInput {
  betType: RouletteBetType;
  betValue: string;
  stake: number;
}

export function useRouletteTable({ userId, refreshProfile }: UseRouletteTableArgs) {
  const [currentRound, setCurrentRound] = useState<RouletteTableRound | null>(null);
  const [recentSpins, setRecentSpins] = useState<RouletteTableRound[]>([]);
  const [recentWins, setRecentWins] = useState<RouletteRecentWin[]>([]);
  const [activeBets, setActiveBets] = useState<RouletteBetRecord[]>([]);
  const [roundParticipants, setRoundParticipants] = useState<RouletteRoundParticipant[]>([]);
  const [countdownMs, setCountdownMs] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPlacingBet, setIsPlacingBet] = useState(false);
  const [tableMessage, setTableMessage] = useState<string | null>(null);
  const refreshProfileRef = useRef(refreshProfile);
  const lastSettledRoundIdRef = useRef<string | null>(null);
  const syncSnapshotPromiseRef = useRef<Promise<void> | null>(null);
  const lastCountdownSecondRef = useRef<number | null>(null);

  useEffect(() => {
    refreshProfileRef.current = refreshProfile;
  }, [refreshProfile]);

  const syncSnapshot = useCallback((withSpinner = false) => {
    if (syncSnapshotPromiseRef.current) {
      return syncSnapshotPromiseRef.current;
    }

    if (withSpinner) {
      setIsRefreshing(true);
    }

    const snapshotPromise = (async () => {
      await advanceRouletteRoundIfDue();

      const [round, spins, wins] = await Promise.all([
        getCurrentRouletteRound(),
        getRecentRouletteSpins(),
        getRecentRouletteWins(),
      ]);

      setCurrentRound(round);
      setRecentSpins(spins);
      setRecentWins(wins);

      if (round) {
        const [bets, participants] = await Promise.all([
          getMyCurrentRouletteBets(round.id),
          getRouletteRoundParticipants(round.id),
        ]);
        setActiveBets(bets);
        setRoundParticipants(participants);
      } else {
        setActiveBets([]);
        setRoundParticipants([]);
      }

      const newestUserSettledWin = wins.find((win) => win.user_id === userId) ?? null;
      if (
        newestUserSettledWin?.round_id
        && newestUserSettledWin.round_id !== lastSettledRoundIdRef.current
      ) {
        lastSettledRoundIdRef.current = newestUserSettledWin.round_id;
        await refreshProfileRef.current();
      }

      setTableMessage(null);
    })().catch((error) => {
      setTableMessage(
        error instanceof Error
          ? error.message
          : 'Nie udało się zsynchronizować stołu ruletki.',
      );
    }).finally(() => {
      setIsLoading(false);
      setIsRefreshing(false);
      syncSnapshotPromiseRef.current = null;
    });

    syncSnapshotPromiseRef.current = snapshotPromise;
    return snapshotPromise;
  }, [userId]);

  useEffect(() => {
    void syncSnapshot(true);

    const unsubscribe = subscribeToRouletteRounds(() => {
      void syncSnapshot();
    });

    const advanceInterval = window.setInterval(() => {
      void syncSnapshot();
    }, 3000);

    return () => {
      unsubscribe();
      window.clearInterval(advanceInterval);
    };
  }, [syncSnapshot]);

  useEffect(() => {
    const updateCountdown = () => {
      if (!currentRound) {
        lastCountdownSecondRef.current = null;
        setCountdownMs(0);
        return;
      }

      const targetMs = getRouletteCountdownTargetMs(currentRound);
      if (!targetMs) {
        lastCountdownSecondRef.current = null;
        setCountdownMs(0);
        return;
      }

      const nextCountdownMs = Math.max(0, targetMs - Date.now());
      const nextCountdownSecond = Math.ceil(nextCountdownMs / 1000);
      if (lastCountdownSecondRef.current === nextCountdownSecond) {
        return;
      }

      lastCountdownSecondRef.current = nextCountdownSecond;
      setCountdownMs(nextCountdownMs);
    };

    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [currentRound]);

  const placeBetForRound = useCallback(
    async ({ betType, betValue, stake }: PlaceBetInput) => {
      if (!currentRound) {
        throw new Error('Brak aktywnej rundy przy stole.');
      }

      setIsPlacingBet(true);

      try {
        const acceptedBet = await placeRouletteBet({
          roundId: currentRound.id,
          userId,
          betType,
          betValue,
          stake,
        });

        setActiveBets((previous) => [acceptedBet, ...previous]);
        await refreshProfileRef.current();
        await syncSnapshot();
        return acceptedBet;
      } finally {
        setIsPlacingBet(false);
      }
    },
    [currentRound, syncSnapshot, userId],
  );

  const latestSettledRound = recentSpins[0] ?? null;
  const phase: RouletteRoundPhase = currentRound?.phase ?? 'waiting';
  const countdownLabel = formatRouletteCountdown(countdownMs);

  return useMemo(
    () => ({
      userId,
      currentRound,
      recentSpins,
      recentWins,
      activeBets,
      roundParticipants,
      latestSettledRound,
      phase,
      countdownMs,
      countdownLabel,
      isLoading,
      isRefreshing,
      isPlacingBet,
      tableMessage,
      placeBet: placeBetForRound,
      refresh: () => syncSnapshot(true),
    }),
    [
      userId,
      currentRound,
      recentSpins,
      recentWins,
      activeBets,
      roundParticipants,
      latestSettledRound,
      phase,
      countdownMs,
      countdownLabel,
      isLoading,
      isRefreshing,
      isPlacingBet,
      tableMessage,
      placeBetForRound,
      syncSnapshot,
    ],
  );
}
