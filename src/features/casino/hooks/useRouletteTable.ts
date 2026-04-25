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

  useEffect(() => {
    refreshProfileRef.current = refreshProfile;
  }, [refreshProfile]);

  const syncSnapshot = useCallback(async (withSpinner = false) => {
    if (withSpinner) {
      setIsRefreshing(true);
    }

    try {
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

      const newestSettled = spins[0] ?? null;
      if (newestSettled?.id && newestSettled.id !== lastSettledRoundIdRef.current) {
        lastSettledRoundIdRef.current = newestSettled.id;
        await refreshProfileRef.current();
      }

      setTableMessage(null);
    } catch (error) {
      setTableMessage(
        error instanceof Error
          ? error.message
          : 'Nie udało się zsynchronizować stołu ruletki.',
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void syncSnapshot(true);

    const unsubscribe = subscribeToRouletteRounds(() => {
      void syncSnapshot();
    });

    const advanceInterval = window.setInterval(() => {
      void advanceRouletteRoundIfDue().then(() => syncSnapshot()).catch(() => undefined);
    }, 3000);

    return () => {
      unsubscribe();
      window.clearInterval(advanceInterval);
    };
  }, [syncSnapshot]);

  useEffect(() => {
    const updateCountdown = () => {
      if (!currentRound) {
        setCountdownMs(0);
        return;
      }

      const targetMs = getRouletteCountdownTargetMs(currentRound);
      if (!targetMs) {
        setCountdownMs(0);
        return;
      }

      setCountdownMs(Math.max(0, targetMs - Date.now()));
    };

    updateCountdown();
    const timer = window.setInterval(updateCountdown, 250);

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
