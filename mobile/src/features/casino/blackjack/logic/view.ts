import type { BlackjackHandState, Card } from '../api/blackjack';
import { calculateHandValue } from './blackjackReveal';
import { isSettledStatus, type BlackjackState } from './game';

export interface DealerSlot {
  /** Stable per game and position, so the hole card flips in place instead of remounting. */
  key: string;
  card: Card;
  hidden: boolean;
  index: number;
}

/** Face-down placeholder: the server never sends the hole card's rank or suit. */
const HIDDEN_CARD: Omit<Card, 'id'> = { suit: 'spades', rank: 'A', value: 11 };

/**
 * Everything the table renders, derived from the game state (the web
 * `BlackjackGame` render body). Pure, so the rules are testable.
 */
export function deriveBlackjackView(state: BlackjackState) {
  const { status, playerHands, playerHand, activeHandIndex, dealerHand, dealerHiddenCount, stake, gameId } = state;

  const isDecisionState = status === 'playing' || status === 'insurance';
  const isSettled = isSettledStatus(status);
  const fallbackHandStatus = isSettled ? status : 'playing';

  const hands: BlackjackHandState[] =
    playerHands.length > 0
      ? playerHands
      : playerHand.length > 0
        ? [
            {
              id: 'hand-1',
              cards: playerHand,
              stake,
              payout: 0,
              status: fallbackHandStatus,
              doubleDownUsed: false,
              isSplitAces: false,
            },
          ]
        : [];
  const hasSplitHands = hands.length > 1;
  const activeHand = playerHands[activeHandIndex] ?? null;
  const activeCards = activeHand?.cards ?? playerHand;

  const showSplitResult = hasSplitHands && isSettled;
  const splitWins = hands.filter((hand) => hand.status === 'won').length;
  const splitLosses = hands.filter((hand) => hand.status === 'lost').length;
  const splitPushes = hands.filter((hand) => hand.status === 'push').length;
  const totalPayout = hands.reduce((sum, hand) => sum + hand.payout, 0) + state.insurancePayout;
  const netResult = totalPayout - stake;
  const resultTitle = showSplitResult
    ? 'Wynik splitu'
    : status === 'won'
      ? 'Wygrana!'
      : status === 'lost'
        ? 'Porażka'
        : 'Remis';

  const slotPrefix = gameId ?? 'pending';
  const dealerSlots: DealerSlot[] = dealerHand.map((card, index) => ({
    card,
    hidden: false,
    index,
    key: `dealer-slot-${slotPrefix}-${index}`,
  }));
  if (isDecisionState) {
    for (let hiddenIndex = 0; hiddenIndex < dealerHiddenCount; hiddenIndex += 1) {
      const index = dealerHand.length + hiddenIndex;
      dealerSlots.push({
        card: { ...HIDDEN_CARD, id: `dealer-hidden-${hiddenIndex}` },
        hidden: true,
        index,
        key: `dealer-slot-${slotPrefix}-${index}`,
      });
    }
  }

  const actionsLocked = state.isResolving || state.isRevealing || state.isSyncing || state.isLoading;
  const canActOnActiveHand = status === 'playing' && activeHand?.status === 'playing' && !actionsLocked;
  const canSplit =
    canActOnActiveHand &&
    activeCards.length === 2 &&
    playerHands.length < 4 &&
    activeCards[0]?.value === activeCards[1]?.value;
  const canDoubleDown = canActOnActiveHand && activeCards.length === 2 && !activeHand?.doubleDownUsed;
  const canTakeInsurance = status === 'insurance' && state.insuranceStatus === 'offered' && !state.isResolving;

  return {
    isDecisionState,
    isSettled,
    hands,
    hasSplitHands,
    activeHand,
    activeStake: activeHand?.stake ?? stake,
    decisionValue: calculateHandValue(activeCards),
    dealerValue: calculateHandValue(dealerHand),
    dealerHoleHidden: dealerHiddenCount > 0 && isDecisionState,
    dealerSlots,
    shoeTotalCards: (state.tableInfo?.deckCount ?? 2) * 52,
    showSplitResult,
    splitWins,
    splitLosses,
    splitPushes,
    totalPayout,
    netResult,
    resultTitle,
    actionsLocked,
    canSplit,
    canDoubleDown,
    canTakeInsurance,
  };
}

export type BlackjackView = ReturnType<typeof deriveBlackjackView>;

/** Stake input text to a number; Polish keyboards type a decimal comma. */
export function parseStakeInput(input: string): number {
  const value = Number(input.trim().replace(',', '.'));
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : Number.NaN;
}
