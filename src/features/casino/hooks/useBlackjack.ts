import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { toast } from 'sonner';

import {
  type Card,
  type BlackjackHandState,
  type BlackjackGameStatus,
  type BlackjackGameState,
  type BlackjackTableInfo,
  getBlackjackTableInfo,
  getCurrentBlackjackGame,
  placeBlackjackBet,
  blackjackHit,
  blackjackStand,
  blackjackDoubleDown,
  blackjackSplit,
  blackjackTakeInsurance,
  blackjackDeclineInsurance,
  type BlackjackInsuranceStatus,
} from '@/features/casino/api/blackjack';
import {
  buildFinaleSteps,
  calculateHandValue,
  maskHandsForReveal,
  wait,
} from '@/features/casino/lib/blackjackReveal';
import {
  playCardSound,
  playChipSound,
  playFlipSound,
  playResultSound,
  vibrate,
} from '@/features/casino/lib/blackjackSfx';

export { calculateHandValue };

export interface UseBlackjackArgs {
  userId: string;
  refreshProfile: () => Promise<void>;
}

const SETTLED_STATUSES: BlackjackGameStatus[] = ['won', 'lost', 'push'];

function isSettledStatus(status: BlackjackGameState['status']): boolean {
  return SETTLED_STATUSES.includes(status);
}

export function useBlackjack({ userId, refreshProfile }: UseBlackjackArgs) {
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [playerHands, setPlayerHands] = useState<BlackjackHandState[]>([]);
  const [activeHandIndex, setActiveHandIndex] = useState(0);
  const [dealerHand, setDealerHand] = useState<Card[]>([]);
  const [dealerHiddenCount, setDealerHiddenCount] = useState(0);
  const [status, setStatus] = useState<BlackjackGameStatus>('betting');
  const [stake, setStake] = useState(0);
  const [gameId, setGameId] = useState<string | null>(null);
  const [tableInfo, setTableInfo] = useState<BlackjackTableInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDealing, setIsDealing] = useState(false);
  // Guards against rapid double-clicks calling action RPCs concurrently.
  const [isResolving, setIsResolving] = useState(false);
  // True while the staged dealer reveal (finale) is playing out.
  const [isRevealing, setIsRevealing] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [doubleDownUsed, setDoubleDownUsed] = useState(false);
  const [insuranceStatus, setInsuranceStatus] =
    useState<BlackjackInsuranceStatus>('unavailable');
  const [insuranceStake, setInsuranceStake] = useState(0);
  const [insurancePayout, setInsurancePayout] = useState(0);
  const reducedMotion = useReducedMotion();
  // Bumping this id cancels any in-flight reveal sequence.
  const revealRunRef = useRef(0);

  useEffect(() => {
    return () => {
      revealRunRef.current += 1;
    };
  }, []);

  const applyTableInfoFromState = useCallback(
    (next: BlackjackGameState, previousInfo?: BlackjackTableInfo | null) => {
      setTableInfo((currentInfo) => ({
        deckCount: next.deckCount,
        cardsRemaining: next.cardsRemaining,
        shoeNumber: next.shoeNumber,
        handsPlayed: previousInfo?.handsPlayed ?? currentInfo?.handsPlayed ?? 0,
        needsShuffle: next.cardsRemaining < 26,
      }));
    },
    [],
  );

  const applyState = useCallback((next: BlackjackGameState) => {
    setGameId(next.id);
    setStake(next.stake);
    setPlayerHand(next.playerHand);
    setPlayerHands(next.playerHands);
    setActiveHandIndex(next.activeHandIndex);
    setDealerHand(next.dealerHand);
    setDealerHiddenCount(next.dealerHiddenCount);
    setStatus(next.status);
    setDoubleDownUsed(next.doubleDownUsed);
    setInsuranceStatus(next.insuranceStatus);
    setInsuranceStake(next.insuranceStake);
    setInsurancePayout(next.insurancePayout);
  }, []);

  /**
   * Plays the settled state as a staged dealer reveal: keep the game visually
   * undecided, flip the hole card, turn each drawn card with a pause, then
   * land the final result. Resolves once the sequence finished or was
   * cancelled (reset/unmount).
   */
  const playFinale = useCallback(
    async (next: BlackjackGameState, { freshDeal = false } = {}) => {
      const runId = ++revealRunRef.current;
      const steps = buildFinaleSteps(next, {
        reducedMotion: Boolean(reducedMotion),
        freshDeal,
      });

      setIsRevealing(true);
      setActionMessage('Krupier odkrywa karty...');
      setGameId(next.id);
      setStake(next.stake);
      setStatus('playing');
      setPlayerHands(maskHandsForReveal(next.playerHands));
      setPlayerHand(next.playerHands[0]?.cards ?? next.playerHand);
      setActiveHandIndex(next.activeHandIndex);
      setDealerHand(next.dealerHand.slice(0, 1));
      setDealerHiddenCount(1);

      try {
        for (const step of steps) {
          await wait(step.delay);
          if (revealRunRef.current !== runId) return;

          if (step.settle) {
            applyState(next);
            applyTableInfoFromState(next);
            setActionMessage(null);
            if (isSettledStatus(next.status)) {
              playResultSound(next.status as 'won' | 'lost' | 'push');
              vibrate(next.status === 'won' ? [20, 40, 30] : 15);
            }
          } else {
            if (step.dealerCards === 2) {
              playFlipSound();
            } else {
              playCardSound();
            }
            vibrate(8);
            setDealerHand(next.dealerHand.slice(0, step.dealerCards));
            setDealerHiddenCount(step.dealerCards >= 2 ? 0 : 1);
          }
        }
        await refreshProfile();
      } finally {
        if (revealRunRef.current === runId) {
          setIsRevealing(false);
          setActionMessage(null);
        }
      }
    },
    [applyState, applyTableInfoFromState, reducedMotion, refreshProfile],
  );

  const loadSnapshot = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [nextTableInfo, currentGame] = await Promise.all([
        getBlackjackTableInfo({ userId }),
        getCurrentBlackjackGame({ userId }),
      ]);

      setTableInfo(nextTableInfo);

      if (currentGame) {
        applyState(currentGame);
        applyTableInfoFromState(currentGame, nextTableInfo);
      } else {
        setPlayerHand([]);
        setPlayerHands([]);
        setActiveHandIndex(0);
        setDealerHand([]);
        setDealerHiddenCount(0);
        setStatus('betting');
        setStake(0);
        setGameId(null);
        setDoubleDownUsed(false);
        setInsuranceStatus('unavailable');
        setInsuranceStake(0);
        setInsurancePayout(0);
      }
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Nie udało się wczytać stołu blackjacka',
      );
    } finally {
      setIsLoading(false);
    }
  }, [userId, applyState, applyTableInfoFromState]);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  const startGame = useCallback(
    async (betAmount: number) => {
      if (isDealing || isResolving || isRevealing) return;
      setIsDealing(true);
      setActionMessage('Rozdawanie kart...');
      playChipSound();
      try {
        const next = await placeBlackjackBet({ userId, stake: betAmount });
        playCardSound();
        if (isSettledStatus(next.status)) {
          await playFinale(next, { freshDeal: true });
        } else {
          applyState(next);
          applyTableInfoFromState(next);
          await refreshProfile();
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Nie udało się rozpocząć gry',
        );
      } finally {
        setIsDealing(false);
        setActionMessage(null);
      }
    },
    [
      userId,
      refreshProfile,
      applyState,
      applyTableInfoFromState,
      playFinale,
      isDealing,
      isResolving,
      isRevealing,
    ],
  );

  const hit = useCallback(async () => {
    if (status !== 'playing' || !gameId || isResolving || isRevealing) return;
    setIsResolving(true);
    setActionMessage('Dobieranie karty...');
    try {
      const next = await blackjackHit({ gameId, userId });
      playCardSound();
      vibrate(8);
      if (isSettledStatus(next.status)) {
        await playFinale(next);
      } else {
        applyState(next);
        applyTableInfoFromState(next);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Nie udało się dobrać karty',
      );
    } finally {
      setIsResolving(false);
      setActionMessage(null);
    }
  }, [
    status,
    gameId,
    userId,
    isResolving,
    isRevealing,
    applyState,
    applyTableInfoFromState,
    playFinale,
  ]);

  const stand = useCallback(async () => {
    if (status !== 'playing' || !gameId || isResolving || isRevealing) return;
    setIsResolving(true);
    setActionMessage('Krupier dobiera...');
    try {
      const next = await blackjackStand({ gameId, userId });
      if (isSettledStatus(next.status)) {
        await playFinale(next);
      } else {
        applyState(next);
        applyTableInfoFromState(next);
        await refreshProfile();
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Nie udało się zakończyć gry',
      );
    } finally {
      setIsResolving(false);
      setActionMessage(null);
    }
  }, [
    status,
    gameId,
    userId,
    isResolving,
    isRevealing,
    applyState,
    applyTableInfoFromState,
    playFinale,
    refreshProfile,
  ]);

  const split = useCallback(async () => {
    if (status !== 'playing' || !gameId || isResolving || isRevealing) return;
    setIsResolving(true);
    setActionMessage('Rozdzielanie ręki...');
    playChipSound();
    try {
      const next = await blackjackSplit({ gameId, userId });
      playCardSound();
      if (isSettledStatus(next.status)) {
        await playFinale(next);
      } else {
        applyState(next);
        applyTableInfoFromState(next);
        await refreshProfile();
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Nie udało się rozdzielić kart',
      );
    } finally {
      setIsResolving(false);
      setActionMessage(null);
    }
  }, [
    status,
    gameId,
    userId,
    isResolving,
    isRevealing,
    applyState,
    applyTableInfoFromState,
    playFinale,
    refreshProfile,
  ]);

  const doubleDown = useCallback(async () => {
    const currentHand = playerHands[activeHandIndex] ?? null;
    if (
      status !== 'playing' ||
      !gameId ||
      isResolving ||
      isRevealing ||
      currentHand?.doubleDownUsed
    )
      return;
    if (playerHand.length !== 2) return;
    setIsResolving(true);
    setActionMessage('Double Down...');
    playChipSound();
    try {
      const next = await blackjackDoubleDown({ gameId, userId });
      playCardSound();
      vibrate(8);
      if (isSettledStatus(next.status)) {
        await playFinale(next);
      } else {
        applyState(next);
        applyTableInfoFromState(next);
        await refreshProfile();
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Nie udało się podwoić stawki',
      );
    } finally {
      setIsResolving(false);
      setActionMessage(null);
    }
  }, [
    status,
    gameId,
    userId,
    isResolving,
    isRevealing,
    playerHands,
    activeHandIndex,
    playerHand.length,
    applyState,
    applyTableInfoFromState,
    playFinale,
    refreshProfile,
  ]);

  const takeInsurance = useCallback(async () => {
    if (status !== 'insurance' || !gameId || isResolving || isRevealing) return;
    setIsResolving(true);
    setActionMessage('Sprawdzanie blackjacka...');
    playChipSound();
    try {
      const next = await blackjackTakeInsurance({ gameId, userId });
      if (isSettledStatus(next.status)) {
        await playFinale(next);
      } else {
        applyState(next);
        applyTableInfoFromState(next);
        await refreshProfile();
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Nie udało się postawić insurance',
      );
    } finally {
      setIsResolving(false);
      setActionMessage(null);
    }
  }, [
    status,
    gameId,
    userId,
    isResolving,
    isRevealing,
    applyState,
    applyTableInfoFromState,
    playFinale,
    refreshProfile,
  ]);

  const declineInsurance = useCallback(async () => {
    if (status !== 'insurance' || !gameId || isResolving || isRevealing) return;
    setIsResolving(true);
    setActionMessage('Sprawdzanie blackjacka...');
    try {
      const next = await blackjackDeclineInsurance({ gameId, userId });
      if (isSettledStatus(next.status)) {
        await playFinale(next);
      } else {
        applyState(next);
        applyTableInfoFromState(next);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Nie udało się odrzucić insurance',
      );
    } finally {
      setIsResolving(false);
      setActionMessage(null);
    }
  }, [
    status,
    gameId,
    userId,
    isResolving,
    isRevealing,
    applyState,
    applyTableInfoFromState,
    playFinale,
  ]);

  const resetGame = useCallback(() => {
    revealRunRef.current += 1;
    setIsRevealing(false);
    setPlayerHand([]);
    setPlayerHands([]);
    setActiveHandIndex(0);
    setDealerHand([]);
    setDealerHiddenCount(0);
    setStatus('betting');
    setStake(0);
    setGameId(null);
    setDoubleDownUsed(false);
    setInsuranceStatus('unavailable');
    setInsuranceStake(0);
    setInsurancePayout(0);
  }, []);

  const activeHand = playerHands[activeHandIndex] ?? null;
  const activeCards = activeHand?.cards ?? playerHand;
  const canActOnActiveHand =
    status === 'playing' &&
    activeHand?.status === 'playing' &&
    !isResolving &&
    !isRevealing;
  const canSplit = Boolean(
    canActOnActiveHand &&
    activeCards.length === 2 &&
    playerHands.length < 4 &&
    activeCards[0]?.value === activeCards[1]?.value,
  );
  const canDoubleDown = Boolean(
    canActOnActiveHand &&
    activeCards.length === 2 &&
    !activeHand?.doubleDownUsed,
  );
  const canTakeInsurance = Boolean(
    status === 'insurance' && insuranceStatus === 'offered' && !isResolving,
  );

  return {
    playerHand,
    playerHands,
    activeHandIndex,
    activeHand,
    dealerHand,
    dealerHiddenCount,
    status,
    stake,
    gameId,
    tableInfo,
    isLoading,
    isDealing,
    isResolving,
    isRevealing,
    actionMessage,
    insuranceStatus,
    insuranceStake,
    insurancePayout,
    startGame,
    hit,
    stand,
    split,
    doubleDown,
    takeInsurance,
    declineInsurance,
    resetGame,
    canSplit,
    canDoubleDown,
    canTakeInsurance,
  };
}
