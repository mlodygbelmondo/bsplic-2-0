import { describe, expect, it } from 'vitest';

import { getSlotSymbolSize, getSlotSymbolSprite } from './slotTiles';

describe('getSlotSymbolSprite', () => {
  it('reads Midnight Bandit symbols from the first sheet', () => {
    expect(getSlotSymbolSprite(0, 1)).toEqual({ sheet: 'symbols', column: 1, row: 0 });
    expect(getSlotSymbolSprite(0, 6)).toEqual({ sheet: 'symbols', column: 2, row: 1 });
  });

  it('reads Candy Cascade symbols from the lower half of the first sheet', () => {
    expect(getSlotSymbolSprite(8, 2)).toEqual({ sheet: 'symbols', column: 2, row: 2 });
    expect(getSlotSymbolSprite(8, 6)).toEqual({ sheet: 'symbols', column: 2, row: 3 });
  });

  it('switches Ember Forge and Pearl Tide to the forge/tide sheet', () => {
    expect(getSlotSymbolSprite(16, 1)).toEqual({ sheet: 'forge-tide', column: 1, row: 0 });
    expect(getSlotSymbolSprite(24, 6)).toEqual({ sheet: 'forge-tide', column: 2, row: 3 });
  });
});

describe('getSlotSymbolSize', () => {
  it('clamps to the CSS minimums on a 390 pt phone', () => {
    expect(getSlotSymbolSize(390, true)).toBe(72);
    expect(getSlotSymbolSize(390, false)).toBeCloseTo(53.6);
  });

  it('grows with the viewport up to the CSS maximums', () => {
    expect(getSlotSymbolSize(600, true)).toBeCloseTo(102);
    expect(getSlotSymbolSize(1000, true)).toBe(128);
    expect(getSlotSymbolSize(1000, false)).toBeCloseTo(92.8);
  });
});
