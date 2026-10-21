import { describe, expect, it } from 'vitest';

import type { BlackjackHandState, Card } from '../api/blackjack';
import type { BlackjackState } from './game';
import { deriveBlackjackView, parseStakeInput } from './view';

const card = (id: string, rank: Card['rank'], value: number): Card => ({ id, suit: 'hearts', rank, value });

const hand = (id: string, cards: Card[], overrides: Partial<BlackjackHandState> = {}): BlackjackHandState => ({
  id,
  cards,
  stake: 20,
  payout: 0,
  status: 'playing',
  doubleDownUsed: false,
  isSplitAces: false,
  ...overrides,
});

const base: BlackjackState = {
  playerHand: [],
  playerHands: [],
  activeHandIndex: 0,
  dealerHand: [],
  dealerHiddenCount: 0,
  status: 'betting',
  stake: 0,
  gameId: null,
  tableInfo: { deckCount: 2, cardsRemaining: 78, shoeNumber: 4, handsPlayed: 11, needsShuffle: false },
  isLoading: false,
  isSyncing: false,
  isDealing: false,
  isResolving: false,
  isRevealing: false,
  actionMessage: null,
  doubleDownUsed: false,
  insuranceStatus: 'unavailable',
  insuranceStake: 0,
  insurancePayout: 0,
};

describe('deriveBlackjackView', () => {
  it('counts the shoe from the deck count', () => {
    expect(deriveBlackjackView(base).shoeTotalCards).toBe(104);
  });

  it('keeps the dealer hole-card slot stable when the dealer reveals and draws', () => {
    const playing = deriveBlackjackView({
      ...base,
      status: 'playing',
      gameId: 'game-1',
      dealerHand: [card('d-1', '9', 9)],
      dealerHiddenCount: 1,
      playerHands: [hand('hand-1', [card('p-1', '10', 10), card('p-2', '7', 7)])],
    });
    expect(playing.dealerSlots.map((slot) => [slot.key, slot.hidden])).toEqual([
      ['dealer-slot-game-1-0', false],
      ['dealer-slot-game-1-1', true],
    ]);
    expect(playing.dealerHoleHidden).toBe(true);

    const revealed = deriveBlackjackView({
      ...base,
      status: 'lost',
      gameId: 'game-1',
      dealerHand: [card('d-1', '9', 9), card('d-2', '10', 10), card('d-3', '2', 2)],
      playerHands: [hand('hand-1', [card('p-1', '10', 10), card('p-2', '7', 7)], { status: 'lost' })],
    });
    expect(revealed.dealerSlots[1]).toMatchObject({ key: 'dealer-slot-game-1-1', hidden: false, card: { id: 'd-2' } });
    expect(revealed.dealerSlots[2].card.id).toBe('d-3');
    expect(revealed.dealerHoleHidden).toBe(false);
  });

  it('never shows face-down slots outside a decision', () => {
    const view = deriveBlackjackView({
      ...base,
      status: 'won',
      gameId: 'game-1',
      dealerHand: [card('d-1', '9', 9)],
      dealerHiddenCount: 1,
    });
    expect(view.dealerSlots).toHaveLength(1);
  });

  it('offers split for two ten-value cards and double down on two cards', () => {
    const view = deriveBlackjackView({
      ...base,
      status: 'playing',
      gameId: 'game-1',
      playerHands: [hand('hand-1', [card('p-1', '10', 10), card('p-2', 'K', 10)])],
      playerHand: [card('p-1', '10', 10), card('p-2', 'K', 10)],
    });
    expect(view.canSplit).toBe(true);
    expect(view.canDoubleDown).toBe(true);
    expect(view.decisionValue).toBe(20);
  });

  it('blocks split at four hands and double down after it was used', () => {
    const pair = [card('p-1', '8', 8), card('p-2', '8', 8)];
    const view = deriveBlackjackView({
      ...base,
      status: 'playing',
      gameId: 'game-1',
      playerHands: [
        hand('hand-1', pair, { doubleDownUsed: true }),
        hand('hand-2', [card('p-3', '8', 8), card('p-4', '3', 3)]),
        hand('hand-3', [card('p-5', '8', 8), card('p-6', '4', 4)]),
        hand('hand-4', [card('p-7', '8', 8), card('p-8', '5', 5)]),
      ],
    });
    expect(view.canSplit).toBe(false);
    expect(view.canDoubleDown).toBe(false);
  });

  it('locks every hand action while a request or the reveal is running', () => {
    const playing = {
      ...base,
      status: 'playing' as const,
      gameId: 'game-1',
      playerHands: [hand('hand-1', [card('p-1', '8', 8), card('p-2', '8', 8)])],
    };
    for (const flag of ['isResolving', 'isRevealing', 'isSyncing'] as const) {
      const view = deriveBlackjackView({ ...playing, [flag]: true });
      expect(view.actionsLocked).toBe(true);
      expect(view.canSplit).toBe(false);
      expect(view.canDoubleDown).toBe(false);
    }
  });

  it('allows only insurance choices during an insurance offer', () => {
    const view = deriveBlackjackView({
      ...base,
      status: 'insurance',
      gameId: 'game-1',
      insuranceStatus: 'offered',
      insuranceStake: 10,
      dealerHand: [card('d-1', 'A', 11)],
      dealerHiddenCount: 1,
      playerHands: [hand('hand-1', [card('p-1', '8', 8), card('p-2', '8', 8)])],
    });
    expect(view.canTakeInsurance).toBe(true);
    expect(view.canSplit).toBe(false);
    expect(view.canDoubleDown).toBe(false);
    expect(view.dealerSlots.some((slot) => slot.hidden)).toBe(true);
  });

  it('summarizes settled split hands without flattening mixed outcomes to defeat', () => {
    const view = deriveBlackjackView({
      ...base,
      status: 'push',
      stake: 40,
      gameId: 'game-1',
      playerHands: [
        hand('hand-1', [card('p-1', '10', 10), card('p-2', '9', 9)], { status: 'won', payout: 40 }),
        hand('hand-2', [card('p-3', '10', 10), card('p-4', '6', 6)], { status: 'lost' }),
      ],
    });
    expect(view.resultTitle).toBe('Wynik splitu');
    expect([view.splitWins, view.splitLosses, view.splitPushes]).toEqual([1, 1, 0]);
    expect(view.totalPayout).toBe(40);
    expect(view.netResult).toBe(0);
  });

  it('titles single-hand results and counts insurance in the payout', () => {
    const won = deriveBlackjackView({
      ...base,
      status: 'won',
      stake: 15,
      insurancePayout: 15,
      playerHands: [hand('hand-1', [card('p-1', 'A', 11), card('p-2', '9', 9)], { stake: 10, status: 'won', payout: 20 })],
    });
    expect(won.resultTitle).toBe('Wygrana!');
    expect(won.totalPayout).toBe(35);
    expect(won.netResult).toBe(20);

    expect(deriveBlackjackView({ ...base, status: 'lost' }).resultTitle).toBe('Porażka');
    expect(deriveBlackjackView({ ...base, status: 'push' }).resultTitle).toBe('Remis');
  });

  it('falls back to a single legacy hand from the flat player hand', () => {
    const view = deriveBlackjackView({
      ...base,
      status: 'won',
      stake: 10,
      playerHand: [card('p-1', '10', 10), card('p-2', '9', 9)],
    });
    expect(view.hands).toHaveLength(1);
    expect(view.hands[0]).toMatchObject({ id: 'hand-1', stake: 10, status: 'won' });
    expect(view.hasSplitHands).toBe(false);
  });
});

describe('parseStakeInput', () => {
  it('accepts a decimal comma and rounds to grosze', () => {
    expect(parseStakeInput('12,5')).toBe(12.5);
    expect(parseStakeInput('10.555')).toBe(10.56);
    expect(parseStakeInput(' 25 ')).toBe(25);
  });

  it('rejects text that is not a number', () => {
    expect(parseStakeInput('abc')).toBeNaN();
  });
});
