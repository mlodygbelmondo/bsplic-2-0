import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RouletteRecentWin } from '@/types/database';

import { rouletteSession, selectShowWinBanner, useRouletteSession } from './sessionStore';
import { createInitialTableState } from './tableStore';

vi.mock('../lib/preferences', () => ({
  getStoredRouletteBetType: () => 'color',
  storeRouletteBetType: vi.fn(),
}));

function win(overrides: Partial<RouletteRecentWin> = {}): RouletteRecentWin {
  return {
    id: 'win-1',
    round_id: 'round-1',
    user_id: 'user-1',
    username: 'Ty',
    avatar_url: null,
    bet_type: 'color',
    bet_value: 'red',
    stake: 20,
    payout: 40,
    is_win: true,
    created_at: '2026-04-17T12:00:04.000Z',
    settled_at: '2026-04-17T12:00:21.000Z',
    round_number: 123,
    ...overrides,
  };
}

const table = (recentWins: RouletteRecentWin[]) => ({ ...createInitialTableState(), isLoading: false, recentWins });

describe('roulette session', () => {
  beforeEach(() => {
    rouletteSession.reset();
  });

  it('starts from the stored bet type with no value and a 10 zł stake', () => {
    expect(useRouletteSession.getState()).toMatchObject({ betType: 'color', betValue: '', stake: '10' });
  });

  it('clears the value when the bet type changes', () => {
    rouletteSession.setBetValue('red');
    rouletteSession.setBetType('range');
    expect(useRouletteSession.getState()).toMatchObject({ betType: 'range', betValue: '', betTypeChanged: true });
  });

  it('announces a win from a round the player bet on exactly once', () => {
    rouletteSession.trackBetRound('round-1');

    expect(rouletteSession.syncWithTable(table([win()]), 'user-1')).toBe(true);
    expect(rouletteSession.syncWithTable(table([win()]), 'user-1')).toBe(false);
    expect(useRouletteSession.getState().winBurst).toBe(1);
    expect(selectShowWinBanner(useRouletteSession.getState())).toBe(true);
  });

  it('does not announce a win that was already on the table when the player arrived', () => {
    expect(rouletteSession.syncWithTable(table([win()]), 'user-1')).toBe(false);
    expect(selectShowWinBanner(useRouletteSession.getState())).toBe(false);
  });

  it('shows the next win after the previous banner was dismissed', () => {
    rouletteSession.trackBetRound('round-1');
    rouletteSession.syncWithTable(table([win()]), 'user-1');
    rouletteSession.dismissWin(useRouletteSession.getState().latestWinKey);
    expect(selectShowWinBanner(useRouletteSession.getState())).toBe(false);

    rouletteSession.trackBetRound('round-2');
    rouletteSession.syncWithTable(table([win({ id: 'win-2', round_id: 'round-2', payout: 360 }), win()]), 'user-1');

    expect(useRouletteSession.getState().latestWin?.payout).toBe(360);
    expect(selectShowWinBanner(useRouletteSession.getState())).toBe(true);
  });

  it('hides a shared win for good', () => {
    rouletteSession.trackBetRound('round-1');
    rouletteSession.syncWithTable(table([win()]), 'user-1');
    rouletteSession.markWinShared(useRouletteSession.getState().latestWinKey!, true);
    rouletteSession.dismissWin(null);

    expect(selectShowWinBanner(useRouletteSession.getState())).toBe(false);
  });
});
