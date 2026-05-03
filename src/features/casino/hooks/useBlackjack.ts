import { useCallback, useEffect, useState } from 'react';
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

export interface UseBlackjackArgs {
  userId: string;
  refreshProfile: () => Promise<void>;
}

/**
 * Calculates the optimal blackjack value of a hand. Mirrors the server-side
 * scoring (`_blackjack_hand_value`) for display purposes only — never used to
 * settle the game; the backend is authoritative.
 */
export function calculateHandValue(hand: Card[]): number {
  let value = 0;
  let aces = 0;

  for (const card of hand) {
    value += card.value;
    if (card.rank === 'A') {
      aces += 1;
    }
  }

  while (value > 21 && aces > 0) {
    value -= 10;
    aces -= 1;
  }

  return value;
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
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [doubleDownUsed, setDoubleDownUsed] = useState(false);
  const [insuranceStatus, setInsuranceStatus] =
    useState<BlackjackInsuranceStatus>('unavailable');
  const [insuranceStake, setInsuranceStake] = useState(0);
  const [insurancePayout, setInsurancePayout] = useState(0);

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
      if (isDealing || isResolving) return;
      setIsDealing(true);
      setActionMessage('Rozdawanie kart...');
      try {
        const next = await placeBlackjackBet({ userId, stake: betAmount });
        applyState(next);
        applyTableInfoFromState(next);
        await refreshProfile();
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
      isDealing,
      isResolving,
    ],
  );

  const hit = useCallback(async () => {
    if (status !== 'playing' || !gameId || isResolving) return;
    setIsResolving(true);
    setActionMessage('Dobieranie karty...');
    try {
      const next = await blackjackHit({ gameId, userId });
      applyState(next);
      applyTableInfoFromState(next);
      if (next.status !== 'playing') {
        await refreshProfile();
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
    applyState,
    applyTableInfoFromState,
    refreshProfile,
  ]);

  const stand = useCallback(async () => {
    if (status !== 'playing' || !gameId || isResolving) return;
    setIsResolving(true);
    setActionMessage('Krupier dobiera...');
    try {
      const next = await blackjackStand({ gameId, userId });
      applyState(next);
      applyTableInfoFromState(next);
      await refreshProfile();
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
    applyState,
    applyTableInfoFromState,
    refreshProfile,
  ]);

  const split = useCallback(async () => {
    if (status !== 'playing' || !gameId || isResolving) return;
    setIsResolving(true);
    setActionMessage('Rozdzielanie ręki...');
    try {
      const next = await blackjackSplit({ gameId, userId });
      applyState(next);
      applyTableInfoFromState(next);
      await refreshProfile();
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
    applyState,
    applyTableInfoFromState,
    refreshProfile,
  ]);

  const doubleDown = useCallback(async () => {
    const currentHand = playerHands[activeHandIndex] ?? null;
    if (
      status !== 'playing' ||
      !gameId ||
      isResolving ||
      currentHand?.doubleDownUsed
    )
      return;
    if (playerHand.length !== 2) return;
    setIsResolving(true);
    setActionMessage('Double Down...');
    try {
      const next = await blackjackDoubleDown({ gameId, userId });
      applyState(next);
      applyTableInfoFromState(next);
      await refreshProfile();
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
    playerHands,
    activeHandIndex,
    playerHand.length,
    applyState,
    applyTableInfoFromState,
    refreshProfile,
  ]);

  const takeInsurance = useCallback(async () => {
    if (status !== 'insurance' || !gameId || isResolving) return;
    setIsResolving(true);
    setActionMessage('Sprawdzanie blackjacka...');
    try {
      const next = await blackjackTakeInsurance({ gameId, userId });
      applyState(next);
      applyTableInfoFromState(next);
      await refreshProfile();
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
    applyState,
    applyTableInfoFromState,
    refreshProfile,
  ]);

  const declineInsurance = useCallback(async () => {
    if (status !== 'insurance' || !gameId || isResolving) return;
    setIsResolving(true);
    setActionMessage('Sprawdzanie blackjacka...');
    try {
      const next = await blackjackDeclineInsurance({ gameId, userId });
      applyState(next);
      applyTableInfoFromState(next);
      if (next.status !== 'playing') {
        await refreshProfile();
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
    applyState,
    applyTableInfoFromState,
    refreshProfile,
  ]);

  const resetGame = useCallback(() => {
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
    status === 'playing' && activeHand?.status === 'playing' && !isResolving;
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
