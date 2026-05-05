import { describe, expect, it } from 'vitest';

import {
  parseWinningOptions,
  encodeWinningOptions,
  normalizeType,
  normalizeOptions,
  normalizeCouponStatus,
  getErrorMessage,
  lockEditableOptionsByType,
  toEditableOptions,
} from './helpers';

describe('parseWinningOptions', () => {
  it('returns empty array for null', () => {
    expect(parseWinningOptions(null)).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(parseWinningOptions('')).toEqual([]);
  });

  it('wraps a plain string in a single-element array', () => {
    expect(parseWinningOptions('Legia')).toEqual(['Legia']);
  });

  it('parses a JSON array string into an array', () => {
    expect(parseWinningOptions('["Legia","Lech"]')).toEqual(['Legia', 'Lech']);
  });

  it('parses a single-element JSON array', () => {
    expect(parseWinningOptions('["Legia"]')).toEqual(['Legia']);
  });

  it('filters out non-string entries in JSON array', () => {
    expect(parseWinningOptions('[1,"Legia",null,"Lech"]')).toEqual(['Legia', 'Lech']);
  });

  it('handles sentinel value __REFUND__', () => {
    expect(parseWinningOptions('__REFUND__')).toEqual(['__REFUND__']);
  });

  it('handles sentinel value __FORCED_LOSS__', () => {
    expect(parseWinningOptions('__FORCED_LOSS__')).toEqual(['__FORCED_LOSS__']);
  });

  it('falls back to plain string for malformed JSON', () => {
    expect(parseWinningOptions('[broken')).toEqual(['[broken']);
  });
});

describe('encodeWinningOptions', () => {
  it('returns plain string for single winner', () => {
    expect(encodeWinningOptions(['Legia'])).toBe('Legia');
  });

  it('returns JSON array string for multiple winners', () => {
    expect(encodeWinningOptions(['Legia', 'Lech'])).toBe('["Legia","Lech"]');
  });

  it('roundtrips single winner through parse/encode', () => {
    const encoded = encodeWinningOptions(['Legia']);
    expect(parseWinningOptions(encoded)).toEqual(['Legia']);
  });

  it('roundtrips multi winner through parse/encode', () => {
    const encoded = encodeWinningOptions(['Legia', 'Lech', 'Wisła']);
    expect(parseWinningOptions(encoded)).toEqual(['Legia', 'Lech', 'Wisła']);
  });
});

describe('normalizeType', () => {
  it('accepts known types', () => {
    expect(normalizeType('single')).toBe('single');
    expect(normalizeType('1x2')).toBe('1x2');
    expect(normalizeType('multi')).toBe('multi');
  });

  it('defaults unknown type to 12', () => {
    expect(normalizeType('unknown')).toBe('12');
    expect(normalizeType('')).toBe('12');
  });
});

describe('normalizeOptions', () => {
  it('returns empty array for non-array', () => {
    expect(normalizeOptions(null)).toEqual([]);
    expect(normalizeOptions('string')).toEqual([]);
  });

  it('normalizes valid options', () => {
    const result = normalizeOptions([
      { name: 'Legia', odds: 2.1 },
      { name: 'Lech', odds: 1.8 },
    ]);
    expect(result).toEqual([
      { name: 'Legia', odds: 2.1 },
      { name: 'Lech', odds: 1.8 },
    ]);
  });

  it('provides defaults for invalid entries', () => {
    const result = normalizeOptions([{}, { name: 'OK', odds: -1 }]);
    expect(result).toEqual([
      { name: 'Opcja 1', odds: 1 },
      { name: 'OK', odds: 1 },
    ]);
  });
});

describe('editable options', () => {
  it('stores odds as strings while editing', () => {
    expect(toEditableOptions([{ name: 'Legia', odds: 2.1 }])).toEqual([
      { name: 'Legia', odds: '2.1' },
    ]);
  });

  it('preserves an empty odds input while locking options by type', () => {
    const result = lockEditableOptionsByType('12', [
      { name: '1', odds: '' },
      { name: '2', odds: '1.8' },
    ]);

    expect(result).toEqual([
      { name: '1', odds: '' },
      { name: '2', odds: '1.8' },
    ]);
  });
});

describe('normalizeCouponStatus', () => {
  it('passes through valid statuses', () => {
    expect(normalizeCouponStatus('won')).toBe('won');
    expect(normalizeCouponStatus('lost')).toBe('lost');
    expect(normalizeCouponStatus('refund')).toBe('refund');
  });

  it('defaults to pending for unknown values', () => {
    expect(normalizeCouponStatus(null)).toBe('pending');
    expect(normalizeCouponStatus(undefined)).toBe('pending');
    expect(normalizeCouponStatus('unknown')).toBe('pending');
  });
});

describe('getErrorMessage', () => {
  it('extracts message from error-like object', () => {
    expect(getErrorMessage(new Error('test error'), 'fallback')).toBe('test error');
  });

  it('returns fallback for non-error', () => {
    expect(getErrorMessage(42, 'fallback')).toBe('fallback');
    expect(getErrorMessage(null, 'fallback')).toBe('fallback');
  });
});
