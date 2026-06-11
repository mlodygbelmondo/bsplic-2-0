import type {
  BlackjackGameState,
  BlackjackHandState,
  Card,
} from '@/features/casino/api/blackjack';

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

/**
 * A single beat of the dealer-reveal finale. The hook plays steps in order,
 * waiting `delay` ms before applying each one.
 */
export interface RevealStep {
  delay: number;
  /** How many dealer cards are visible after this step. */
  dealerCards: number;
  /** Apply the full settled state (results, payouts) on this step. */
  settle: boolean;
}

export const REVEAL_FLIP_DELAY_MS = 450;
/** Fresh deals first let the deal-in animation finish before the flip. */
export const REVEAL_FRESH_DEAL_FLIP_DELAY_MS = 900;
export const REVEAL_DRAW_DELAY_MS = 650;
export const REVEAL_SETTLE_DELAY_MS = 550;

export interface BuildFinaleStepsOptions {
  reducedMotion?: boolean;
  freshDeal?: boolean;
}

/**
 * Builds the staged dealer reveal for a settled game: flip the hole card,
 * then turn each drawn card with a pause, then show the result. With reduced
 * motion everything lands in a single immediate step.
 */
export function buildFinaleSteps(
  next: BlackjackGameState,
  { reducedMotion = false, freshDeal = false }: BuildFinaleStepsOptions = {},
): RevealStep[] {
  const total = next.dealerHand.length;

  if (reducedMotion || total <= 1) {
    return [{ delay: 0, dealerCards: total, settle: true }];
  }

  const steps: RevealStep[] = [
    {
      delay: freshDeal ? REVEAL_FRESH_DEAL_FLIP_DELAY_MS : REVEAL_FLIP_DELAY_MS,
      dealerCards: 2,
      settle: false,
    },
  ];

  for (let count = 3; count <= total; count += 1) {
    steps.push({ delay: REVEAL_DRAW_DELAY_MS, dealerCards: count, settle: false });
  }

  steps.push({ delay: REVEAL_SETTLE_DELAY_MS, dealerCards: total, settle: true });

  return steps;
}

/**
 * Hides per-hand results while the dealer finale is playing: settled
 * statuses are masked back to stand/busted so the UI doesn't spoil the
 * outcome before the dealer's cards are on the table.
 */
export function maskHandsForReveal(
  hands: BlackjackHandState[],
): BlackjackHandState[] {
  return hands.map((hand) => ({
    ...hand,
    payout: 0,
    status: calculateHandValue(hand.cards) > 21 ? 'busted' : 'stand',
  }));
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
