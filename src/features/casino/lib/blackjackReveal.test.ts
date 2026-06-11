import { describe, expect, it } from 'vitest';

import type {
  BlackjackGameState,
  BlackjackHandState,
  Card,
} from '@/features/casino/api/blackjack';

import {
  buildFinaleSteps,
  maskHandsForReveal,
  REVEAL_DRAW_DELAY_MS,
  REVEAL_FLIP_DELAY_MS,
  REVEAL_FRESH_DEAL_FLIP_DELAY_MS,
} from './blackjackReveal';

const c = (rank: Card['rank'], value: number): Card => ({
  suit: 'spades',
  rank,
  value,
});

const hand = (
  cards: Card[],
  status: BlackjackHandState['status'],
  payout = 0,
): BlackjackHandState => ({
  id: 'hand-1',
  cards,
  stake: 10,
  payout,
  status,
  doubleDownUsed: false,
  isSplitAces: false,
});

const settledState = (dealerCards: Card[]): BlackjackGameState => ({
  id: 'game-1',
  stake: 10,
  initialStake: 10,
  status: 'won',
  playerHand: [],
  playerHands: [hand([c('K', 10), c('9', 9)], 'won', 20)],
  activeHandIndex: 0,
  dealerHand: dealerCards,
  payout: 20,
  doubleDownUsed: false,
  deckCount: 2,
  cardsRemaining: 90,
  shoeNumber: 1,
  dealerHiddenCount: 0,
  createdAt: '',
  insuranceStatus: 'unavailable',
  insuranceStake: 0,
  insurancePayout: 0,
});

describe('buildFinaleSteps', () => {
  it('flips the hole card, draws one card at a time, then settles', () => {
    const steps = buildFinaleSteps(
      settledState([c('K', 10), c('7', 7), c('5', 5), c('2', 2)]),
    );

    expect(steps.map((step) => step.dealerCards)).toEqual([2, 3, 4, 4]);
    expect(steps.map((step) => step.settle)).toEqual([
      false,
      false,
      false,
      true,
    ]);
    expect(steps[0].delay).toBe(REVEAL_FLIP_DELAY_MS);
    expect(steps[1].delay).toBe(REVEAL_DRAW_DELAY_MS);
  });

  it('only flips and settles when the dealer did not draw', () => {
    const steps = buildFinaleSteps(settledState([c('K', 10), c('7', 7)]));

    expect(steps.map((step) => step.dealerCards)).toEqual([2, 2]);
    expect(steps.at(-1)?.settle).toBe(true);
  });

  it('waits for the deal-in animation on fresh deals', () => {
    const steps = buildFinaleSteps(settledState([c('K', 10), c('A', 11)]), {
      freshDeal: true,
    });

    expect(steps[0].delay).toBe(REVEAL_FRESH_DEAL_FLIP_DELAY_MS);
  });

  it('collapses to a single immediate step with reduced motion', () => {
    const steps = buildFinaleSteps(
      settledState([c('K', 10), c('7', 7), c('5', 5)]),
      { reducedMotion: true },
    );

    expect(steps).toEqual([{ delay: 0, dealerCards: 3, settle: true }]);
  });
});

describe('maskHandsForReveal', () => {
  it('hides settled outcomes behind stand status and zeroed payout', () => {
    const masked = maskHandsForReveal([
      hand([c('K', 10), c('9', 9)], 'won', 20),
      hand([c('K', 10), c('5', 5), c('4', 4)], 'push', 10),
    ]);

    expect(masked.map((next) => next.status)).toEqual(['stand', 'stand']);
    expect(masked.map((next) => next.payout)).toEqual([0, 0]);
  });

  it('keeps busted hands visibly busted', () => {
    const masked = maskHandsForReveal([
      hand([c('K', 10), c('9', 9), c('8', 8)], 'lost'),
    ]);

    expect(masked[0].status).toBe('busted');
  });
});
