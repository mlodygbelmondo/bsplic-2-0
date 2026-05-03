import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import {
  type Card,
  type BlackjackHandState,
  type BlackjackGameStatus,
  type BlackjackGameState,
  placeBlackjackBet,
  blackjackHit,
  blackjackStand,
  blackjackDoubleDown,
  blackjackSplit,
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
  const [status, setStatus] = useState<BlackjackGameStatus>('betting');
  const [stake, setStake] = useState(0);
  const [gameId, setGameId] = useState<string | null>(null);
  const [isDealing, setIsDealing] = useState(false);
  // Guards against rapid double-clicks calling action RPCs concurrently.
  const [isResolving, setIsResolving] = useState(false);
  const [doubleDownUsed, setDoubleDownUsed] = useState(false);

  const applyState = useCallback((next: BlackjackGameState) => {
    setGameId(next.id);
    setStake(next.stake);
    setPlayerHand(next.playerHand);
    setPlayerHands(next.playerHands);
    setActiveHandIndex(next.activeHandIndex);
    setDealerHand(next.dealerHand);
    setStatus(next.status);
    setDoubleDownUsed(next.doubleDownUsed);
  }, []);

  const startGame = useCallback(
    async (betAmount: number) => {
      if (isDealing || isResolving) return;
      setIsDealing(true);
      try {
        const next = await placeBlackjackBet({ userId, stake: betAmount });
        applyState(next);
        await refreshProfile();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Nie udało się rozpocząć gry',
        );
      } finally {
        setIsDealing(false);
      }
    },
    [userId, refreshProfile, applyState, isDealing, isResolving],
  );

  const hit = useCallback(async () => {
    if (status !== 'playing' || !gameId || isResolving) return;
    setIsResolving(true);
    try {
      const next = await blackjackHit({ gameId, userId });
      applyState(next);
      if (next.status !== 'playing') {
        await refreshProfile();
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Nie udało się dobrać karty',
      );
    } finally {
      setIsResolving(false);
    }
  }, [status, gameId, userId, isResolving, applyState, refreshProfile]);

  const stand = useCallback(async () => {
    if (status !== 'playing' || !gameId || isResolving) return;
    setIsResolving(true);
    try {
      const next = await blackjackStand({ gameId, userId });
      applyState(next);
      await refreshProfile();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Nie udało się zakończyć gry',
      );
    } finally {
      setIsResolving(false);
    }
  }, [status, gameId, userId, isResolving, applyState, refreshProfile]);

  const split = useCallback(async () => {
    if (status !== 'playing' || !gameId || isResolving) return;
    setIsResolving(true);
    try {
      const next = await blackjackSplit({ gameId, userId });
      applyState(next);
      await refreshProfile();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Nie udało się rozdzielić kart',
      );
    } finally {
      setIsResolving(false);
    }
  }, [status, gameId, userId, isResolving, applyState, refreshProfile]);

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
    try {
      const next = await blackjackDoubleDown({ gameId, userId });
      applyState(next);
      await refreshProfile();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Nie udało się podwoić stawki',
      );
    } finally {
      setIsResolving(false);
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
    refreshProfile,
  ]);

  const resetGame = useCallback(() => {
    setPlayerHand([]);
    setPlayerHands([]);
    setActiveHandIndex(0);
    setDealerHand([]);
    setStatus('betting');
    setStake(0);
    setGameId(null);
    setDoubleDownUsed(false);
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

  return {
    playerHand,
    playerHands,
    activeHandIndex,
    activeHand,
    dealerHand,
    status,
    stake,
    isDealing,
    isResolving,
    startGame,
    hit,
    stand,
    split,
    doubleDown,
    resetGame,
    canSplit,
    canDoubleDown,
  };
}
