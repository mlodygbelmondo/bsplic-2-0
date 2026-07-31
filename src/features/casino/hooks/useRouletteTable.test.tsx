import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RouletteTableSnapshot } from '@/features/casino/api/roulette';

import { useRouletteTable } from './useRouletteTable';

const advanceRouletteRoundIfDueMock = vi.fn();
const getCurrentRouletteRoundMock = vi.fn();
const getMyCurrentRouletteBetsMock = vi.fn();
const getRecentRouletteSpinsMock = vi.fn();
const getRecentRouletteWinsMock = vi.fn();
const getRouletteRoundParticipantsMock = vi.fn();
const getRouletteTableSnapshotMock = vi.fn();
const placeRouletteBetMock = vi.fn();
const subscribeToRouletteRoundsMock = vi.fn();

vi.mock('@/features/casino/api/roulette', () => ({
  advanceRouletteRoundIfDue: (...args: unknown[]) =>
    advanceRouletteRoundIfDueMock(...args),
  getCurrentRouletteRound: (...args: unknown[]) =>
    getCurrentRouletteRoundMock(...args),
  getMyCurrentRouletteBets: (...args: unknown[]) =>
    getMyCurrentRouletteBetsMock(...args),
  getRecentRouletteSpins: (...args: unknown[]) =>
    getRecentRouletteSpinsMock(...args),
  getRecentRouletteWins: (...args: unknown[]) =>
    getRecentRouletteWinsMock(...args),
  getRouletteRoundParticipants: (...args: unknown[]) =>
    getRouletteRoundParticipantsMock(...args),
  getRouletteTableSnapshot: (...args: unknown[]) =>
    getRouletteTableSnapshotMock(...args),
  placeRouletteBet: (...args: unknown[]) => placeRouletteBetMock(...args),
  subscribeToRouletteRounds: (...args: unknown[]) =>
    subscribeToRouletteRoundsMock(...args),
}));

type RouletteTableValue = ReturnType<typeof useRouletteTable>;

function RouletteTableProbe({
  refreshProfile = vi.fn(),
  onTable,
}: {
  refreshProfile?: () => Promise<void>;
  onTable?: (table: RouletteTableValue) => void;
}) {
  const table = useRouletteTable({
    userId: 'user-1',
    username: 'LuckyFox',
    avatarUrl: 'avatar.webp',
    refreshProfile,
  });
  onTable?.(table);
  return null;
}

describe('useRouletteTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentRouletteRoundMock.mockResolvedValue(null);
    getMyCurrentRouletteBetsMock.mockResolvedValue([]);
    getRecentRouletteSpinsMock.mockResolvedValue([]);
    getRecentRouletteWinsMock.mockResolvedValue([]);
    getRouletteRoundParticipantsMock.mockResolvedValue([]);
    getRouletteTableSnapshotMock.mockResolvedValue({
      currentRound: null,
      recentSpins: [],
      recentWins: [],
      activeBets: [],
      roundParticipants: [],
    });
    placeRouletteBetMock.mockResolvedValue({
      id: 'bet-1',
      round_id: 'round-1',
    });
    subscribeToRouletteRoundsMock.mockReturnValue(vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads the roulette table through one snapshot RPC without browser-side advancement', async () => {
    getRouletteTableSnapshotMock.mockResolvedValue({
      currentRound: {
        id: 'round-1',
        phase: 'waiting',
        round_number: 12,
        betting_closes_at: new Date(Date.now() + 10_000).toISOString(),
      },
      recentSpins: [],
      recentWins: [],
      activeBets: [{ id: 'bet-1', round_id: 'round-1' }],
      roundParticipants: [{ user_id: 'user-1', total_stake: 10 }],
    });

    render(<RouletteTableProbe />);

    await waitFor(() => {
      expect(getRouletteTableSnapshotMock).toHaveBeenCalledTimes(1);
    });

    expect(advanceRouletteRoundIfDueMock).not.toHaveBeenCalled();
    expect(getCurrentRouletteRoundMock).not.toHaveBeenCalled();
    expect(getRecentRouletteSpinsMock).not.toHaveBeenCalled();
    expect(getRecentRouletteWinsMock).not.toHaveBeenCalled();
    expect(getMyCurrentRouletteBetsMock).not.toHaveBeenCalled();
    expect(getRouletteRoundParticipantsMock).not.toHaveBeenCalled();
  });

  it('does not start an overlapping snapshot when realtime fires during sync', async () => {
    let onRoundChange: (() => void) | null = null;
    let resolveSnapshot: (() => void) | null = null;

    getRouletteTableSnapshotMock.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveSnapshot = resolve;
        }),
    );
    subscribeToRouletteRoundsMock.mockImplementation((callback: () => void) => {
      onRoundChange = callback;
      return vi.fn();
    });

    render(<RouletteTableProbe />);

    await waitFor(() => {
      expect(getRouletteTableSnapshotMock).toHaveBeenCalledTimes(1);
    });

    act(() => {
      onRoundChange?.();
    });

    expect(getRouletteTableSnapshotMock).toHaveBeenCalledTimes(1);
    expect(advanceRouletteRoundIfDueMock).not.toHaveBeenCalled();

    await act(async () => {
      resolveSnapshot?.();
    });
  });

  it('polls an idle table slowly so rounds started elsewhere still appear', async () => {
    vi.useFakeTimers();

    render(<RouletteTableProbe />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(getRouletteTableSnapshotMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(6_000);
      await Promise.resolve();
    });

    expect(getRouletteTableSnapshotMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(10_000);
      await Promise.resolve();
    });

    expect(getRouletteTableSnapshotMock).toHaveBeenCalledTimes(2);
    expect(advanceRouletteRoundIfDueMock).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(15_000);
      await Promise.resolve();
    });

    expect(getRouletteTableSnapshotMock).toHaveBeenCalledTimes(3);
  });

  it('keeps polling after a transient snapshot failure', async () => {
    vi.useFakeTimers();
    const round = {
      id: 'round-1',
      phase: 'waiting' as const,
      round_number: 12,
      betting_closes_at: new Date(Date.now() + 60_000).toISOString(),
    };

    getRouletteTableSnapshotMock
      .mockResolvedValueOnce({
        currentRound: round,
        recentSpins: [],
        recentWins: [],
        activeBets: [],
        roundParticipants: [],
      })
      .mockRejectedValueOnce(new Error('Temporary snapshot failure'))
      .mockResolvedValue({
        currentRound: round,
        recentSpins: [],
        recentWins: [],
        activeBets: [],
        roundParticipants: [],
      });

    render(<RouletteTableProbe />);

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(5_000);
      await Promise.resolve();
    });

    expect(getRouletteTableSnapshotMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      vi.advanceTimersByTime(5_000);
      await Promise.resolve();
    });

    expect(getRouletteTableSnapshotMock).toHaveBeenCalledTimes(3);
  });

  it('syncs immediately when the app returns to the foreground', async () => {
    vi.useFakeTimers();
    advanceRouletteRoundIfDueMock.mockResolvedValue(undefined);
    getRouletteTableSnapshotMock.mockResolvedValue({
      currentRound: {
        id: 'round-1',
        phase: 'waiting',
        round_number: 12,
        betting_closes_at: new Date(Date.now() - 1_000).toISOString(),
      },
      recentSpins: [],
      recentWins: [],
      activeBets: [],
      roundParticipants: [],
    });

    render(<RouletteTableProbe />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(getRouletteTableSnapshotMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();
    });

    expect(getRouletteTableSnapshotMock).toHaveBeenCalledTimes(2);
    expect(advanceRouletteRoundIfDueMock).toHaveBeenCalledTimes(1);
  });

  it('pauses polling while hidden and resumes with one immediate sync', async () => {
    vi.useFakeTimers();
    const visibilityStateSpy = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('visible');

    try {
      const { unmount } = render(<RouletteTableProbe />);

      await act(async () => {
        await Promise.resolve();
      });

      expect(getRouletteTableSnapshotMock).toHaveBeenCalledTimes(1);

      visibilityStateSpy.mockReturnValue('hidden');
      document.dispatchEvent(new Event('visibilitychange'));

      await act(async () => {
        vi.advanceTimersByTime(30_000);
        await Promise.resolve();
      });

      expect(getRouletteTableSnapshotMock).toHaveBeenCalledTimes(1);

      visibilityStateSpy.mockReturnValue('visible');
      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
        await Promise.resolve();
      });

      expect(getRouletteTableSnapshotMock).toHaveBeenCalledTimes(2);

      await act(async () => {
        vi.advanceTimersByTime(15_000);
        await Promise.resolve();
      });

      expect(getRouletteTableSnapshotMock).toHaveBeenCalledTimes(3);

      unmount();
      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new Event('visibilitychange'));
      expect(getRouletteTableSnapshotMock).toHaveBeenCalledTimes(3);
    } finally {
      visibilityStateSpy.mockRestore();
    }
  });

  it('deduplicates advance calls from a burst of resume events', async () => {
    vi.useFakeTimers();
    advanceRouletteRoundIfDueMock.mockResolvedValue(undefined);
    const waitingRound = {
      id: 'round-1',
      phase: 'waiting',
      round_number: 12,
      betting_closes_at: new Date(Date.now() - 1_000).toISOString(),
    };
    getRouletteTableSnapshotMock.mockResolvedValue({
      currentRound: waitingRound,
      recentSpins: [],
      recentWins: [],
      activeBets: [],
      roundParticipants: [],
    });

    render(<RouletteTableProbe />);

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new Event('pageshow'));
      await Promise.resolve();
    });

    expect(advanceRouletteRoundIfDueMock).toHaveBeenCalledTimes(1);
  });

  it('queues a fresh sync when resume happens during an older sync', async () => {
    vi.useFakeTimers();
    let resolvePendingSnapshot:
      | ((snapshot: RouletteTableSnapshot) => void)
      | null = null;
    const visibilityStateSpy = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('visible');
    const waitingRound = {
        id: 'round-1',
        phase: 'waiting',
        round_number: 12,
        betting_closes_at: new Date(Date.now() + 60_000).toISOString(),
    };

    getRouletteTableSnapshotMock
      .mockResolvedValueOnce({
        currentRound: waitingRound,
        recentSpins: [],
        recentWins: [],
        activeBets: [],
        roundParticipants: [],
      })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolvePendingSnapshot = resolve;
          }),
      )
      .mockResolvedValue({
        currentRound: waitingRound,
        recentSpins: [],
        recentWins: [],
        activeBets: [],
        roundParticipants: [],
      });

    try {
      render(<RouletteTableProbe />);

      await act(async () => {
        await Promise.resolve();
      });

      act(() => {
        window.dispatchEvent(new Event('focus'));
      });
      expect(getRouletteTableSnapshotMock).toHaveBeenCalledTimes(2);

      visibilityStateSpy.mockReturnValue('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
      visibilityStateSpy.mockReturnValue('visible');
      document.dispatchEvent(new Event('visibilitychange'));

      await act(async () => {
        resolvePendingSnapshot?.({
          currentRound: null,
          recentSpins: [],
          recentWins: [],
          activeBets: [],
          roundParticipants: [],
        });
        await Promise.resolve();
      });

      expect(getRouletteTableSnapshotMock).toHaveBeenCalledTimes(3);
    } finally {
      visibilityStateSpy.mockRestore();
    }
  });

  it('reads a fresh snapshot when advance overlaps an older sync', async () => {
    vi.useFakeTimers();
    let onRoundChange: (() => void) | null = null;
    let resolvePendingSnapshot:
      | ((snapshot: RouletteTableSnapshot) => void)
      | null = null;
    const nowIso = new Date(Date.now()).toISOString();
    const overdueRound = {
      id: 'round-1',
      table_key: 'main',
      phase: 'waiting' as const,
      round_number: 12,
      betting_opens_at: nowIso,
      betting_closes_at: new Date(Date.now() - 1_000).toISOString(),
      spin_started_at: null,
      settled_at: null,
      winning_number: null,
      winning_color: null,
      created_at: nowIso,
    };

    advanceRouletteRoundIfDueMock.mockResolvedValue(undefined);
    subscribeToRouletteRoundsMock.mockImplementation((callback: () => void) => {
      onRoundChange = callback;
      return vi.fn();
    });
    getRouletteTableSnapshotMock
      .mockResolvedValueOnce({
        currentRound: overdueRound,
        recentSpins: [],
        recentWins: [],
        activeBets: [],
        roundParticipants: [],
      })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolvePendingSnapshot = resolve;
          }),
      )
      .mockResolvedValueOnce({
        currentRound: {
          ...overdueRound,
          phase: 'spinning',
          spin_started_at: new Date(Date.now()).toISOString(),
        },
        recentSpins: [],
        recentWins: [],
        activeBets: [],
        roundParticipants: [],
      });

    render(<RouletteTableProbe />);

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      onRoundChange?.();
    });
    expect(getRouletteTableSnapshotMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();
    });

    await act(async () => {
      resolvePendingSnapshot?.({
        currentRound: overdueRound,
        recentSpins: [],
        recentWins: [],
        activeBets: [],
        roundParticipants: [],
      });
      await Promise.resolve();
    });

    expect(advanceRouletteRoundIfDueMock).toHaveBeenCalledTimes(1);
    expect(getRouletteTableSnapshotMock).toHaveBeenCalledTimes(3);
  });

  it('retries and rate-limits logging after advance fails', async () => {
    vi.useFakeTimers();
    const consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const overdueRound = {
      id: 'round-1',
      phase: 'waiting',
      round_number: 12,
      betting_closes_at: new Date(Date.now() - 1_000).toISOString(),
    };

    advanceRouletteRoundIfDueMock.mockRejectedValue(
      new Error('Temporary advance failure'),
    );
    getRouletteTableSnapshotMock.mockResolvedValue({
      currentRound: overdueRound,
      recentSpins: [],
      recentWins: [],
      activeBets: [],
      roundParticipants: [],
    });

    try {
      render(<RouletteTableProbe />);

      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        vi.advanceTimersByTime(5_000);
        await Promise.resolve();
      });

      await act(async () => {
        vi.advanceTimersByTime(5_000);
        await Promise.resolve();
      });

      expect(advanceRouletteRoundIfDueMock).toHaveBeenCalledTimes(2);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    } finally {
      consoleWarnSpy.mockRestore();
    }
  });

  it('advances an overdue round before syncing instead of waiting for cron', async () => {
    vi.useFakeTimers();
    advanceRouletteRoundIfDueMock.mockResolvedValue(undefined);
    getRouletteTableSnapshotMock.mockResolvedValue({
      currentRound: {
        id: 'round-1',
        phase: 'waiting',
        round_number: 12,
        betting_closes_at: new Date(Date.now() + 2_000).toISOString(),
      },
      recentSpins: [],
      recentWins: [],
      activeBets: [],
      roundParticipants: [],
    });

    render(<RouletteTableProbe />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(getRouletteTableSnapshotMock).toHaveBeenCalledTimes(1);
    expect(advanceRouletteRoundIfDueMock).not.toHaveBeenCalled();

    // The sync timer fires just past betting_closes_at; the round is now
    // overdue, so the client nudges it forward before reading the snapshot.
    await act(async () => {
      vi.advanceTimersByTime(2_500);
      await Promise.resolve();
    });

    expect(advanceRouletteRoundIfDueMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      await Promise.resolve();
    });
    expect(getRouletteTableSnapshotMock).toHaveBeenCalledTimes(2);
  });

  it('does not refresh the viewer profile for another player settled win', async () => {
    const refreshProfile = vi.fn().mockResolvedValue(undefined);
    getRouletteTableSnapshotMock.mockResolvedValue({
      currentRound: null,
      recentSpins: [{ id: 'round-1', phase: 'settled', round_number: 1 }],
      recentWins: [
        { id: 'win-1', round_id: 'round-1', user_id: 'user-2', payout: 50 },
      ],
      activeBets: [],
      roundParticipants: [],
    });

    render(<RouletteTableProbe refreshProfile={refreshProfile} />);

    await waitFor(() => {
      expect(getRouletteTableSnapshotMock).toHaveBeenCalled();
    });

    expect(refreshProfile).not.toHaveBeenCalled();
  });

  it('refreshes the viewer profile for their settled win once', async () => {
    const refreshProfile = vi.fn().mockResolvedValue(undefined);
    getRouletteTableSnapshotMock.mockResolvedValue({
      currentRound: null,
      recentSpins: [],
      recentWins: [
        { id: 'win-1', round_id: 'round-1', user_id: 'user-1', payout: 50 },
      ],
      activeBets: [],
      roundParticipants: [],
    });

    render(<RouletteTableProbe refreshProfile={refreshProfile} />);

    await waitFor(() => {
      expect(refreshProfile).toHaveBeenCalledTimes(1);
    });
  });

  it('places a bet into the current shared round and syncs the snapshot', async () => {
    let table: RouletteTableValue | null = null;
    const refreshProfile = vi.fn().mockResolvedValue(undefined);
    const acceptedBet = {
      id: 'bet-1',
      round_id: 'round-1',
      user_id: 'user-1',
      bet_type: 'color',
      bet_value: 'red',
      stake: 25,
      payout: 0,
      is_win: null,
      created_at: '2026-06-11T10:00:01.000Z',
      settled_at: null,
    };
    const round = {
      id: 'round-1',
      phase: 'waiting',
      round_number: 12,
      betting_closes_at: new Date(Date.now() + 10_000).toISOString(),
    };

    getRouletteTableSnapshotMock
      .mockResolvedValueOnce({
        currentRound: {
          ...round,
        },
        recentSpins: [],
        recentWins: [],
        activeBets: [],
        roundParticipants: [],
      })
      .mockResolvedValueOnce({
        currentRound: {
          ...round,
        },
        recentSpins: [],
        recentWins: [],
        activeBets: [acceptedBet],
        roundParticipants: [
          {
            user_id: 'user-1',
            username: 'LuckyFox',
            avatar_url: 'avatar.webp',
            total_stake: 25,
            bet_count: 1,
            bets: [{ bet_type: 'color', bet_value: 'red', stake: 25 }],
          },
        ],
      });
    placeRouletteBetMock.mockResolvedValue(acceptedBet);

    render(
      <RouletteTableProbe
        refreshProfile={refreshProfile}
        onTable={(next) => {
          table = next;
        }}
      />,
    );

    await waitFor(() => {
      expect(table?.currentRound?.id).toBe('round-1');
    });

    await act(async () => {
      await table?.placeBet({
        betType: 'color',
        betValue: 'red',
        stake: 25,
      });
    });

    expect(placeRouletteBetMock).toHaveBeenCalledWith({
      userId: 'user-1',
      betType: 'color',
      betValue: 'red',
      stake: 25,
    });
    expect(getRouletteTableSnapshotMock).toHaveBeenCalledTimes(2);
    expect(table?.roundParticipants).toEqual([
      {
        user_id: 'user-1',
        username: 'LuckyFox',
        avatar_url: 'avatar.webp',
        total_stake: 25,
        bet_count: 1,
        bets: [{ bet_type: 'color', bet_value: 'red', stake: 25 }],
      },
    ]);
  });

  it('lets the first bet create a shared round from an idle table', async () => {
    let table: RouletteTableValue | null = null;
    const refreshProfile = vi.fn().mockResolvedValue(undefined);

    getRouletteTableSnapshotMock
      .mockResolvedValueOnce({
        currentRound: null,
        recentSpins: [],
        recentWins: [],
        activeBets: [],
        roundParticipants: [],
      })
      .mockResolvedValueOnce({
        currentRound: {
          id: 'round-1',
          phase: 'waiting',
          round_number: 12,
          betting_closes_at: new Date(Date.now() + 10_000).toISOString(),
        },
        recentSpins: [],
        recentWins: [],
        activeBets: [{ id: 'bet-1', round_id: 'round-1' }],
        roundParticipants: [{ user_id: 'user-1', total_stake: 25 }],
      });
    placeRouletteBetMock.mockResolvedValue({
      id: 'bet-1',
      round_id: 'round-1',
      user_id: 'user-1',
      bet_type: 'color',
      bet_value: 'red',
      stake: 25,
      payout: 0,
      is_win: null,
      created_at: '2026-06-11T10:00:01.000Z',
      settled_at: null,
    });

    render(
      <RouletteTableProbe
        refreshProfile={refreshProfile}
        onTable={(next) => {
          table = next;
        }}
      />,
    );

    await waitFor(() => {
      expect(table?.isLoading).toBe(false);
    });

    await act(async () => {
      await table?.placeBet({
        betType: 'color',
        betValue: 'red',
        stake: 25,
      });
    });

    expect(placeRouletteBetMock).toHaveBeenCalledWith({
      userId: 'user-1',
      betType: 'color',
      betValue: 'red',
      stake: 25,
    });
    expect(table?.currentRound?.id).toBe('round-1');
  });

  it('fetches a fresh snapshot after a bet overlaps an older sync', async () => {
    vi.useFakeTimers();
    let table: RouletteTableValue | null = null;
    let resolvePendingSnapshot:
      | ((snapshot: RouletteTableSnapshot) => void)
      | null = null;
    const refreshProfile = vi.fn().mockResolvedValue(undefined);
    const acceptedBet = {
      id: 'bet-1',
      round_id: 'round-1',
      user_id: 'user-1',
      bet_type: 'color',
      bet_value: 'red',
      stake: 25,
      payout: 0,
      is_win: null,
      created_at: '2026-06-11T10:00:01.000Z',
      settled_at: null,
    };
    const activeRound = {
      id: 'round-1',
      phase: 'waiting',
      round_number: 12,
      betting_closes_at: new Date(Date.now() + 15_000).toISOString(),
    };

    getRouletteTableSnapshotMock
      .mockResolvedValueOnce({
        currentRound: null,
        recentSpins: [],
        recentWins: [],
        activeBets: [],
        roundParticipants: [],
      })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolvePendingSnapshot = resolve;
          }),
      )
      .mockResolvedValueOnce({
        currentRound: activeRound,
        recentSpins: [],
        recentWins: [],
        activeBets: [acceptedBet],
        roundParticipants: [],
      });
    placeRouletteBetMock.mockResolvedValue(acceptedBet);

    render(
      <RouletteTableProbe
        refreshProfile={refreshProfile}
        onTable={(next) => {
          table = next;
        }}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(15_000);
      await Promise.resolve();
    });

    expect(getRouletteTableSnapshotMock).toHaveBeenCalledTimes(2);

    let placeBetPromise: Promise<unknown> | undefined;
    await act(async () => {
      placeBetPromise = table?.placeBet({
        betType: 'color',
        betValue: 'red',
        stake: 25,
      });
      await Promise.resolve();
    });

    await act(async () => {
      resolvePendingSnapshot?.({
        currentRound: null,
        recentSpins: [],
        recentWins: [],
        activeBets: [],
        roundParticipants: [],
      });
      await placeBetPromise;
    });

    expect(getRouletteTableSnapshotMock).toHaveBeenCalledTimes(3);
    expect(table?.currentRound?.id).toBe('round-1');
  });
});
