/** Reaction aggregation utilities (web `reactions.ts`). Constants live in `@/types/social`. */
import { REACTION_EMOJIS, type ReactionType } from '@/types/social';

export { REACTION_EMOJIS, REACTION_LABELS, REACTION_TYPES, type ReactionType } from '@/types/social';

export type ReactionCounts = Partial<Record<ReactionType, number>>;

/** Total reaction count across all emoji types. */
export function totalReactions(counts: ReactionCounts | null | undefined): number {
  if (!counts) return 0;
  return Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0);
}

/** Reactions sorted by count (descending), zeros filtered out. */
export function sortedReactions(
  counts: ReactionCounts | null | undefined,
): { type: ReactionType; emoji: string; count: number }[] {
  if (!counts) return [];

  return (Object.entries(counts) as [ReactionType, number][])
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({ type, emoji: REACTION_EMOJIS[type] ?? type, count }));
}

/** Display emoji for a reaction type. */
export function getReactionEmoji(type: ReactionType | string): string {
  return REACTION_EMOJIS[type as ReactionType] ?? type;
}
