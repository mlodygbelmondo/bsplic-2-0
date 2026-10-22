import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { BlackjackGameState, BlackjackTableInfo, Card } from '../api/blackjack';
import { createBlackjackGame, type BlackjackGameDeps, type BlackjackSnapshot } from './game';

const card = (id: string, rank: Card['rank'], value: number, suit: Card['suit'] = 'hearts'): Card => ({
  id,
  suit,
  rank,
  value,
});

const TABLE: BlackjackTableInfo = {
  deckCount: 2,
  cardsRemaining: 104,
  shoeNumber: 1,
  handsPlayed: 0,
  needsShuffle: false,
};

function playingGame(overrides: Partial<BlackjackGameState> = {}): BlackjackGameState {
  const cards = [card('p-1', '10', 10), card('p-2', '9', 9, 'spades')];
  return {
    id: 'game-1',
    stake: 10,
    initialStake: 10,
    status: 'playing',
    playerHand: cards,
    playerHands: [
      {
        id: 'hand-1',
        cards,
        stake: 10,
        payout: 0,
        status: 'playing',
        doubleDownUsed: false,
        isSplitAces: false,
      },
    ],
    activeHandIndex: 0,
    dealerHand: [card('d-1', '7', 7, 'clubs')],
    payout: 0,
    doubleDownUsed: false,
    deckCount: 2,
    cardsRemaining: 99,
    shoeNumber: 2,
    dealerHiddenCount: 1,
    createdAt: '2026-06-11T12:00:00.000Z',
    insuranceStatus: 'unavailable',
    insuranceStake: 0,
    insurancePayout: 0,
    ...overrides,
  };
}

/** Player 19 beats the dealer's 17 after the hole card (K) is turned. */
function wonGame(): BlackjackGameState {
  const base = playingGame();
  return {
    ...base,
    status: 'won',
    payout: 20,
    dealerHiddenCount: 0,
    dealerHand: [card('d-1', '7', 7, 'clubs'), card('d-2', 'K', 10)],
    playerHands: [{ ...base.playerHands[0], status: 'won', payout: 20 }],
  };
}

function setup({ cached }: { cached?: BlackjackSnapshot } = {}) {
  let stored = cached;
  const api = {
    getTableInfo: vi.fn().mockResolvedValue(TABLE),
    getCurrentGame: vi.fn().mockResolvedValue(null),
    placeBet: vi.fn(),
    hit: vi.fn(),
    stand: vi.fn(),
    doubleDown: vi.fn(),
    split: vi.fn(),
    takeInsurance: vi.fn(),
    declineInsurance: vi.fn(),
  };
  const deps = {
    userId: 'user-1',
    api,
    cache: {
      read: () => stored,
      write: vi.fn((snapshot: BlackjackSnapshot) => {
        stored = snapshot;
      }),
      remove: vi.fn(() => {
        stored = undefined;
      }),
    },
    refreshProfile: vi.fn().mockResolvedValue(undefined),
    sound: vi.fn(),
    haptic: vi.fn(),
    onError: vi.fn(),
    onSettled: vi.fn(),
  } satisfies BlackjackGameDeps;
  const game = createBlackjackGame(deps);
  return { game, api, deps, state: () => game.store.getState(), cached: () => stored };
}

/** Lets pending promise callbacks run. */
const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('blackjack game cached table', () => {
  const cachedTable = { ...TABLE, cardsRemaining: 90, handsPlayed: 3 };

  it('shows a cached idle table at once and holds dealing until it is fresh', async () => {
    const { game, api, state } = setup({ cached: { tableInfo: cachedTable, currentGame: null } });
    api.getTableInfo.mockResolvedValue({ ...cachedTable, cardsRemaining: 88 });

    expect(state().isLoading).toBe(false);
    expect(state().isSyncing).toBe(true);
    expect(state().tableInfo?.cardsRemaining).toBe(90);

    game.start();
    await game.startGame(10);
    expect(api.placeBet).not.toHaveBeenCalled();

    await flush();
    expect(state().isSyncing).toBe(false);
    expect(state().tableInfo?.cardsRemaining).toBe(88);
  });

  it('loads a table with a game in progress fresh', async () => {
    const { game, state } = setup({ cached: { tableInfo: cachedTable, currentGame: playingGame() } });

    expect(state().isLoading).toBe(true);
    expect(state().tableInfo).toBeNull();
    game.start();
    await flush();
    expect(state().isLoading).toBe(false);
    expect(state().status).toBe('betting');
  });
});

describe('blackjack game load and resume', () => {
  it('loads table info and resumes an active game on mount', async () => {
    const { game, api, state } = setup();
    api.getCurrentGame.mockResolvedValue(playingGame());

    game.start();
    expect(state().isLoading).toBe(true);
    await flush();

    expect(api.getTableInfo).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(api.getCurrentGame).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(state().status).toBe('playing');
    expect(state().gameId).toBe('game-1');
    expect(state().dealerHiddenCount).toBe(1);
    expect(state().tableInfo).toEqual({
      deckCount: 2,
      cardsRemaining: 99,
      shoeNumber: 2,
      handsPlayed: 0,
      needsShuffle: false,
    });
  });

  it('shows the betting state with table info when there is no game to resume', async () => {
    const { game, state } = setup();

    game.start();
    await flush();

    expect(state().status).toBe('betting');
    expect(state().tableInfo).toEqual(TABLE);
  });

  it('refreshes the table and wallet when the screen comes back', async () => {
    const { game, api, deps, state } = setup();
    game.start();
    await flush();
    api.getTableInfo.mockResolvedValue({ ...TABLE, cardsRemaining: 80, shoeNumber: 2 });

    game.setActive(false);
    expect(api.getTableInfo).toHaveBeenCalledTimes(1);
    game.setActive(true);
    await flush();

    expect(state().tableInfo?.cardsRemaining).toBe(80);
    expect(deps.refreshProfile).toHaveBeenCalledOnce();
    expect(state().isLoading).toBe(false);
  });

  it('defers a resume refresh until the hit in flight completes', async () => {
    const { game, api, state } = setup();
    api.getCurrentGame.mockResolvedValue(playingGame());
    const afterHit = playingGame({
      playerHand: [card('p-1', '2', 2), card('p-2', '3', 3), card('p-3', '5', 5)],
      playerHands: [],
      cardsRemaining: 98,
    });
    let resolveHit: (value: BlackjackGameState) => void = () => {};
    api.hit.mockReturnValue(new Promise((resolve) => (resolveHit = resolve)));
    game.start();
    await flush();

    void game.hit();
    expect(state().actionMessage).toBe('Dobieranie karty...');

    game.setActive(false);
    game.setActive(true);
    expect(api.getCurrentGame).toHaveBeenCalledTimes(1);

    api.getCurrentGame.mockResolvedValue(afterHit);
    resolveHit(afterHit);
    await flush();

    expect(api.getCurrentGame).toHaveBeenCalledTimes(2);
    expect(state().actionMessage).toBeNull();
    expect(state().playerHand).toHaveLength(3);
  });

  it('keeps a settled result on screen after a resume', async () => {
    const { game, api, state } = setup();
    api.getCurrentGame.mockResolvedValue(playingGame());
    api.stand.mockResolvedValue(wonGame());
    game.start();
    await flush();
    void game.stand();
    await vi.advanceTimersByTimeAsync(2000);
    expect(state().status).toBe('won');

    api.getCurrentGame.mockResolvedValue(null);
    api.getTableInfo.mockResolvedValue({ ...TABLE, cardsRemaining: 95 });
    game.setActive(false);
    game.setActive(true);
    await flush();

    expect(state().status).toBe('won');
    expect(state().tableInfo?.cardsRemaining).toBe(95);
  });

  it('reports load errors with the server message', async () => {
    const { game, api, deps, state } = setup();
    api.getTableInfo.mockRejectedValue(new Error('Brak dostępu do stołu'));

    game.start();
    await flush();

    expect(deps.onError).toHaveBeenCalledWith('Brak dostępu do stołu');
    expect(state().isLoading).toBe(false);
  });
});

describe('blackjack game dealer reveal', () => {
  it('stages the dealer reveal before landing a settled result', async () => {
    const { game, api, deps, state } = setup();
    api.getCurrentGame.mockResolvedValue(playingGame());
    api.stand.mockResolvedValue(wonGame());
    game.start();
    await flush();

    void game.stand();
    await flush();

    // The settled response is staged: still visually playing, hole card hidden.
    expect(state().status).toBe('playing');
    expect(state().isRevealing).toBe(true);
    expect(state().actionMessage).toBe('Krupier odkrywa karty...');
    expect(state().dealerHand).toHaveLength(1);
    expect(state().dealerHiddenCount).toBe(1);
    expect(state().playerHands[0].status).toBe('stand');
    expect(state().playerHands[0].payout).toBe(0);

    // The hole card turns after 450 ms.
    await vi.advanceTimersByTimeAsync(449);
    expect(state().dealerHand).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(state().dealerHand).toHaveLength(2);
    expect(state().dealerHiddenCount).toBe(0);
    expect(state().status).toBe('playing');
    expect(deps.sound).toHaveBeenLastCalledWith('flip');

    // The result lands 550 ms later.
    await vi.advanceTimersByTimeAsync(549);
    expect(state().status).toBe('playing');
    await vi.advanceTimersByTimeAsync(1);
    expect(state().status).toBe('won');
    expect(state().isRevealing).toBe(false);
    expect(state().playerHands[0]).toMatchObject({ status: 'won', payout: 20 });
    expect(deps.sound).toHaveBeenLastCalledWith('won');
    expect(deps.haptic).toHaveBeenLastCalledWith('won');
    expect(deps.onSettled).toHaveBeenCalledWith('won', { offscreen: false });
    expect(deps.refreshProfile).toHaveBeenCalled();
  });

  it('turns each dealer draw 650 ms apart', async () => {
    const { game, api, state } = setup();
    api.getCurrentGame.mockResolvedValue(playingGame());
    api.stand.mockResolvedValue({
      ...wonGame(),
      status: 'lost',
      dealerHand: [card('d-1', '7', 7), card('d-2', '2', 2), card('d-3', '5', 5), card('d-4', '6', 6)],
    });
    game.start();
    await flush();

    void game.stand();
    await flush();
    await vi.advanceTimersByTimeAsync(450);
    expect(state().dealerHand).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(650);
    expect(state().dealerHand).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(650);
    expect(state().dealerHand).toHaveLength(4);
    expect(state().status).toBe('playing');
    await vi.advanceTimersByTimeAsync(550);
    expect(state().status).toBe('lost');
  });

  it('waits 900 ms before turning the hole card on a freshly dealt natural', async () => {
    const { game, api, deps, state } = setup();
    const natural = [card('p-1', 'A', 11), card('p-2', 'K', 10)];
    api.placeBet.mockResolvedValue({
      ...wonGame(),
      playerHand: natural,
      playerHands: [{ ...wonGame().playerHands[0], cards: natural, payout: 25 }],
    });
    game.start();
    await flush();

    void game.startGame(10);
    await flush();
    expect(deps.haptic).toHaveBeenCalledWith('blackjack');
    await vi.advanceTimersByTimeAsync(899);
    expect(state().dealerHiddenCount).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(state().dealerHiddenCount).toBe(0);
  });

  it('lands the result at once when the screen leaves mid-reveal', async () => {
    const { game, api, deps, state } = setup();
    api.getCurrentGame.mockResolvedValue(playingGame());
    api.stand.mockResolvedValue(wonGame());
    game.start();
    await flush();
    void game.stand();
    await flush();
    expect(state().isRevealing).toBe(true);
    deps.sound.mockClear();
    deps.refreshProfile.mockClear();

    game.setActive(false);
    await flush();

    expect(state().status).toBe('won');
    expect(state().dealerHand).toHaveLength(2);
    expect(state().isRevealing).toBe(false);
    expect(state().isResolving).toBe(false);
    expect(deps.sound).not.toHaveBeenCalled();
    expect(deps.onSettled).toHaveBeenCalledWith('won', { offscreen: true });
    expect(deps.refreshProfile).toHaveBeenCalledOnce();
  });

  it('refreshes the wallet when the table unmounts mid-reveal', async () => {
    const { game, api, deps, state } = setup();
    api.getCurrentGame.mockResolvedValue(playingGame());
    api.stand.mockResolvedValue(wonGame());
    game.start();
    await flush();
    void game.stand();
    await flush();
    expect(state().isRevealing).toBe(true);
    deps.refreshProfile.mockClear();

    game.stop();

    expect(deps.refreshProfile).toHaveBeenCalledOnce();
  });

  it('skips the staged reveal with reduced motion', async () => {
    const { game, api, state } = setup();
    api.getCurrentGame.mockResolvedValue(playingGame());
    api.stand.mockResolvedValue(wonGame());
    game.setReducedMotion(true);
    game.start();
    await flush();

    void game.stand();
    await flush();

    expect(state().status).toBe('won');
  });
});

describe('blackjack game actions', () => {
  it('ignores a second tap while an action is in flight', async () => {
    const { game, api } = setup();
    api.getCurrentGame.mockResolvedValue(playingGame());
    api.hit.mockReturnValue(new Promise(() => {}));
    game.start();
    await flush();

    void game.hit();
    void game.hit();
    void game.stand();

    expect(api.hit).toHaveBeenCalledTimes(1);
    expect(api.stand).not.toHaveBeenCalled();
  });

  it('signals a bust when the acted hand goes over 21', async () => {
    const { game, api, deps } = setup();
    const start = playingGame();
    api.getCurrentGame.mockResolvedValue(start);
    const bustCards = [...start.playerHands[0].cards, card('p-3', '8', 8)];
    api.hit.mockResolvedValue({
      ...start,
      playerHand: bustCards,
      playerHands: [{ ...start.playerHands[0], cards: bustCards, status: 'busted' }, start.playerHands[0]],
    });
    game.start();
    await flush();

    await game.hit();

    expect(deps.haptic).toHaveBeenCalledWith('bust');
  });

  it('pauses actions for an insurance offer and resolves the choice through the server', async () => {
    const { game, api, deps, state } = setup();
    const offer = playingGame({
      id: 'game-insurance',
      status: 'insurance',
      dealerHand: [card('d-1', 'A', 11, 'spades')],
      insuranceStatus: 'offered',
      insuranceStake: 5,
    });
    api.getCurrentGame.mockResolvedValue(offer);
    api.takeInsurance.mockResolvedValue({ ...offer, status: 'playing', stake: 15, insuranceStatus: 'lost' });
    game.start();
    await flush();

    expect(state().status).toBe('insurance');
    await game.hit();
    expect(api.hit).not.toHaveBeenCalled();

    await game.takeInsurance();

    expect(api.takeInsurance).toHaveBeenCalledWith({ gameId: 'game-insurance', userId: 'user-1' });
    expect(deps.sound).toHaveBeenCalledWith('chip');
    expect(state().status).toBe('playing');
    expect(state().insuranceStatus).toBe('lost');
    expect(deps.refreshProfile).toHaveBeenCalled();
  });

  it('shows the server error and unlocks the table after a failed action', async () => {
    const { game, api, deps, state } = setup();
    api.getCurrentGame.mockResolvedValue(playingGame());
    api.split.mockRejectedValue(new Error('Saldo jest za małe na split'));
    game.start();
    await flush();

    await game.split();

    expect(deps.onError).toHaveBeenCalledWith('Saldo jest za małe na split');
    expect(state().isResolving).toBe(false);
    expect(state().actionMessage).toBeNull();
  });
});

describe('blackjack game cache on unmount', () => {
  it('drops a game in progress so the next visit loads it fresh', async () => {
    const { game, api, cached } = setup();
    api.getCurrentGame.mockResolvedValue(playingGame());
    game.start();
    await flush();

    game.stop();

    expect(cached()).toBeUndefined();
  });

  it('keeps an idle table for an instant next visit', async () => {
    const { game, cached } = setup();
    game.start();
    await flush();

    game.stop();

    expect(cached()).toEqual({ tableInfo: TABLE, currentGame: null });
  });
});
