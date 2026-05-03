import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi } from 'vitest';

import { calculateHandValue } from './useBlackjack';
import type { Card } from '@/features/casino/api/blackjack';

import { useBlackjack } from './useBlackjack';

const getBlackjackTableInfoMock = vi.fn();
const getCurrentBlackjackGameMock = vi.fn();
const placeBlackjackBetMock = vi.fn();
const blackjackHitMock = vi.fn();
const blackjackStandMock = vi.fn();
const blackjackDoubleDownMock = vi.fn();
const blackjackSplitMock = vi.fn();

vi.mock('@/features/casino/api/blackjack', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/features/casino/api/blackjack')>();

  return {
    ...actual,
    getBlackjackTableInfo: (...args: unknown[]) =>
      getBlackjackTableInfoMock(...args),
    getCurrentBlackjackGame: (...args: unknown[]) =>
      getCurrentBlackjackGameMock(...args),
    placeBlackjackBet: (...args: unknown[]) => placeBlackjackBetMock(...args),
    blackjackHit: (...args: unknown[]) => blackjackHitMock(...args),
    blackjackStand: (...args: unknown[]) => blackjackStandMock(...args),
    blackjackDoubleDown: (...args: unknown[]) =>
      blackjackDoubleDownMock(...args),
    blackjackSplit: (...args: unknown[]) => blackjackSplitMock(...args),
  };
});

const c = (rank: Card['rank'], value: number): Card => ({
  suit: 'hearts',
  rank,
  value,
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
    expect(
      calculateHandValue([c('A', 11), c('A', 11), c('A', 11), c('8', 8)]),
    ).toBe(21);
  });

  it('downgrades all aces when total still busts', () => {
    // A + A + A + 9 -> 1 + 1 + 1 + 9 = 12 (all aces forced to 1)
    expect(
      calculateHandValue([c('A', 11), c('A', 11), c('A', 11), c('9', 9)]),
    ).toBe(12);
  });

  it('detects natural blackjack (A + 10-value) as 21', () => {
    expect(calculateHandValue([c('A', 11), c('K', 10)])).toBe(21);
  });

  it('returns a busted total when no aces can save the hand', () => {
    expect(calculateHandValue([c('K', 10), c('Q', 10), c('5', 5)])).toBe(25);
  });
});

describe('useBlackjack resume flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getBlackjackTableInfoMock.mockResolvedValue({
      deckCount: 2,
      cardsRemaining: 104,
      shoeNumber: 1,
      handsPlayed: 0,
      needsShuffle: false,
    });
    getCurrentBlackjackGameMock.mockResolvedValue(null);
  });

  it('loads table info and resumes an active game on mount', async () => {
    getCurrentBlackjackGameMock.mockResolvedValue({
      id: 'game-1',
      stake: 10,
      initialStake: 10,
      status: 'playing',
      playerHand: [{ id: 'c-1', suit: 'hearts', rank: '8', value: 8 }],
      playerHands: [
        {
          id: 'hand-1',
          cards: [{ id: 'c-1', suit: 'hearts', rank: '8', value: 8 }],
          stake: 10,
          payout: 0,
          status: 'playing',
          doubleDownUsed: false,
          isSplitAces: false,
        },
      ],
      activeHandIndex: 0,
      dealerHand: [{ id: 'c-2', suit: 'clubs', rank: 'K', value: 10 }],
      payout: 0,
      doubleDownUsed: false,
      deckCount: 2,
      cardsRemaining: 99,
      shoeNumber: 2,
      dealerHiddenCount: 1,
      createdAt: '2026-05-03T12:00:00.000Z',
    });

    const refreshProfile = vi.fn();
    const { result } = renderHook(() =>
      useBlackjack({ userId: 'user-1', refreshProfile }),
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(getBlackjackTableInfoMock).toHaveBeenCalledWith({
      userId: 'user-1',
    });
    expect(getCurrentBlackjackGameMock).toHaveBeenCalledWith({
      userId: 'user-1',
    });
    expect(result.current.status).toBe('playing');
    expect(result.current.gameId).toBe('game-1');
    expect(result.current.tableInfo).toEqual({
      deckCount: 2,
      cardsRemaining: 99,
      shoeNumber: 2,
      handsPlayed: 0,
      needsShuffle: false,
    });
  });

  it('shows betting state with table info when there is no game to resume', async () => {
    const { result } = renderHook(() =>
      useBlackjack({ userId: 'user-1', refreshProfile: vi.fn() }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.status).toBe('betting');
    expect(result.current.tableInfo).toEqual({
      deckCount: 2,
      cardsRemaining: 104,
      shoeNumber: 1,
      handsPlayed: 0,
      needsShuffle: false,
    });
  });

  it('sets an action message immediately while resolving a hit', async () => {
    getCurrentBlackjackGameMock.mockResolvedValue({
      id: 'game-1',
      stake: 10,
      initialStake: 10,
      status: 'playing',
      playerHand: [
        { id: 'c-1', suit: 'hearts', rank: '8', value: 8 },
        { id: 'c-3', suit: 'spades', rank: '2', value: 2 },
      ],
      playerHands: [
        {
          id: 'hand-1',
          cards: [
            { id: 'c-1', suit: 'hearts', rank: '8', value: 8 },
            { id: 'c-3', suit: 'spades', rank: '2', value: 2 },
          ],
          stake: 10,
          payout: 0,
          status: 'playing',
          doubleDownUsed: false,
          isSplitAces: false,
        },
      ],
      activeHandIndex: 0,
      dealerHand: [{ id: 'c-2', suit: 'clubs', rank: 'K', value: 10 }],
      payout: 0,
      doubleDownUsed: false,
      deckCount: 2,
      cardsRemaining: 99,
      shoeNumber: 2,
      dealerHiddenCount: 1,
      createdAt: '2026-05-03T12:00:00.000Z',
    });
    const nextHitState = {
      id: 'game-1',
      stake: 10,
      initialStake: 10,
      status: 'playing',
      playerHand: [
        { id: 'c-1', suit: 'hearts', rank: '8', value: 8 },
        { id: 'c-3', suit: 'spades', rank: '2', value: 2 },
        { id: 'c-4', suit: 'diamonds', rank: '5', value: 5 },
      ],
      playerHands: [],
      activeHandIndex: 0,
      dealerHand: [{ id: 'c-2', suit: 'clubs', rank: 'K', value: 10 }],
      payout: 0,
      doubleDownUsed: false,
      deckCount: 2,
      cardsRemaining: 98,
      shoeNumber: 2,
      dealerHiddenCount: 1,
      createdAt: '2026-05-03T12:00:00.000Z',
    };
    let resolveHit: (value: typeof nextHitState) => void = () => {};
    blackjackHitMock.mockReturnValue(
      new Promise((resolve) => {
        resolveHit = resolve;
      }),
    );

    const { result } = renderHook(() =>
      useBlackjack({ userId: 'user-1', refreshProfile: vi.fn() }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      void result.current.hit();
    });

    await waitFor(() => {
      expect(result.current.actionMessage).toBe('Dobieranie karty...');
    });

    await act(async () => {
      resolveHit(nextHitState);
    });

    expect(result.current.actionMessage).toBeNull();
  });
});
