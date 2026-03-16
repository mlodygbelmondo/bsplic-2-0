/**
 * Reaction aggregation utilities.
 */

export const REACTION_EMOJIS = {
  like:  '👍',
  heart: '❤️',
  laugh: '😂',
  wow:   '😮',
  sad:   '😢',
  angry: '😡',
} as const;

export type ReactionType = keyof typeof REACTION_EMOJIS;

export const REACTION_TYPES: ReactionType[] = ['like', 'heart', 'laugh', 'wow', 'sad', 'angry'];

export type ReactionCounts = Partial<Record<ReactionType, number>>;

/**
 * Returns the total reaction count across all emoji types.
 */
export function totalReactions(counts: ReactionCounts | null | undefined): number {
  if (!counts) return 0;
  return Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0);
}

/**
 * Returns reactions sorted by count (descending), filtering out zeros.
 */
export function sortedReactions(
  counts: ReactionCounts | null | undefined
): Array<{ type: ReactionType; emoji: string; count: number }> {
  if (!counts) return [];

  return (Object.entries(counts) as [ReactionType, number][])
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({
      type,
      emoji: REACTION_EMOJIS[type] ?? type,
      count,
    }));
}

/**
 * Returns the display emoji for a reaction type.
 */
export function getReactionEmoji(type: ReactionType | string): string {
  return REACTION_EMOJIS[type as ReactionType] ?? type;
}
