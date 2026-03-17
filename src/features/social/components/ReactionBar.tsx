import { cn } from '@/lib/utils';
import { REACTION_EMOJIS, REACTION_TYPES, sortedReactions, totalReactions, type ReactionType, type ReactionCounts } from '../reactions';

interface ReactionBarProps {
  reactions: ReactionCounts | null;
  myReaction: ReactionType | null;
  onToggle: (emoji: ReactionType) => void;
  onOpenReactors?: () => void;
  disabled?: boolean;
}

export function ReactionBar({ reactions, myReaction, onToggle, onOpenReactors, disabled }: ReactionBarProps) {
  const sorted = sortedReactions(reactions);
  const reactionsTotal = totalReactions(reactions);

  return (
    <div className="flex items-center gap-1 flex-wrap" role="group" aria-label="Reakcje">
      {/* Existing reactions */}
      {sorted.map(({ type, emoji, count }) => (
        <button
          key={type}
          type="button"
          onClick={() => onToggle(type)}
          disabled={disabled}
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors border',
            myReaction === type
              ? 'bg-primary/10 border-primary/30 text-primary font-semibold'
              : 'bg-muted/50 border-transparent text-muted-foreground hover:bg-muted',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
          aria-label={`${emoji} ${count}`}
          aria-pressed={myReaction === type}
        >
          <span>{emoji}</span>
          <span>{count}</span>
        </button>
      ))}

      {/* Add reaction picker (show emojis not yet present or that have 0 count) */}
      <ReactionPicker
        existingTypes={sorted.map((r) => r.type)}
        myReaction={myReaction}
        onToggle={onToggle}
        disabled={disabled}
      />

      {onOpenReactors && reactionsTotal > 0 && (
        <button
          type="button"
          onClick={onOpenReactors}
          disabled={disabled}
          className="ml-1 text-xs font-medium text-primary hover:underline disabled:no-underline"
        >
          Wyświetl reakcje
        </button>
      )}
    </div>
  );
}

interface ReactionPickerProps {
  existingTypes: ReactionType[];
  myReaction: ReactionType | null;
  onToggle: (emoji: ReactionType) => void;
  disabled?: boolean;
}

function ReactionPicker({ existingTypes, myReaction, onToggle, disabled }: ReactionPickerProps) {
  const missingTypes = REACTION_TYPES.filter((t) => !existingTypes.includes(t));

  // If all reaction types are already shown, no need for a picker
  if (missingTypes.length === 0) return null;

  return (
    <div className="inline-flex items-center gap-0.5 ml-1">
      {missingTypes.map((type) => (
        <button
          key={type}
          type="button"
          onClick={() => onToggle(type)}
          disabled={disabled}
          className={cn(
            'rounded-full w-6 h-6 flex items-center justify-center text-sm transition-colors hover:bg-muted',
            myReaction === type && 'ring-2 ring-primary/30',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
          aria-label={REACTION_EMOJIS[type]}
        >
          {REACTION_EMOJIS[type]}
        </button>
      ))}
    </div>
  );
}
