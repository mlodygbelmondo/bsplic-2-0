import { describe, expect, it } from 'vitest';

import {
  formatCountdown,
  formatDrawDate,
  formatDrawDateNumeric,
  formatJackpotAmount,
  formatJackpotHeroAmount,
  formatPolishCount,
  getDrawTimeLabel,
  getInitials,
  getParticipantProgressLabel,
  getWarsawDateKey,
} from './jackpotFormat';

// The web formats with Intl (pl-PL, Europe/Warsaw); Node's full ICU produces
// the same strings as the browser, so it is the reference for the native port.
const webHeroAmount = (amount: number) => {
  const hasCents = Math.round(amount) !== amount;
  return `${amount.toLocaleString('pl-PL', {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  })} zł`;
};
const webToastAmount = (amount: number) =>
  `${amount
    .toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })
    .replace(/\s/g, ' ')} zł`;
const webDrawDate = (poolDate: string) =>
  new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: 'long', timeZone: 'Europe/Warsaw' }).format(
    new Date(`${poolDate}T12:00:00.000Z`),
  );
const webDrawDateNumeric = (poolDate: string) =>
  new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Warsaw',
  }).format(new Date(`${poolDate}T12:00:00.000Z`));

describe('jackpotFormat', () => {
  it('formats prize amounts for Polish currency display', () => {
    expect(formatJackpotAmount(1234.5)).toMatch(/^1234,50 zł$|^1 234,50 zł$/);
  });

  it('labels today draw time in Europe/Warsaw', () => {
    expect(getDrawTimeLabel('2026-06-17T18:00:00.000Z', '2026-06-17T10:00:00.000Z')).toBe(
      'Losowanie dziś o 20:00',
    );
  });

  it('labels future draw date in Europe/Warsaw', () => {
    expect(getDrawTimeLabel('2026-06-18T18:00:00.000Z', '2026-06-17T10:00:00.000Z')).toBe(
      'Losowanie 18.06 o 20:00',
    );
  });

  it('formats participant progress', () => {
    expect(getParticipantProgressLabel(2, 3)).toBe('2/3 graczy');
  });

  it('matches the web Intl output for hero and toast amounts', () => {
    for (const amount of [0, 7, 125, 999.99, 1000, 2480.75, 9999, 10000, 15000, 123456.7, 1234567.5, 0.5]) {
      expect(formatJackpotHeroAmount(amount)).toBe(webHeroAmount(amount));
      expect(formatJackpotAmount(amount)).toBe(webToastAmount(amount));
    }
  });

  it('treats non-finite amounts as zero', () => {
    expect(formatJackpotHeroAmount(Number.NaN)).toBe('0 zł');
    expect(formatJackpotAmount(Number.POSITIVE_INFINITY)).toBe('0,00 zł');
  });

  it('matches the web Intl output for draw dates', () => {
    for (const poolDate of ['2026-01-01', '2026-03-29', '2026-06-05', '2026-10-25', '2026-12-31', '2027-02-28']) {
      expect(formatDrawDate(poolDate)).toBe(webDrawDate(poolDate));
      expect(formatDrawDateNumeric(poolDate)).toBe(webDrawDateNumeric(poolDate));
    }
  });

  it('switches the Warsaw calendar day at local midnight in both seasons', () => {
    // Summer (UTC+2): 22:30 UTC is already the next day in Warsaw.
    expect(getWarsawDateKey(new Date('2026-06-17T21:59:00.000Z'))).toBe('2026-06-17');
    expect(getWarsawDateKey(new Date('2026-06-17T22:30:00.000Z'))).toBe('2026-06-18');
    // Winter (UTC+1): 22:30 UTC is still the same day, 23:30 UTC is not.
    expect(getWarsawDateKey(new Date('2026-01-10T22:30:00.000Z'))).toBe('2026-01-10');
    expect(getWarsawDateKey(new Date('2026-01-10T23:30:00.000Z'))).toBe('2026-01-11');
    // DST boundaries 2026: 29 March and 25 October at 01:00 UTC.
    expect(getWarsawDateKey(new Date('2026-03-28T22:30:00.000Z'))).toBe('2026-03-28');
    expect(getWarsawDateKey(new Date('2026-03-29T22:30:00.000Z'))).toBe('2026-03-30');
    expect(getWarsawDateKey(new Date('2026-10-25T22:30:00.000Z'))).toBe('2026-10-25');
  });

  it('formats the countdown and clamps it at zero', () => {
    expect(formatCountdown(8 * 3600_000 + 5 * 60_000 + 9_999)).toBe('08:05:09');
    expect(formatCountdown(-5_000)).toBe('00:00:00');
  });

  it('picks Polish plural forms', () => {
    expect(formatPolishCount(1, 'gracz', 'gracze', 'graczy')).toBe('1 gracz');
    expect(formatPolishCount(3, 'gracz', 'gracze', 'graczy')).toBe('3 gracze');
    expect(formatPolishCount(12, 'los', 'losy', 'losów')).toBe('12 losów');
    expect(formatPolishCount(22, 'los', 'losy', 'losów')).toBe('22 losy');
    expect(formatPolishCount(0, 'ticket', 'tickety', 'ticketów')).toBe('0 ticketów');
  });

  it('builds avatar initials', () => {
    expect(getInitials('  mati ')).toBe('MA');
    expect(getInitials('   ')).toBe('??');
  });
});
