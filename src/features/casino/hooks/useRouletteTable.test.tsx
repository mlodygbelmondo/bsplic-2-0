import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useRouletteTable } from './useRouletteTable';

const advanceRouletteRoundIfDueMock = vi.fn();
const getCurrentRouletteRoundMock = vi.fn();
const getMyCurrentRouletteBetsMock = vi.fn();
const getRecentRouletteSpinsMock = vi.fn();
const getRecentRouletteWinsMock = vi.fn();
const getRouletteRoundParticipantsMock = vi.fn();
const placeRouletteBetMock = vi.fn();
const subscribeToRouletteRoundsMock = vi.fn();

vi.mock('@/features/casino/api/roulette', () => ({
  advanceRouletteRoundIfDue: (...args: unknown[]) => advanceRouletteRoundIfDueMock(...args),
  getCurrentRouletteRound: (...args: unknown[]) => getCurrentRouletteRoundMock(...args),
  getMyCurrentRouletteBets: (...args: unknown[]) => getMyCurrentRouletteBetsMock(...args),
  getRecentRouletteSpins: (...args: unknown[]) => getRecentRouletteSpinsMock(...args),
  getRecentRouletteWins: (...args: unknown[]) => getRecentRouletteWinsMock(...args),
  getRouletteRoundParticipants: (...args: unknown[]) => getRouletteRoundParticipantsMock(...args),
  placeRouletteBet: (...args: unknown[]) => placeRouletteBetMock(...args),
  subscribeToRouletteRounds: (...args: unknown[]) => subscribeToRouletteRoundsMock(...args),
}));

function RouletteTableProbe({ refreshProfile = vi.fn() }: { refreshProfile?: () => Promise<void> }) {
  useRouletteTable({ userId: 'user-1', refreshProfile });
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
    placeRouletteBetMock.mockResolvedValue({ id: 'bet-1', round_id: 'round-1' });
    subscribeToRouletteRoundsMock.mockReturnValue(vi.fn());
  });

  it('does not start an overlapping snapshot when realtime fires during sync', async () => {
    let onRoundChange: (() => void) | null = null;
    let resolveAdvance: (() => void) | null = null;

    advanceRouletteRoundIfDueMock.mockImplementationOnce(
      () => new Promise<void>((resolve) => {
        resolveAdvance = resolve;
      }),
    );
    advanceRouletteRoundIfDueMock.mockResolvedValue(undefined);
    subscribeToRouletteRoundsMock.mockImplementation((callback: () => void) => {
      onRoundChange = callback;
      return vi.fn();
    });

    render(<RouletteTableProbe />);

    await waitFor(() => {
      expect(advanceRouletteRoundIfDueMock).toHaveBeenCalledTimes(1);
    });

    act(() => {
      onRoundChange?.();
    });

    expect(advanceRouletteRoundIfDueMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveAdvance?.();
    });
  });

  it('does not refresh the viewer profile for another player settled win', async () => {
    const refreshProfile = vi.fn().mockResolvedValue(undefined);
    advanceRouletteRoundIfDueMock.mockResolvedValue(undefined);
    getRecentRouletteSpinsMock.mockResolvedValue([
      {
        id: 'round-1',
        phase: 'settled',
        round_number: 1,
      },
    ]);
    getRecentRouletteWinsMock.mockResolvedValue([
      {
        id: 'win-1',
        round_id: 'round-1',
        user_id: 'user-2',
        payout: 50,
      },
    ]);

    render(<RouletteTableProbe refreshProfile={refreshProfile} />);

    await waitFor(() => {
      expect(getRecentRouletteWinsMock).toHaveBeenCalled();
    });

    expect(refreshProfile).not.toHaveBeenCalled();
  });

  it('refreshes the viewer profile for their settled win once', async () => {
    const refreshProfile = vi.fn().mockResolvedValue(undefined);
    advanceRouletteRoundIfDueMock.mockResolvedValue(undefined);
    getRecentRouletteWinsMock.mockResolvedValue([
      {
        id: 'win-1',
        round_id: 'round-1',
        user_id: 'user-1',
        payout: 50,
      },
    ]);

    render(<RouletteTableProbe refreshProfile={refreshProfile} />);

    await waitFor(() => {
      expect(refreshProfile).toHaveBeenCalledTimes(1);
    });
  });
});
