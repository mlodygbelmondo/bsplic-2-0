import { describe, expect, it } from 'vitest';

import { floorMoney, roundMoney } from './money';

describe('roundMoney', () => {
  it('rounds half a cent up like Postgres round(x, 2)', () => {
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(10.15 * 1.5)).toBe(15.23);
    expect(roundMoney(-1.005)).toBe(-1.01);
  });

  it('removes float noise from sums and differences', () => {
    expect(roundMoney(4.35 - 1)).toBe(3.35);
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
  });
});

describe('floorMoney', () => {
  it('keeps a balance that is already whole cents', () => {
    expect(floorMoney(0.29)).toBe(0.29);
    expect(floorMoney(4.35)).toBe(4.35);
  });

  it('drops fractions of a cent', () => {
    expect(floorMoney(12.349)).toBe(12.34);
  });
});
