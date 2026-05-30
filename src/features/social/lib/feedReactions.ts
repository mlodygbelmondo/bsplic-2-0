import type { ReactionEmoji } from '@/types/database';

export function updateReactionCounts(
  reactions: Partial<Record<ReactionEmoji, number>> | null,
  previousReaction: ReactionEmoji | null,
  nextReaction: ReactionEmoji | null,
): Partial<Record<ReactionEmoji, number>> | null {
  const counts: Partial<Record<ReactionEmoji, number>> = {
    ...(reactions ?? {}),
  };

  if (previousReaction) {
    counts[previousReaction] = Math.max((counts[previousReaction] ?? 0) - 1, 0);
  }

  if (nextReaction) {
    counts[nextReaction] = (counts[nextReaction] ?? 0) + 1;
  }

  const normalized = (Object.entries(counts) as Array<[ReactionEmoji, number]>)
    .filter(([, value]) => value > 0)
    .reduce<Partial<Record<ReactionEmoji, number>>>((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});

  return Object.keys(normalized).length > 0 ? normalized : null;
}
