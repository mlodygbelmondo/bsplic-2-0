import { describe, expect, it } from 'vitest';

import {
  formatRouletteBetValue,
  getRouletteColor,
  getRoulettePayoutMultiplier,
  getRouletteBetValueOptions,
  getRouletteCountdownTargetMs,
  getRouletteNextSyncDelayMs,
  getRoulettePhaseLabel,
  ROULETTE_SPIN_REVEAL_MS,
  ROULETTE_SYNC_FALLBACK_MS,
  ROULETTE_SYNC_SETTLED_MS,
  ROULETTE_SYNC_TARGET_BUFFER_MS,
  validateRouletteBetInput,
} from './roulette';

describe('getRouletteColor', () => {
  it('returns green for zero', () => {
    expect(getRouletteColor(0)).toBe('green');
  });

  it('returns red for red numbers', () => {
    expect(getRouletteColor(1)).toBe('red');
    expect(getRouletteColor(32)).toBe('red');
  });

  it('returns black for black numbers', () => {
    expect(getRouletteColor(2)).toBe('black');
    expect(getRouletteColor(35)).toBe('black');
  });
});

describe('getRoulettePayoutMultiplier', () => {
  it('returns expected multiplier for each supported bet type', () => {
    expect(getRoulettePayoutMultiplier('straight')).toBe(36);
    expect(getRoulettePayoutMultiplier('color')).toBe(2);
    expect(getRoulettePayoutMultiplier('parity')).toBe(2);
    expect(getRoulettePayoutMultiplier('range')).toBe(2);
  });
});

describe('getRouletteBetValueOptions', () => {
  it('returns 37 options for straight bets', () => {
    const options = getRouletteBetValueOptions('straight');
    expect(options).toHaveLength(37);
    expect(options[0]).toEqual({ value: '0', label: '0' });
    expect(options[36]).toEqual({ value: '36', label: '36' });
  });

  it('returns predefined values for non-straight bets', () => {
    expect(getRouletteBetValueOptions('color')).toEqual([
      { value: 'red', label: 'Czerwone' },
      { value: 'black', label: 'Czarne' },
    ]);

    expect(getRouletteBetValueOptions('parity')).toEqual([
      { value: 'even', label: 'Parzyste' },
      { value: 'odd', label: 'Nieparzyste' },
    ]);

    expect(getRouletteBetValueOptions('range')).toEqual([
      { value: 'low', label: '1-18' },
      { value: 'high', label: '19-36' },
    ]);
  });
});

describe('validateRouletteBetInput', () => {
  it('normalizes valid straight bets', () => {
    expect(
      validateRouletteBetInput({
        betType: 'straight',
        betValue: '17',
        stake: '25.5',
        balance: 100,
      }),
    ).toEqual({
      betType: 'straight',
      betValue: '17',
      stake: 25.5,
    });
  });

  it('throws when bet type is missing', () => {
    expect(() =>
      validateRouletteBetInput({
        betType: '',
        betValue: 'red',
        stake: '10',
        balance: 100,
      }),
    ).toThrow('Wybierz typ zakładu');
  });

  it('throws when stake is invalid', () => {
    expect(() =>
      validateRouletteBetInput({
        betType: 'color',
        betValue: 'red',
        stake: '0',
        balance: 100,
      }),
    ).toThrow('Stawka musi być większa od 0');
  });

  it('throws when stake exceeds balance', () => {
    expect(() =>
      validateRouletteBetInput({
        betType: 'color',
        betValue: 'red',
        stake: '150',
        balance: 100,
      }),
    ).toThrow('Saldo jest za małe na taki zakład');
  });

  it('throws when bet value does not match bet type', () => {
    expect(() =>
      validateRouletteBetInput({
        betType: 'range',
        betValue: 'red',
        stake: '10',
        balance: 100,
      }),
    ).toThrow('Wybierz poprawną wartość zakładu');
  });
});

describe('formatRouletteBetValue', () => {
  it('formats supported premium bet values for display', () => {
    expect(formatRouletteBetValue('straight', '17')).toBe('17');
    expect(formatRouletteBetValue('color', 'red')).toBe('Czerwone');
    expect(formatRouletteBetValue('parity', 'odd')).toBe('Nieparzyste');
    expect(formatRouletteBetValue('range', 'high')).toBe('19-36');
  });
});

describe('getRoulettePhaseLabel', () => {
  it('returns localized labels for shared round phases', () => {
    expect(getRoulettePhaseLabel('waiting')).toBe('Przyjmowanie zakładów');
    expect(getRoulettePhaseLabel('spinning')).toBe('Koło się kręci');
    expect(getRoulettePhaseLabel('settled')).toBe('Runda rozliczona');
  });
});

describe('getRouletteCountdownTargetMs', () => {
  it('counts down to bet close while round is waiting', () => {
    expect(
      getRouletteCountdownTargetMs({
        phase: 'waiting',
        betting_closes_at: '2026-04-17T12:00:15.000Z',
        spin_started_at: null,
      }),
    ).toBe(new Date('2026-04-17T12:00:15.000Z').getTime());
  });

  it('counts down to reveal finish while wheel is spinning', () => {
    expect(
      getRouletteCountdownTargetMs({
        phase: 'spinning',
        betting_closes_at: '2026-04-17T12:00:15.000Z',
        spin_started_at: '2026-04-17T12:00:15.000Z',
      }),
    ).toBe(
      new Date('2026-04-17T12:00:15.000Z').getTime() + ROULETTE_SPIN_REVEAL_MS,
    );
  });

  it('returns null once round is settled', () => {
    expect(
      getRouletteCountdownTargetMs({
        phase: 'settled',
        betting_closes_at: '2026-04-17T12:00:15.000Z',
        spin_started_at: '2026-04-17T12:00:15.000Z',
      }),
    ).toBeNull();
  });
});

describe('getRouletteNextSyncDelayMs', () => {
  it('schedules waiting round sync just after betting closes', () => {
    expect(
      getRouletteNextSyncDelayMs(
        {
          phase: 'waiting',
          betting_closes_at: '2026-04-17T12:00:15.000Z',
          spin_started_at: null,
        },
        new Date('2026-04-17T12:00:10.000Z').getTime(),
      ),
    ).toBe(5_000 + ROULETTE_SYNC_TARGET_BUFFER_MS);
  });

  it('uses the fallback delay when the target is already due and cron owns advancement', () => {
    expect(
      getRouletteNextSyncDelayMs(
        {
          phase: 'spinning',
          betting_closes_at: '2026-04-17T12:00:15.000Z',
          spin_started_at: '2026-04-17T12:00:15.000Z',
        },
        new Date('2026-04-17T12:00:25.000Z').getTime(),
      ),
    ).toBe(ROULETTE_SYNC_FALLBACK_MS);
  });

  it('uses a settled-round delay after settlement', () => {
    expect(
      getRouletteNextSyncDelayMs({
        phase: 'settled',
        betting_closes_at: '2026-04-17T12:00:15.000Z',
        spin_started_at: '2026-04-17T12:00:15.000Z',
      }),
    ).toBe(ROULETTE_SYNC_SETTLED_MS);
  });

  it('falls back when there is no current round', () => {
    expect(getRouletteNextSyncDelayMs(null)).toBe(ROULETTE_SYNC_FALLBACK_MS);
  });
});
