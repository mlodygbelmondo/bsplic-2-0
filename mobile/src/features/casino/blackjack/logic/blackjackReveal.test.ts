import { describe, expect, it } from 'vitest';

import type {
  BlackjackGameState,
  BlackjackHandState,
  Card,
} from '../api/blackjack';

import { buildFinaleSteps, calculateHandValue, maskHandsForReveal } from './blackjackReveal';

// Reveal timings from the spec (13-blackjack.md, "Dealer finale").
const FLIP_DELAY_MS = 450;
const FRESH_DEAL_FLIP_DELAY_MS = 900;
const DRAW_DELAY_MS = 650;
const SETTLE_DELAY_MS = 550;

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
    expect(steps.map((step) => step.delay)).toEqual([
      FLIP_DELAY_MS,
      DRAW_DELAY_MS,
      DRAW_DELAY_MS,
      SETTLE_DELAY_MS,
    ]);
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

    expect(steps[0].delay).toBe(FRESH_DEAL_FLIP_DELAY_MS);
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

describe('calculateHandValue', () => {
  it('returns 0 for an empty hand', () => {
    expect(calculateHandValue([])).toBe(0);
  });

  it('sums numeric cards', () => {
    expect(calculateHandValue([c('2', 2), c('5', 5), c('9', 9)])).toBe(16);
  });

  it('treats face cards as 10', () => {
    expect(calculateHandValue([c('K', 10), c('Q', 10)])).toBe(20);
  });

  it('counts a single ace as 11 when safe', () => {
    expect(calculateHandValue([c('A', 11), c('9', 9)])).toBe(20);
  });

  it('downgrades an ace from 11 to 1 when total would bust', () => {
    expect(calculateHandValue([c('A', 11), c('9', 9), c('5', 5)])).toBe(15);
  });

  it('handles multiple aces, downgrading only as needed', () => {
    // A + A + 9 -> 11 + 1 + 9 = 21
    expect(calculateHandValue([c('A', 11), c('A', 11), c('9', 9)])).toBe(21);
  });

  it('downgrades aces only as far as needed to avoid bust', () => {
    // A + A + A + 8 -> 1 + 1 + 11 + 8 = 21 (only two aces need downgrading)
    expect(calculateHandValue([c('A', 11), c('A', 11), c('A', 11), c('8', 8)])).toBe(21);
  });

  it('downgrades all aces when total still busts', () => {
    // A + A + A + 9 -> 1 + 1 + 1 + 9 = 12 (all aces forced to 1)
    expect(calculateHandValue([c('A', 11), c('A', 11), c('A', 11), c('9', 9)])).toBe(12);
  });

  it('detects natural blackjack (A + 10-value) as 21', () => {
    expect(calculateHandValue([c('A', 11), c('K', 10)])).toBe(21);
  });

  it('returns a busted total when no aces can save the hand', () => {
    expect(calculateHandValue([c('K', 10), c('Q', 10), c('5', 5)])).toBe(25);
  });
});
