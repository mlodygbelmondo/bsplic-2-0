import { describe, expect, it } from 'vitest';

import {
  getReactionEmoji,
  REACTION_EMOJIS,
  REACTION_TYPES,
  sortedReactions,
  totalReactions,
  type ReactionCounts,
} from './reactions';

describe('REACTION_EMOJIS', () => {
  it('has 7 emoji types', () => {
    expect(Object.keys(REACTION_EMOJIS)).toHaveLength(7);
  });

  it('REACTION_TYPES matches REACTION_EMOJIS keys', () => {
    expect(REACTION_TYPES).toEqual(Object.keys(REACTION_EMOJIS));
  });
});

describe('totalReactions', () => {
  it('returns 0 for null', () => {
    expect(totalReactions(null)).toBe(0);
  });

  it('returns 0 for empty object', () => {
    expect(totalReactions({})).toBe(0);
  });

  it('sums all reaction counts', () => {
    const counts: ReactionCounts = { like: 5, heart: 3, laugh: 2 };
    expect(totalReactions(counts)).toBe(10);
  });
});

describe('sortedReactions', () => {
  it('returns empty array for null', () => {
    expect(sortedReactions(null)).toEqual([]);
  });

  it('returns empty array for empty object', () => {
    expect(sortedReactions({})).toEqual([]);
  });

  it('sorts reactions by count descending', () => {
    const result = sortedReactions({ like: 2, heart: 5, laugh: 1 });

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ type: 'heart', emoji: '❤️', count: 5 });
    expect(result[1]).toEqual({ type: 'like', emoji: '👍', count: 2 });
    expect(result[2]).toEqual({ type: 'laugh', emoji: '😂', count: 1 });
  });

  it('filters out zero-count reactions', () => {
    const result = sortedReactions({ like: 3, heart: 0, laugh: 1 });

    expect(result).toHaveLength(2);
    expect(result.find((r) => r.type === 'heart')).toBeUndefined();
  });

  it('includes correct emoji strings', () => {
    const emojis = sortedReactions({ wow: 1, sad: 1, angry: 1, fire: 1 }).map((r) => r.emoji);
    expect(emojis).toContain('😮');
    expect(emojis).toContain('😢');
    expect(emojis).toContain('😡');
    expect(emojis).toContain('🔥');
  });
});

describe('getReactionEmoji', () => {
  it('returns the correct emoji for each type', () => {
    expect(getReactionEmoji('like')).toBe('👍');
    expect(getReactionEmoji('heart')).toBe('❤️');
    expect(getReactionEmoji('laugh')).toBe('😂');
    expect(getReactionEmoji('wow')).toBe('😮');
    expect(getReactionEmoji('sad')).toBe('😢');
    expect(getReactionEmoji('angry')).toBe('😡');
    expect(getReactionEmoji('fire')).toBe('🔥');
  });

  it('returns the input string for unknown types', () => {
    expect(getReactionEmoji('unknown')).toBe('unknown');
  });
});
