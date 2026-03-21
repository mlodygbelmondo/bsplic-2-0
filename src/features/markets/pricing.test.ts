import { describe, expect, it } from 'vitest';

import {
  convertPriceToPln,
  roundAssetAmount,
  roundMoney,
} from '@/features/markets/pricing';

describe('markets pricing helpers', () => {
  it('keeps PLN price unchanged', () => {
    expect(convertPriceToPln({ price: 123.45, quoteCurrency: 'PLN', fxRatesToPln: {} })).toBe(123.45);
  });

  it('converts non-PLN quote using provided FX rates', () => {
    expect(convertPriceToPln({ price: 10, quoteCurrency: 'USD', fxRatesToPln: { USD: 3.9 } })).toBe(39);
  });

  it('returns null when FX rate is missing', () => {
    expect(convertPriceToPln({ price: 10, quoteCurrency: 'GBP', fxRatesToPln: { USD: 3.9 } })).toBeNull();
  });

  it('rounds money and asset amounts with expected precision', () => {
    expect(roundMoney(12.3456)).toBe(12.35);
    expect(roundAssetAmount(0.123456789)).toBe(0.12345679);
  });
});
