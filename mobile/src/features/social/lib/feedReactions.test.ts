import { describe, expect, it } from 'vitest';

import { applyReaction, predictToggledReaction, updateReactionCounts } from './feedReactions';

describe('updateReactionCounts', () => {
  it('moves the viewer from one reaction to another', () => {
    expect(updateReactionCounts({ like: 2, heart: 1 }, 'like', 'heart')).toEqual({ like: 1, heart: 2 });
  });

  it('removes a reaction and drops zero counts', () => {
    expect(updateReactionCounts({ like: 1, fire: 3 }, 'like', null)).toEqual({ fire: 3 });
  });

  it('returns null when the last reaction is removed', () => {
    expect(updateReactionCounts({ wow: 1 }, 'wow', null)).toBeNull();
  });

  it('never goes below zero when counts are stale', () => {
    expect(updateReactionCounts(null, 'sad', 'like')).toEqual({ like: 1 });
  });
});

describe('predictToggledReaction', () => {
  it('removes the reaction when the same emoji is sent again', () => {
    expect(predictToggledReaction('heart', 'heart')).toBeNull();
  });

  it('switches to a different emoji', () => {
    expect(predictToggledReaction('heart', 'laugh')).toBe('laugh');
    expect(predictToggledReaction(null, 'like')).toBe('like');
  });
});

describe('applyReaction', () => {
  it('reconciles a server answer against the pre-toggle snapshot', () => {
    const snapshot = { id: 'p1', reactions: { like: 3 }, my_reaction: 'like' as const };
    // Optimistic guess was "remove like", the server says "heart".
    expect(applyReaction(snapshot, 'heart')).toEqual({ id: 'p1', reactions: { like: 2, heart: 1 }, my_reaction: 'heart' });
  });
});
