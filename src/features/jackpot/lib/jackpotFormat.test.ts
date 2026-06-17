import { describe, expect, it } from 'vitest';

import {
  formatJackpotAmount,
  getDrawTimeLabel,
  getParticipantProgressLabel,
} from './jackpotFormat';

describe('jackpotFormat', () => {
  it('formats prize amounts for Polish currency display', () => {
    expect(formatJackpotAmount(1234.5)).toMatch(/^1234,50 zł$|^1 234,50 zł$/);
  });

  it('labels today draw time in Europe/Warsaw', () => {
    expect(
      getDrawTimeLabel(
        '2026-06-17T18:00:00.000Z',
        '2026-06-17T10:00:00.000Z',
      ),
    ).toBe('Losowanie dziś o 20:00');
  });

  it('labels future draw date in Europe/Warsaw', () => {
    expect(
      getDrawTimeLabel(
        '2026-06-18T18:00:00.000Z',
        '2026-06-17T10:00:00.000Z',
      ),
    ).toBe('Losowanie 18.06 o 20:00');
  });

  it('formats participant progress', () => {
    expect(getParticipantProgressLabel(2, 3)).toBe('2/3 graczy');
  });
});
