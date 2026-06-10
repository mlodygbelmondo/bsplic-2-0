import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  advanceRouletteRoundIfDue: (...args: unknown[]) => advanceRouletteRoundIfDueMock(...args),
  getCurrentRouletteRound: (...args: unknown[]) => getCurrentRouletteRoundMock(...args),
  getMyCurrentRouletteBets: (...args: unknown[]) => getMyCurrentRouletteBetsMock(...args),
  getRecentRouletteSpins: (...args: unknown[]) => getRecentRouletteSpinsMock(...args),
  getRecentRouletteWins: (...args: unknown[]) => getRecentRouletteWinsMock(...args),
  getRouletteRoundParticipants: (...args: unknown[]) => getRouletteRoundParticipantsMock(...args),
  getRouletteTableSnapshot: (...args: unknown[]) => getRouletteTableSnapshotMock(...args),
  placeRouletteBet: (...args: unknown[]) => placeRouletteBetMock(...args),
  subscribeToRouletteRounds: (...args: unknown[]) => subscribeToRouletteRoundsMock(...args),
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
    placeRouletteBetMock.mockResolvedValue({ id: 'bet-1', round_id: 'round-1' });
    subscribeToRouletteRoundsMock.mockReturnValue(vi.fn());
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
      () => new Promise<void>((resolve) => {
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

  it('does not refresh the viewer profile for another player settled win', async () => {
    const refreshProfile = vi.fn().mockResolvedValue(undefined);
    getRouletteTableSnapshotMock.mockResolvedValue({
      currentRound: null,
      recentSpins: [{ id: 'round-1', phase: 'settled', round_number: 1 }],
      recentWins: [{ id: 'win-1', round_id: 'round-1', user_id: 'user-2', payout: 50 }],
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
      recentWins: [{ id: 'win-1', round_id: 'round-1', user_id: 'user-1', payout: 50 }],
      activeBets: [],
      roundParticipants: [],
    });

    render(<RouletteTableProbe refreshProfile={refreshProfile} />);

    await waitFor(() => {
      expect(refreshProfile).toHaveBeenCalledTimes(1);
    });
  });

  it('adds an accepted local bet to the participant list without another snapshot read', async () => {
    let table: RouletteTableValue | null = null;
    const refreshProfile = vi.fn().mockResolvedValue(undefined);
    getRouletteTableSnapshotMock.mockResolvedValue({
      currentRound: {
        id: 'round-1',
        phase: 'waiting',
        round_number: 12,
        betting_closes_at: new Date(Date.now() + 10_000).toISOString(),
      },
      recentSpins: [],
      recentWins: [],
      activeBets: [],
      roundParticipants: [],
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

    render(<RouletteTableProbe refreshProfile={refreshProfile} onTable={(next) => {
      table = next;
    }} />);

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

    expect(getRouletteTableSnapshotMock).toHaveBeenCalledTimes(1);
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
});
