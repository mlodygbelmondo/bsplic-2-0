import type { ReactionEmoji } from '@/types/database';

export type ReactionCountsMap = Partial<Record<ReactionEmoji, number>>;

/**
 * Applies a reaction change to the aggregated counts (web `feedReactions.ts`):
 * decrements the previous reaction (floored at 0), increments the next one,
 * drops zero keys and returns null when nothing is left.
 */
export function updateReactionCounts(
  reactions: ReactionCountsMap | null,
  previousReaction: ReactionEmoji | null,
  nextReaction: ReactionEmoji | null,
): ReactionCountsMap | null {
  const counts: ReactionCountsMap = { ...(reactions ?? {}) };

  if (previousReaction) {
    counts[previousReaction] = Math.max((counts[previousReaction] ?? 0) - 1, 0);
  }

  if (nextReaction) {
    counts[nextReaction] = (counts[nextReaction] ?? 0) + 1;
  }

  const normalized = (Object.entries(counts) as [ReactionEmoji, number][])
    .filter(([, value]) => value > 0)
    .reduce<ReactionCountsMap>((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});

  return Object.keys(normalized).length > 0 ? normalized : null;
}

/**
 * What `toggle_reaction` will return for a tap: sending the current reaction
 * removes it, any other emoji replaces it. Used for the optimistic update.
 */
export function predictToggledReaction(current: ReactionEmoji | null, emoji: ReactionEmoji): ReactionEmoji | null {
  return current === emoji ? null : emoji;
}

interface Reactable {
  reactions: ReactionCountsMap | null;
  my_reaction: ReactionEmoji | null;
}

/** The target's state after the viewer's reaction becomes `next`, computed from a pre-toggle snapshot. */
export function applyReaction<T extends Reactable>(snapshot: T, next: ReactionEmoji | null): T {
  return {
    ...snapshot,
    reactions: updateReactionCounts(snapshot.reactions, snapshot.my_reaction, next),
    my_reaction: next,
  };
}
