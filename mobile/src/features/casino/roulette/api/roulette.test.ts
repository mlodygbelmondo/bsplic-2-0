import { beforeEach, describe, expect, it, vi } from 'vitest';

import { advanceRouletteRoundIfDue, getRouletteTableSnapshot, placeRouletteBet } from './roulette';

const rpcMock = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

describe('roulette api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads the full roulette table through one snapshot RPC with 50 spins of history', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          current_round: {
            id: 'round-1',
            table_key: 'main',
            round_number: 12,
            phase: 'waiting',
            betting_opens_at: '2026-06-11T10:00:00.000Z',
            betting_closes_at: '2026-06-11T10:00:15.000Z',
            spin_started_at: null,
            settled_at: null,
            winning_number: null,
            winning_color: null,
            created_at: '2026-06-11T10:00:00.000Z',
          },
          recent_spins: [
            {
              id: 'round-0',
              table_key: 'main',
              round_number: 11,
              phase: 'settled',
              betting_opens_at: '2026-06-11T09:59:30.000Z',
              betting_closes_at: '2026-06-11T09:59:45.000Z',
              spin_started_at: '2026-06-11T09:59:45.000Z',
              settled_at: '2026-06-11T09:59:51.000Z',
              winning_number: 7,
              winning_color: 'red',
              created_at: '2026-06-11T09:59:30.000Z',
            },
            { id: 'broken-row-without-timestamps' },
          ],
          recent_wins: [
            {
              id: 'win-1',
              round_id: 'round-0',
              user_id: 'user-1',
              username: 'LuckyFox',
              avatar_url: null,
              bet_type: 'straight',
              bet_value: '7',
              stake: '5.00',
              payout: '180.00',
              is_win: true,
              created_at: '2026-06-11T09:59:35.000Z',
              settled_at: '2026-06-11T09:59:51.000Z',
              round_number: 11,
            },
          ],
          active_bets: [
            {
              id: 'bet-1',
              round_id: 'round-1',
              user_id: 'user-1',
              bet_type: 'color',
              bet_value: 'red',
              stake: 10,
              payout: 0,
              is_win: null,
              created_at: '2026-06-11T10:00:02.000Z',
              settled_at: null,
            },
          ],
          round_participants: [
            {
              user_id: 'user-1',
              username: 'LuckyFox',
              avatar_url: null,
              total_stake: 30,
              bet_count: 2,
              bets: [
                { bet_type: 'color', bet_value: 'red', stake: 20 },
                { bet_type: 'straight', bet_value: 0, stake: 10 },
                { bet_type: 'corner', bet_value: '1-2-4-5', stake: 10 },
                { bet_type: 'parity', bet_value: '', stake: 10 },
              ],
            },
          ],
        },
      ],
      error: null,
    });

    const snapshot = await getRouletteTableSnapshot();

    expect(snapshot).toMatchObject({
      currentRound: { id: 'round-1', round_number: 12, phase: 'waiting', winning_number: null },
      recentSpins: [{ id: 'round-0', winning_number: 7, winning_color: 'red' }],
      recentWins: [{ id: 'win-1', username: 'LuckyFox', stake: 5, payout: 180, round_number: 11 }],
      activeBets: [{ id: 'bet-1', bet_type: 'color', stake: 10, is_win: null }],
    });
    expect(snapshot.recentSpins).toHaveLength(1);
    expect(snapshot.roundParticipants).toEqual([
      {
        user_id: 'user-1',
        username: 'LuckyFox',
        avatar_url: null,
        total_stake: 30,
        bet_count: 2,
        bets: [
          { bet_type: 'color', bet_value: 'red', stake: 20 },
          { bet_type: 'straight', bet_value: '0', stake: 10 },
        ],
      },
    ]);
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith('get_roulette_table_snapshot', {
      p_table_key: 'main',
      p_recent_spins_limit: 50,
      p_recent_wins_limit: 20,
    });
  });

  it('returns an idle table when the snapshot has no open round', async () => {
    rpcMock.mockResolvedValue({
      data: [{ current_round: null, recent_spins: [], recent_wins: [], active_bets: [], round_participants: [] }],
      error: null,
    });

    await expect(getRouletteTableSnapshot()).resolves.toEqual({
      currentRound: null,
      recentSpins: [],
      recentWins: [],
      activeBets: [],
      roundParticipants: [],
    });
  });

  it('surfaces the server message when the snapshot fails', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'Wymagane uwierzytelnienie' } });

    await expect(getRouletteTableSnapshot()).rejects.toThrow('Wymagane uwierzytelnienie');
  });

  it('places a table bet without requiring an existing round id', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
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
        },
      ],
      error: null,
    });

    await expect(
      placeRouletteBet({ userId: 'user-1', betType: 'color', betValue: 'red', stake: 25 }),
    ).resolves.toMatchObject({ id: 'bet-1', round_id: 'round-1', bet_type: 'color' });

    expect(rpcMock).toHaveBeenCalledWith('place_roulette_table_bet', {
      p_table_key: 'main',
      p_user_id: 'user-1',
      p_bet_type: 'color',
      p_bet_value: 'red',
      p_stake: 25,
    });
  });

  it('rejects a bet the server did not return', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });

    await expect(
      placeRouletteBet({ userId: 'user-1', betType: 'color', betValue: 'red', stake: 25 }),
    ).rejects.toThrow('Zakład nie został zapisany');
  });

  it('shows the lock-contention message from the server as-is', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'Stół ruletki jest teraz synchronizowany. Spróbuj ponownie za chwilę.' },
    });

    await expect(
      placeRouletteBet({ userId: 'user-1', betType: 'straight', betValue: '0', stake: 1 }),
    ).rejects.toThrow('Stół ruletki jest teraz synchronizowany. Spróbuj ponownie za chwilę.');
  });

  it('nudges the main table forward', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    await advanceRouletteRoundIfDue();

    expect(rpcMock).toHaveBeenCalledWith('advance_roulette_round_if_due', { p_table_key: 'main' });
  });
});
