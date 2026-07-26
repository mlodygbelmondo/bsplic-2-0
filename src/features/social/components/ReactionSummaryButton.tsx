import {
  sortedReactions,
  totalReactions,
  type ReactionCounts,
} from '../reactions';

const VISIBLE_REACTION_LIMIT = 3;

interface ReactionSummaryButtonProps {
  reactions: ReactionCounts | null;
  onOpenReactors?: () => void;
  disabled?: boolean;
  className: string;
  stackClassName: string;
}

export function ReactionSummaryButton({
  reactions,
  onOpenReactors,
  disabled,
  className,
  stackClassName,
}: ReactionSummaryButtonProps) {
  const reactionsTotal = totalReactions(reactions);
  if (reactionsTotal === 0) return null;

  const visibleReactions = sortedReactions(reactions).slice(
    0,
    VISIBLE_REACTION_LIMIT,
  );

  return (
    <button
      type="button"
      onClick={onOpenReactors}
      disabled={disabled || !onOpenReactors}
      className={className}
      aria-label={`Wyświetl reakcje (${reactionsTotal})`}
    >
      <span className={stackClassName} aria-hidden="true">
        {visibleReactions.map(({ type, emoji }) => (
          <span key={type}>{emoji}</span>
        ))}
      </span>
      <span>{reactionsTotal}</span>
    </button>
  );
}
