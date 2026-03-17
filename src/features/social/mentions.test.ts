import { describe, expect, it } from 'vitest';
import { applyMention, extractActiveMention } from '@/features/social/mentions';

describe('social mentions helpers', () => {
  it('extracts active mention query at caret', () => {
    const value = 'Siema @tes';
    const mention = extractActiveMention(value, value.length);

    expect(mention).toEqual({
      query: 'tes',
      start: 6,
      end: 10,
    });
  });

  it('returns null when caret is not in mention token', () => {
    const value = 'Siema tester';
    const mention = extractActiveMention(value, value.length);

    expect(mention).toBeNull();
  });

  it('applies selected mention and returns next caret', () => {
    const result = applyMention('Hej @te', { start: 4, end: 7 }, 'tester');

    expect(result).toEqual({
      value: 'Hej @tester ',
      caret: 12,
    });
  });
});
