import { describe, expect, it } from 'vitest';

import {
  buildOddsRows,
  formatBetDate,
  formatTimeRemaining,
  getBetClockState,
  getOddsAccessibilityLabel,
  getOddsPressAction,
  getOptionProbabilities,
} from './bet-card';

const NOW = Date.UTC(2030, 0, 1, 12, 0, 0);
const option = (name: string, odds = 2) => ({ name, odds });

describe('getBetClockState', () => {
  it('marks an expired, unsettled bet as in progress and locks its options', () => {
    const state = getBetClockState(
      { ends_at: new Date(NOW - 60_000).toISOString(), is_active: true, winning_option: null },
      NOW,
    );

    expect(state.isInProgress).toBe(true);
    expect(state.isLocked).toBe(true);
  });

  it.each(['Legia', '["Legia","Lech"]'])('does not show in progress for a settled bet (%s)', (winningOption) => {
    const state = getBetClockState(
      { ends_at: new Date(NOW - 60_000).toISOString(), is_active: true, winning_option: winningOption },
      NOW,
    );

    expect(state.isInProgress).toBe(false);
  });

  it('shows the countdown only for active bets ending within 24 hours', () => {
    const inTwoHours = new Date(NOW + 2 * 3_600_000).toISOString();
    const inTwoDays = new Date(NOW + 48 * 3_600_000).toISOString();

    expect(getBetClockState({ ends_at: inTwoHours, is_active: true, winning_option: null }, NOW).endsSoon).toBe(true);
    expect(getBetClockState({ ends_at: inTwoHours, is_active: false, winning_option: null }, NOW).endsSoon).toBe(false);
    expect(getBetClockState({ ends_at: inTwoDays, is_active: true, winning_option: null }, NOW).endsSoon).toBe(false);
  });

  it('locks inactive bets that have not ended', () => {
    const state = getBetClockState(
      { ends_at: new Date(NOW + 60_000).toISOString(), is_active: false, winning_option: null },
      NOW,
    );

    expect(state.isLocked).toBe(true);
    expect(state.isInProgress).toBe(false);
  });
});

describe('formatTimeRemaining', () => {
  it.each([
    [30_000, 'za chwilę'],
    [25 * 60_000, 'za 25 min'],
    [2 * 3_600_000, 'za 2 godz.'],
    [3 * 3_600_000 + 5 * 60_000, 'za 3 godz. 5 min'],
  ])('formats %d ms as %s', (ms, expected) => {
    expect(formatTimeRemaining(ms)).toBe(expected);
  });
});

describe('formatBetDate', () => {
  it('prints day.month hour:minute in local time', () => {
    expect(formatBetDate(new Date(2030, 0, 5, 9, 7).toISOString())).toBe('05.01 09:07');
  });

  it('falls back for invalid dates', () => {
    expect(formatBetDate('not-a-date')).toBe('--.-- --:--');
  });
});

describe('buildOddsRows', () => {
  const names = (count: number) => Array.from({ length: count }, (_, index) => option(String(index + 1)));

  it('lays out 1x2 in one row of three and 12 in one row of two', () => {
    expect(buildOddsRows('1x2', names(3)).map((row) => row.cells.length)).toEqual([3]);
    expect(buildOddsRows('12', names(2)).map((row) => row.cells.length)).toEqual([2]);
  });

  it('centers the last option of a five-option multi bet', () => {
    const rows = buildOddsRows('multi', names(5));

    expect(rows.map((row) => row.cells.map((cell) => cell?.name ?? null))).toEqual([['1', '2'], ['3', '4'], ['5']]);
    expect(rows.map((row) => row.centered)).toEqual([false, false, true]);
  });

  it('uses three columns for six or more multi options and pads the last row', () => {
    const rows = buildOddsRows('multi', names(7));

    expect(rows.map((row) => row.cells.map((cell) => cell?.name ?? null))).toEqual([
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', null, null],
    ]);
    expect(rows.some((row) => row.centered)).toBe(false);
  });
});

describe('getOptionProbabilities', () => {
  it('normalizes implied probabilities over the card options', () => {
    const [first, second] = getOptionProbabilities([option('A', 2), option('B', 4)]);

    expect(first).toBeCloseTo(2 / 3);
    expect(second).toBeCloseTo(1 / 3);
  });

  it('gives zero width to options with unusable odds', () => {
    expect(getOptionProbabilities([option('A', 0), option('B', 2)])).toEqual([0, 1]);
  });
});

describe('odds chip interaction', () => {
  it('uses descriptive labels for each chip state', () => {
    const legia = option('Legia', 2.1);

    expect(getOddsAccessibilityLabel('Legia vs Lech', legia, false, false)).toBe('Legia vs Lech: wybierz Legia, kurs 2.10');
    expect(getOddsAccessibilityLabel('Legia vs Lech', legia, true, false)).toBe('Legia vs Lech: Legia wybrane, kurs 2.10');
    expect(getOddsAccessibilityLabel('Legia vs Lech', legia, true, true)).toBe('Legia vs Lech: Legia zablokowane, kurs 2.10');
  });

  it('toggles the picked option off and replaces any other pick', () => {
    expect(getOddsPressAction('Legia', 'Legia', false)).toBe('remove');
    expect(getOddsPressAction('Lech', 'Legia', false)).toBe('add');
    expect(getOddsPressAction('Lech', null, false)).toBe('add');
    expect(getOddsPressAction('Lech', null, true)).toBe('ignore');
  });
});
