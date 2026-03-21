import { describe, expect, it } from 'vitest';

import {
  getAssetAmountStep,
  getAssetSymbol,
  parseAssetAmount,
  validateAssetAmount,
  validateCashStake,
} from '@/features/markets/assets';

describe('markets asset validation', () => {
  it('parses amount and respects decimal precision', () => {
    expect(parseAssetAmount('2')).toBe(2);
    expect(parseAssetAmount('0.12345')).toBe(0.12345);
    expect(parseAssetAmount('abc')).toBeNull();
  });

  it('returns correct amount step by instrument type', () => {
    expect(getAssetAmountStep('crypto')).toBe(0.00000001);
    expect(getAssetAmountStep('stock')).toBe(0.0001);
    expect(getAssetAmountStep('etf')).toBe(0.0001);
    expect(getAssetAmountStep('forex')).toBe(0.01);
  });

  it('returns expected symbol for amount labels', () => {
    expect(getAssetSymbol('crypto')).toBe('BTC');
    expect(getAssetSymbol('stock')).toBe('akcji');
    expect(getAssetSymbol('etf')).toBe('udziału');
    expect(getAssetSymbol('forex')).toBe('jedn.');
  });

  it('validates cash stake with configured minimum', () => {
    expect(validateCashStake({ amountInPln: 4.99, minStakePln: 5 })).toBe(
      'Minimalna wartość transakcji to 5.00 zł'
    );
    expect(validateCashStake({ amountInPln: 5, minStakePln: 5 })).toBeNull();
  });

  it('validates asset amount by type', () => {
    expect(validateAssetAmount({ type: 'crypto', amount: 0 })).toBe('Ilość musi być większa od 0');
    expect(validateAssetAmount({ type: 'stock', amount: 0.00001 })).toContain('Minimalna ilość');
    expect(validateAssetAmount({ type: 'forex', amount: 0.001 })).toContain('Minimalna ilość');
    expect(validateAssetAmount({ type: 'stock', amount: 1.25 })).toBeNull();
  });
});
