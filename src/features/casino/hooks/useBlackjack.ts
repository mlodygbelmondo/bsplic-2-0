import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import {
  type Card,
  type BlackjackGameStatus,
  type BlackjackGameState,
  placeBlackjackBet,
  blackjackHit,
  blackjackStand,
  blackjackDoubleDown,
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
        toast.error(err instanceof Error ? err.message : 'Nie udało się rozpocząć gry');
      } finally {
        setIsDealing(false);
      }
    },
    [userId, refreshProfile, applyState, isDealing, isResolving]
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
      toast.error(err instanceof Error ? err.message : 'Nie udało się dobrać karty');
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
      toast.error(err instanceof Error ? err.message : 'Nie udało się zakończyć gry');
    } finally {
      setIsResolving(false);
    }
  }, [status, gameId, userId, isResolving, applyState, refreshProfile]);

  const doubleDown = useCallback(async () => {
    if (status !== 'playing' || !gameId || isResolving || doubleDownUsed) return;
    if (playerHand.length !== 2) return;
    setIsResolving(true);
    try {
      const next = await blackjackDoubleDown({ gameId, userId });
      applyState(next);
      await refreshProfile();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Nie udało się podwoić stawki');
    } finally {
      setIsResolving(false);
    }
  }, [
    status,
    gameId,
    userId,
    isResolving,
    doubleDownUsed,
    playerHand.length,
    applyState,
    refreshProfile,
  ]);

  const resetGame = useCallback(() => {
    setPlayerHand([]);
    setDealerHand([]);
    setStatus('betting');
    setStake(0);
    setGameId(null);
    setDoubleDownUsed(false);
  }, []);

  return {
    playerHand,
    dealerHand,
    status,
    stake,
    isDealing,
    isResolving,
    startGame,
    hit,
    stand,
    doubleDown,
    resetGame,
    canDoubleDown:
      status === 'playing' && playerHand.length === 2 && !doubleDownUsed && !isResolving,
  };
}
