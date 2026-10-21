import { describe, expect, it } from 'vitest';

import { applyMention, extractActiveMention } from './mentions';

describe('social mentions helpers', () => {
  it('extracts active mention query at caret', () => {
    const value = 'Siema @tes';
    expect(extractActiveMention(value, value.length)).toEqual({ query: 'tes', start: 6, end: 10 });
  });

  it('returns null when caret is not in mention token', () => {
    const value = 'Siema tester';
    expect(extractActiveMention(value, value.length)).toBeNull();
  });

  it('applies selected mention and returns next caret', () => {
    expect(applyMention('Hej @te', { start: 4, end: 7 }, 'tester')).toEqual({ value: 'Hej @tester ', caret: 12 });
  });

  it('uses the text before the caret, not the whole value', () => {
    expect(extractActiveMention('@ja i reszta', 3)).toEqual({ query: 'ja', start: 0, end: 3 });
  });

  it('ignores an @ glued to a word (e-mail addresses)', () => {
    const value = 'mail jan@wp';
    expect(extractActiveMention(value, value.length)).toBeNull();
  });

  it('reports an empty query right after a bare @', () => {
    expect(extractActiveMention('Hej @', 5)).toEqual({ query: '', start: 4, end: 5 });
  });

  it('keeps the text after the caret when inserting a mention mid-sentence', () => {
    expect(applyMention('Hej @ma co tam', { start: 4, end: 7 }, 'marek')).toEqual({
      value: 'Hej @marek  co tam',
      caret: 11,
    });
  });
});
