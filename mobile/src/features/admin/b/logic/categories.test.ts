import { describe, expect, it } from 'vitest';

import { getCategoryPaginationRange, normalizeHexColor, parseSortOrder } from './categories';

describe('getCategoryPaginationRange', () => {
  it('lists every page when there are at most seven', () => {
    expect(getCategoryPaginationRange(0, 3)).toEqual([0, 1, 2]);
    expect(getCategoryPaginationRange(6, 7)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('collapses distant pages into ellipses around the current page', () => {
    expect(getCategoryPaginationRange(0, 10)).toEqual([0, 1, 'ellipsis', 9]);
    expect(getCategoryPaginationRange(5, 10)).toEqual([0, 'ellipsis', 4, 5, 6, 'ellipsis', 9]);
    expect(getCategoryPaginationRange(9, 10)).toEqual([0, 'ellipsis', 8, 9]);
  });
});

describe('parseSortOrder', () => {
  it('parses numbers and falls back to 0 like a number input', () => {
    expect(parseSortOrder('12')).toBe(12);
    expect(parseSortOrder('')).toBe(0);
    expect(parseSortOrder('abc')).toBe(0);
  });
});

describe('normalizeHexColor', () => {
  it('accepts short, long and alpha hex colors and lowercases them', () => {
    expect(normalizeHexColor('#DC2626')).toBe('#dc2626');
    expect(normalizeHexColor('f00')).toBe('#ff0000');
    expect(normalizeHexColor('#10B981FF')).toBe('#10b981');
  });

  it('rejects anything that is not a hex color', () => {
    expect(normalizeHexColor('red')).toBeNull();
    expect(normalizeHexColor('#12345')).toBeNull();
  });
});
