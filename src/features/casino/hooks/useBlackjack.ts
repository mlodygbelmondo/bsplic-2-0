import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import {
  type Card,
  type BlackjackGameStatus,
  placeBlackjackBet,
  settleBlackjackGame,
  addBlackjackStake,
} from '@/features/casino/api/blackjack';

export interface UseBlackjackArgs {
  userId: string;
  refreshProfile: () => Promise<void>;
}

const SUITS: Card['suit'][] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: Card['rank'][] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function getCardValue(rank: Card['rank']): number {
  if (rank === 'A') return 11;
  if (['J', 'Q', 'K'].includes(rank)) return 10;
  return parseInt(rank, 10);
}

function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank, value: getCardValue(rank) });
    }
  }
  return deck;
}

function shuffleDeck(deck: Card[]): Card[] {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
}

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
  const [deck, setDeck] = useState<Card[]>([]);
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [dealerHand, setDealerHand] = useState<Card[]>([]);
  const [status, setStatus] = useState<BlackjackGameStatus>('betting');
  const [stake, setStake] = useState(0);
  const [gameId, setGameId] = useState<string | null>(null);
  const [isDealing, setIsDealing] = useState(false);

  // Can add split functionality later, keeping it simple for now (1 hand).

  const getCards = useCallback((currentDeck: Card[], count: number) => {
    let newDeck = [...currentDeck];

    // Auto shuffle 2 decks if running low
    if (newDeck.length < count) {
      newDeck = shuffleDeck([...createDeck(), ...createDeck()]);
    }

    const drawnCards = newDeck.slice(0, count);
    newDeck = newDeck.slice(count);

    return { newDeck, drawnCards };
  }, []);

  const startGame = useCallback(
    async (betAmount: number) => {
      setIsDealing(true);
      try {
        const result = await placeBlackjackBet({ userId, stake: betAmount });
        setGameId(result.id);
        setStake(result.stake);
        await refreshProfile();

        // Initial setup
        const currentDeck = deck.length < 15 ? shuffleDeck([...createDeck(), ...createDeck()]) : [...deck];

        const { newDeck: d1, drawnCards: playerInitial } = getCards(currentDeck, 2);
        const { newDeck: d2, drawnCards: dealerInitial } = getCards(d1, 2);

        setDeck(d2);
        setPlayerHand(playerInitial);
        setDealerHand(dealerInitial);
        setStatus('playing');

        const initialPlayerValue = calculateHandValue(playerInitial);
        const initialDealerValue = calculateHandValue(dealerInitial);

        // Blackjack checking
        if (initialPlayerValue === 21) {
            let finalStatus: 'won' | 'push' = 'won';
            let payout = result.stake * 2.5; // 3:2 payout

            if (initialDealerValue === 21) {
                finalStatus = 'push';
                payout = result.stake;
            }

            await settleBlackjackGame({
                gameId: result.id,
                userId,
                status: finalStatus,
                payout,
                playerHand: playerInitial,
                dealerHand: dealerInitial
            });
            setStatus(finalStatus);
            await refreshProfile();
        }

      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Nie udało się rozpocząć gry');
      } finally {
        setIsDealing(false);
      }
    },
    [userId, refreshProfile, getCards, deck]
  );

  const hit = useCallback(async () => {
    if (status !== 'playing' || !gameId) return;

    const { newDeck, drawnCards } = getCards(deck, 1);
    const newHand = [...playerHand, ...drawnCards];

    setDeck(newDeck);
    setPlayerHand(newHand);

    const val = calculateHandValue(newHand);

    if (val > 21) {
      // Bust
      await settleBlackjackGame({
        gameId,
        userId,
        status: 'lost',
        payout: 0,
        playerHand: newHand,
        dealerHand
      });
      setStatus('lost');
    }
  }, [deck, playerHand, getCards, status, gameId, userId, dealerHand]);

  const dealerPlay = useCallback(async (currentDealerHand: Card[], currentDeck: Card[], pHand: Card[], cStake: number) => {
    let dHand = [...currentDealerHand];
    let dDeck = [...currentDeck];
    let dValue = calculateHandValue(dHand);

    while (dValue < 17) {
        const { newDeck, drawnCards } = getCards(dDeck, 1);
        dHand = [...dHand, ...drawnCards];
        dDeck = newDeck;
        dValue = calculateHandValue(dHand);
    }

    setDeck(dDeck);
    setDealerHand(dHand);

    const pValue = calculateHandValue(pHand);
    let finalStatus: 'won' | 'lost' | 'push' = 'lost';
    let payout = 0;

    if (dValue > 21 || pValue > dValue) {
        finalStatus = 'won';
        payout = cStake * 2;
    } else if (dValue === pValue) {
        finalStatus = 'push';
        payout = cStake;
    }

    if (gameId) {
        await settleBlackjackGame({
            gameId,
            userId,
            status: finalStatus,
            payout,
            playerHand: pHand,
            dealerHand: dHand
        });
        setStatus(finalStatus);
        await refreshProfile();
    }
  }, [getCards, gameId, userId, refreshProfile]);


  const stand = useCallback(async () => {
    if (status !== 'playing' || !gameId) return;
    await dealerPlay(dealerHand, deck, playerHand, stake);
  }, [status, gameId, dealerPlay, dealerHand, deck, playerHand, stake]);

  const doubleDown = useCallback(async () => {
    if (status !== 'playing' || !gameId || playerHand.length !== 2) return;

    try {
      await addBlackjackStake({ gameId, userId, additionalStake: stake });
      const newStake = stake * 2;
      setStake(newStake);
      await refreshProfile();

      const { newDeck, drawnCards } = getCards(deck, 1);
      const newHand = [...playerHand, ...drawnCards];

      setDeck(newDeck);
      setPlayerHand(newHand);

      const val = calculateHandValue(newHand);

      if (val > 21) {
          await settleBlackjackGame({
              gameId,
              userId,
              status: 'lost',
              payout: 0,
              playerHand: newHand,
              dealerHand
          });
          setStatus('lost');
      } else {
          await dealerPlay(dealerHand, newDeck, newHand, newStake);
      }
    } catch(err) {
      toast.error(err instanceof Error ? err.message : 'Nie udało się podwoić stawki');
    }
  }, [status, gameId, playerHand, stake, userId, refreshProfile, getCards, deck, dealerHand, dealerPlay]);

  const resetGame = useCallback(() => {
    setPlayerHand([]);
    setDealerHand([]);
    setStatus('betting');
    setStake(0);
    setGameId(null);
  }, []);

  return {
    playerHand,
    dealerHand,
    status,
    stake,
    isDealing,
    startGame,
    hit,
    stand,
    doubleDown,
    resetGame,
    canDoubleDown: status === 'playing' && playerHand.length === 2,
  };
}
