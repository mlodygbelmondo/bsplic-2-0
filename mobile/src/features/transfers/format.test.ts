import { describe, expect, it } from 'vitest';

import { formatMoney, formatTransferDate, parseMoney, toAmountInput } from './format';

// Expected strings are what `Intl.NumberFormat('pl-PL')` / `Intl.DateTimeFormat('pl-PL')`
// print in browsers (the web implementation), including the U+00A0 group separator.
describe('formatMoney', () => {
  it.each([
    [0, '0,00'],
    [1, '1,00'],
    [25.5, '25,50'],
    [999.99, '999,99'],
    [1234.5, '1234,50'],
    [12345.5, '12 345,50'],
    [1234567.891, '1 234 567,89'],
    [-5, '-5,00'],
    [-1234.5, '-1234,50'],
    [1.005, '1,01'],
    [0.125, '0,13'],
  ])('formats %s as %s', (value, expected) => {
    expect(formatMoney(value)).toBe(expected);
  });
});

describe('formatTransferDate', () => {
  it('prints day, short Polish month, year and 24h time in local time', () => {
    expect(formatTransferDate(new Date(2026, 0, 15, 19, 7).toISOString())).toBe('15 sty 2026, 19:07');
    expect(formatTransferDate(new Date(2026, 9, 5, 9, 0).toISOString())).toBe('5 paź 2026, 09:00');
    expect(formatTransferDate(new Date(2026, 11, 31, 0, 59).toISOString())).toBe('31 gru 2026, 00:59');
  });
});

describe('parseMoney', () => {
  it('accepts comma or dot decimals with at most two places', () => {
    expect(parseMoney(' 25,50 ')).toBe(25.5);
    expect(parseMoney('25.5')).toBe(25.5);
    expect(parseMoney('100')).toBe(100);
  });

  it('rejects grouping, extra decimals, signs and empty input', () => {
    expect(parseMoney('1.000,00')).toBeNull();
    expect(parseMoney('1,005')).toBeNull();
    expect(parseMoney('-5')).toBeNull();
    expect(parseMoney('')).toBeNull();
    expect(parseMoney('abc')).toBeNull();
  });
});

describe('toAmountInput', () => {
  it('writes the whole balance in the comma-decimal field format the parser accepts', () => {
    expect(toAmountInput(1234.5)).toBe('1234,50');
    expect(parseMoney(toAmountInput(125.5))).toBe(125.5);
  });
});
