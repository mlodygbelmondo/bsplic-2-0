import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  getRouletteTableSnapshot,
  placeRouletteBet,
  subscribeToRouletteRounds,
} from '@/features/casino/api/roulette';
import {
  formatRouletteCountdown,
  getRouletteNextSyncDelayMs,
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
  username?: string;
  avatarUrl?: string | null;
  refreshProfile: () => Promise<void>;
}

interface PlaceBetInput {
  betType: RouletteBetType;
  betValue: string;
  stake: number;
}

export function useRouletteTable({
  userId,
  username = 'Ty',
  avatarUrl = null,
  refreshProfile,
}: UseRouletteTableArgs) {
  const [currentRound, setCurrentRound] = useState<RouletteTableRound | null>(
    null,
  );
  const [recentSpins, setRecentSpins] = useState<RouletteTableRound[]>([]);
  const [recentWins, setRecentWins] = useState<RouletteRecentWin[]>([]);
  const [activeBets, setActiveBets] = useState<RouletteBetRecord[]>([]);
  const [roundParticipants, setRoundParticipants] = useState<
    RouletteRoundParticipant[]
  >([]);
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

  const syncSnapshot = useCallback(
    (withSpinner = false) => {
      if (syncSnapshotPromiseRef.current) {
        return syncSnapshotPromiseRef.current;
      }

      if (withSpinner) {
        setIsRefreshing(true);
      }

      const snapshotPromise = (async () => {
        const snapshot = await getRouletteTableSnapshot();

        setCurrentRound(snapshot.currentRound);
        setRecentSpins(snapshot.recentSpins);
        setRecentWins(snapshot.recentWins);
        setActiveBets(snapshot.activeBets);
        setRoundParticipants(snapshot.roundParticipants);

        const newestUserSettledWin =
          snapshot.recentWins.find((win) => win.user_id === userId) ?? null;
        if (
          newestUserSettledWin?.round_id &&
          newestUserSettledWin.round_id !== lastSettledRoundIdRef.current
        ) {
          lastSettledRoundIdRef.current = newestUserSettledWin.round_id;
          await refreshProfileRef.current();
        }

        setTableMessage(null);
      })()
        .catch((error) => {
          setTableMessage(
            error instanceof Error
              ? error.message
              : 'Nie udało się zsynchronizować stołu ruletki.',
          );
        })
        .finally(() => {
          setIsLoading(false);
          setIsRefreshing(false);
          syncSnapshotPromiseRef.current = null;
        });

      syncSnapshotPromiseRef.current = snapshotPromise;
      return snapshotPromise;
    },
    [userId],
  );

  useEffect(() => {
    void syncSnapshot(true);

    const unsubscribe = subscribeToRouletteRounds(() => {
      void syncSnapshot();
    });

    return () => {
      unsubscribe();
    };
  }, [syncSnapshot]);

  useEffect(() => {
    if (!currentRound) {
      return undefined;
    }

    const nextSyncTimer = window.setTimeout(() => {
      void syncSnapshot();
    }, getRouletteNextSyncDelayMs(currentRound));

    return () => {
      window.clearTimeout(nextSyncTimer);
    };
  }, [currentRound, syncSnapshot]);

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
      setIsPlacingBet(true);

      try {
        const acceptedBet = await placeRouletteBet({
          userId,
          betType,
          betValue,
          stake,
        });

        setActiveBets((previous) => [acceptedBet, ...previous]);
        setRoundParticipants((previous) =>
          upsertLocalRoundParticipant(previous, {
            userId,
            username,
            avatarUrl,
            acceptedBet,
          }),
        );
        await refreshProfileRef.current();
        await syncSnapshot();
        return acceptedBet;
      } finally {
        setIsPlacingBet(false);
      }
    },
    [avatarUrl, syncSnapshot, userId, username],
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

function upsertLocalRoundParticipant(
  participants: RouletteRoundParticipant[],
  {
    userId,
    username,
    avatarUrl,
    acceptedBet,
  }: {
    userId: string;
    username: string;
    avatarUrl: string | null;
    acceptedBet: RouletteBetRecord;
  },
) {
  const participantBet = {
    bet_type: acceptedBet.bet_type,
    bet_value: acceptedBet.bet_value,
    stake: acceptedBet.stake,
  };
  const existing = participants.find(
    (participant) => participant.user_id === userId,
  );

  if (!existing) {
    return [
      {
        user_id: userId,
        username,
        avatar_url: avatarUrl,
        total_stake: acceptedBet.stake,
        bet_count: 1,
        bets: [participantBet],
      },
      ...participants,
    ];
  }

  return participants.map((participant) => {
    if (participant.user_id !== userId) {
      return participant;
    }

    return {
      ...participant,
      username: participant.username || username,
      avatar_url: participant.avatar_url ?? avatarUrl,
      total_stake: participant.total_stake + acceptedBet.stake,
      bet_count: participant.bet_count + 1,
      bets: [participantBet, ...participant.bets],
    };
  });
}
