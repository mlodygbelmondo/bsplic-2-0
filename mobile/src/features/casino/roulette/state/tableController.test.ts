import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand';

import type { RouletteBetRecord, RouletteRecentWin, RouletteTableRound } from '@/types/database';

import type { RouletteTableSnapshot } from '../api/roulette';
import { createRouletteTableController, type RouletteTableApi } from './tableController';
import { createInitialTableState, type RouletteTableState } from './tableStore';

const T0 = new Date('2026-06-11T10:00:00.000Z').getTime();

function round(overrides: Partial<RouletteTableRound> = {}): RouletteTableRound {
  return {
    id: 'round-1',
    table_key: 'main',
    round_number: 12,
    phase: 'waiting',
    betting_opens_at: new Date(T0).toISOString(),
    betting_closes_at: new Date(T0 + 60_000).toISOString(),
    spin_started_at: null,
    settled_at: null,
    winning_number: null,
    winning_color: null,
    created_at: new Date(T0).toISOString(),
    ...overrides,
  };
}

function snapshot(overrides: Partial<RouletteTableSnapshot> = {}): RouletteTableSnapshot {
  return { currentRound: null, recentSpins: [], recentWins: [], activeBets: [], roundParticipants: [], ...overrides };
}

function win(overrides: Partial<RouletteRecentWin> = {}): RouletteRecentWin {
  return {
    id: 'win-1',
    round_id: 'round-0',
    user_id: 'user-1',
    username: 'LuckyFox',
    avatar_url: null,
    bet_type: 'color',
    bet_value: 'red',
    stake: 20,
    payout: 40,
    is_win: true,
    created_at: new Date(T0).toISOString(),
    settled_at: new Date(T0).toISOString(),
    round_number: 11,
    ...overrides,
  };
}

const acceptedBet: RouletteBetRecord = {
  id: 'bet-1',
  round_id: 'round-1',
  user_id: 'user-1',
  bet_type: 'color',
  bet_value: 'red',
  stake: 25,
  payout: 0,
  is_win: null,
  created_at: new Date(T0).toISOString(),
  settled_at: null,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function setup(overrides: Partial<RouletteTableApi> = {}) {
  const store = createStore<RouletteTableState>(() => createInitialTableState());
  const api = {
    getSnapshot: vi.fn<RouletteTableApi['getSnapshot']>().mockResolvedValue(snapshot()),
    placeBet: vi.fn<RouletteTableApi['placeBet']>().mockResolvedValue(acceptedBet),
    advance: vi.fn<RouletteTableApi['advance']>().mockResolvedValue(undefined),
    ...overrides,
  };
  const refreshProfile = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const onBetAccepted = vi.fn();
  const warn = vi.fn();
  const controller = createRouletteTableController({
    store,
    api,
    identity: () => ({ userId: 'user-1', username: 'LuckyFox', avatarUrl: 'avatar.webp' }),
    refreshProfile,
    onBetAccepted,
    warn,
  });
  return { store, api, controller, refreshProfile, onBetAccepted, warn };
}

const flush = () => vi.advanceTimersByTimeAsync(0);

describe('roulette table controller', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads the table through one snapshot when the screen becomes active', async () => {
    const { api, store, controller } = setup({
      getSnapshot: vi.fn().mockResolvedValue(snapshot({ currentRound: round() })),
    });
    expect(store.getState().isLoading).toBe(true);

    controller.setActive(true);
    await flush();

    expect(api.getSnapshot).toHaveBeenCalledTimes(1);
    expect(api.advance).not.toHaveBeenCalled();
    expect(store.getState()).toMatchObject({ isLoading: false, currentRound: { id: 'round-1' } });
  });

  it('uses the prefetched snapshot only for the first read', async () => {
    const getInitialSnapshot = vi.fn().mockResolvedValue(snapshot());
    const { api, controller } = setup({ getInitialSnapshot });

    controller.setActive(true);
    await flush();
    await controller.syncSnapshot();

    expect(getInitialSnapshot).toHaveBeenCalledTimes(1);
    expect(api.getSnapshot).toHaveBeenCalledTimes(1);
  });

  it('does not start an overlapping snapshot when realtime fires during a sync', async () => {
    const pending = deferred<RouletteTableSnapshot>();
    const { api, controller } = setup({ getSnapshot: vi.fn().mockReturnValueOnce(pending.promise) });

    controller.setActive(true);
    void controller.syncSnapshot();
    void controller.syncSnapshot();

    expect(api.getSnapshot).toHaveBeenCalledTimes(1);
    pending.resolve(snapshot());
    await flush();
  });

  it('polls an idle table every 15 seconds so rounds started elsewhere appear', async () => {
    const { api, controller } = setup();

    controller.setActive(true);
    await flush();
    expect(api.getSnapshot).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(14_000);
    expect(api.getSnapshot).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(api.getSnapshot).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(15_000);
    expect(api.getSnapshot).toHaveBeenCalledTimes(3);
    expect(api.advance).not.toHaveBeenCalled();
  });

  it('keeps polling after a transient failure and shows the error until the next good read', async () => {
    const live = snapshot({ currentRound: round() });
    const { api, store, controller } = setup({
      getSnapshot: vi
        .fn()
        .mockResolvedValueOnce(live)
        .mockRejectedValueOnce(new Error('Temporary snapshot failure'))
        .mockResolvedValue(live),
    });

    controller.setActive(true);
    await flush();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(api.getSnapshot).toHaveBeenCalledTimes(2);
    expect(store.getState().tableMessage).toBe('Temporary snapshot failure');

    await vi.advanceTimersByTimeAsync(5_000);
    expect(api.getSnapshot).toHaveBeenCalledTimes(3);
    expect(store.getState().tableMessage).toBeNull();
  });

  it('pauses polling while inactive and resumes with one immediate sync', async () => {
    const { api, controller } = setup();

    controller.setActive(true);
    await flush();
    controller.setActive(false);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(api.getSnapshot).toHaveBeenCalledTimes(1);

    controller.setActive(true);
    await flush();
    expect(api.getSnapshot).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(15_000);
    expect(api.getSnapshot).toHaveBeenCalledTimes(3);

    controller.dispose();
    controller.setActive(true);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(api.getSnapshot).toHaveBeenCalledTimes(3);
  });

  it('advances an overdue round on resume and then reads a fresh snapshot', async () => {
    const overdue = snapshot({ currentRound: round({ betting_closes_at: new Date(T0 - 1_000).toISOString() }) });
    const { api, controller } = setup({ getSnapshot: vi.fn().mockResolvedValue(overdue) });

    controller.setActive(true);
    await flush();
    controller.setActive(false);
    controller.setActive(true);
    await flush();

    expect(api.advance).toHaveBeenCalledTimes(1);
    expect(api.getSnapshot).toHaveBeenCalledTimes(2);
  });

  it('nudges the round forward when the countdown ends instead of waiting for cron', async () => {
    const { api, controller } = setup({
      getSnapshot: vi
        .fn()
        .mockResolvedValue(snapshot({ currentRound: round({ betting_closes_at: new Date(T0 + 2_000).toISOString() }) })),
    });

    controller.setActive(true);
    await flush();
    expect(api.advance).not.toHaveBeenCalled();

    // The poll fires 250 ms past betting_closes_at.
    await vi.advanceTimersByTimeAsync(2_250);
    expect(api.advance).toHaveBeenCalledTimes(1);
    expect(api.getSnapshot).toHaveBeenCalledTimes(2);
  });

  it('runs one advance for a burst of resumes and reruns the sync once', async () => {
    const pending = deferred<RouletteTableSnapshot>();
    const overdue = snapshot({ currentRound: round({ betting_closes_at: new Date(T0 - 1_000).toISOString() }) });
    const { api, controller } = setup({
      getSnapshot: vi.fn().mockResolvedValueOnce(overdue).mockReturnValueOnce(pending.promise).mockResolvedValue(overdue),
    });

    controller.setActive(true);
    await flush();
    for (let i = 0; i < 3; i += 1) {
      controller.setActive(false);
      controller.setActive(true);
    }
    pending.resolve(overdue);
    await flush();

    expect(api.advance).toHaveBeenCalledTimes(1);
    expect(api.getSnapshot).toHaveBeenCalledTimes(3);
  });

  it('retries a failed advance on the next poll and rate-limits the warning', async () => {
    const overdue = snapshot({ currentRound: round({ betting_closes_at: new Date(T0 - 1_000).toISOString() }) });
    const { api, controller, warn } = setup({
      getSnapshot: vi.fn().mockResolvedValue(overdue),
      advance: vi.fn().mockRejectedValue(new Error('Temporary advance failure')),
    });

    controller.setActive(true);
    await flush();
    await vi.advanceTimersByTimeAsync(5_000);
    await vi.advanceTimersByTimeAsync(5_000);

    expect(api.advance).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('refreshes the profile once for the viewer settled win and never for other players', async () => {
    const { api, controller, refreshProfile } = setup({
      getSnapshot: vi
        .fn()
        .mockResolvedValueOnce(snapshot({ recentWins: [win({ user_id: 'user-2' })] }))
        .mockResolvedValue(snapshot({ recentWins: [win()] })),
    });

    controller.setActive(true);
    await flush();
    expect(refreshProfile).not.toHaveBeenCalled();

    await controller.syncSnapshot();
    await controller.syncSnapshot();
    expect(api.getSnapshot).toHaveBeenCalledTimes(3);
    expect(refreshProfile).toHaveBeenCalledTimes(1);
  });

  it('places a bet into the shared round, shows it at once and reads a fresh snapshot', async () => {
    const { api, store, controller, refreshProfile, onBetAccepted } = setup({
      getSnapshot: vi
        .fn()
        .mockResolvedValueOnce(snapshot({ currentRound: round() }))
        .mockResolvedValue(snapshot({ currentRound: round(), activeBets: [acceptedBet] })),
    });

    controller.setActive(true);
    await flush();
    const placing = controller.placeBet({ betType: 'color', betValue: 'red', stake: 25 });
    expect(store.getState().isPlacingBet).toBe(true);
    await placing;

    expect(api.placeBet).toHaveBeenCalledWith({ userId: 'user-1', betType: 'color', betValue: 'red', stake: 25 });
    expect(onBetAccepted).toHaveBeenCalledWith(acceptedBet);
    expect(refreshProfile).toHaveBeenCalledTimes(1);
    expect(api.getSnapshot).toHaveBeenCalledTimes(2);
    expect(store.getState()).toMatchObject({ isPlacingBet: false, activeBets: [{ id: 'bet-1' }] });
  });

  it('adds the accepted bet and the player to the round before the snapshot returns', async () => {
    const pending = deferred<RouletteTableSnapshot>();
    const { store, controller } = setup({
      getSnapshot: vi.fn().mockResolvedValueOnce(snapshot({ currentRound: round() })).mockReturnValue(pending.promise),
    });

    controller.setActive(true);
    await flush();
    void controller.placeBet({ betType: 'color', betValue: 'red', stake: 25 });
    await flush();

    expect(store.getState().activeBets).toEqual([acceptedBet]);
    expect(store.getState().roundParticipants).toEqual([
      {
        user_id: 'user-1',
        username: 'LuckyFox',
        avatar_url: 'avatar.webp',
        total_stake: 25,
        bet_count: 1,
        bets: [{ bet_type: 'color', bet_value: 'red', stake: 25 }],
      },
    ]);
    pending.resolve(snapshot());
    await flush();
  });

  it('follows a snapshot that started before a bet with one fresh read', async () => {
    const pending = deferred<RouletteTableSnapshot>();
    const { api, controller } = setup({
      getSnapshot: vi
        .fn()
        .mockResolvedValueOnce(snapshot({ currentRound: round() }))
        .mockReturnValueOnce(pending.promise)
        .mockResolvedValue(snapshot({ currentRound: round(), activeBets: [acceptedBet] })),
    });

    controller.setActive(true);
    await flush();
    void controller.syncSnapshot();
    const placing = controller.placeBet({ betType: 'color', betValue: 'red', stake: 25 });
    await flush();
    pending.resolve(snapshot({ currentRound: round() }));
    await placing;

    expect(api.getSnapshot).toHaveBeenCalledTimes(3);
  });

  it('keeps unchanged data by reference so subscribers skip a render', async () => {
    const { store, controller } = setup({
      getSnapshot: vi.fn().mockImplementation(async () => snapshot({ currentRound: round(), recentWins: [win()] })),
    });

    controller.setActive(true);
    await flush();
    const first = store.getState();
    await controller.syncSnapshot();

    expect(store.getState().currentRound).toBe(first.currentRound);
    expect(store.getState().recentWins).toBe(first.recentWins);
  });

  it('stops writing to the store after dispose', async () => {
    const pending = deferred<RouletteTableSnapshot>();
    const { store, controller } = setup({ getSnapshot: vi.fn().mockReturnValueOnce(pending.promise) });

    controller.setActive(true);
    controller.dispose();
    pending.resolve(snapshot({ currentRound: round() }));
    await flush();

    expect(store.getState()).toMatchObject({ currentRound: null, isLoading: true });
  });
});
