import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from 'react';
import { ThumbsUp } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  REACTION_EMOJIS,
  REACTION_LABELS,
  REACTION_TYPES,
  sortedReactions,
  totalReactions,
  type ReactionCounts,
  type ReactionType,
} from '../reactions';

const LONG_PRESS_MS = 500;
const PICKER_CLOSE_MS = 140;

interface ReactionBarProps {
  reactions: ReactionCounts | null;
  myReaction: ReactionType | null;
  onToggle: (emoji: ReactionType) => void;
  onOpenReactors?: () => void;
  disabled?: boolean;
  className?: string;
  actionClassName?: string;
  showSummary?: boolean;
  showActionIcon?: boolean;
}

export function ReactionBar({
  reactions,
  myReaction,
  onToggle,
  onOpenReactors,
  disabled,
  className,
  actionClassName,
  showSummary = true,
  showActionIcon = false,
}: ReactionBarProps) {
  const sorted = sortedReactions(reactions);
  const reactionsTotal = totalReactions(reactions);
  const visibleReactions = sorted.slice(0, 3);

  return (
    <div
      className={cn(
        'social-reaction-bar flex items-center gap-1.5 flex-wrap',
        className,
      )}
      role="group"
      aria-label="Reakcje"
    >
      {showSummary && reactionsTotal > 0 && (
        <button
          type="button"
          onClick={onOpenReactors}
          disabled={disabled || !onOpenReactors}
          className="social-reaction-summary-button inline-flex items-center gap-1 rounded-full text-xs font-medium text-muted-foreground transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-55"
          aria-label={`Wyświetl reakcje (${reactionsTotal})`}
        >
          <span className="social-reaction-summary-stack" aria-hidden="true">
            {visibleReactions.map(({ type, emoji }) => (
              <span key={type}>{emoji}</span>
            ))}
          </span>
          <span>{reactionsTotal}</span>
        </button>
      )}

      <ReactionActionButton
        myReaction={myReaction}
        onToggle={onToggle}
        disabled={disabled}
        className={actionClassName}
        showIcon={showActionIcon}
      />
    </div>
  );
}

interface ReactionActionButtonProps {
  myReaction: ReactionType | null;
  onToggle: (emoji: ReactionType) => void;
  disabled?: boolean;
  className?: string;
  showIcon?: boolean;
}

function ReactionActionButton({
  myReaction,
  onToggle,
  disabled,
  className,
  showIcon,
}: ReactionActionButtonProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const longPressTimeoutRef = useRef<number | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);
  const suppressNextClickRef = useRef(false);
  const selectedReaction = myReaction ?? 'like';
  const label = REACTION_LABELS[selectedReaction];

  useEffect(() => {
    return () => {
      clearLongPressTimeout();
      clearCloseTimeout();
    };
  }, []);

  const clearLongPressTimeout = () => {
    if (longPressTimeoutRef.current === null) return;
    window.clearTimeout(longPressTimeoutRef.current);
    longPressTimeoutRef.current = null;
  };

  const clearCloseTimeout = () => {
    if (closeTimeoutRef.current === null) return;
    window.clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = null;
  };

  const openPicker = () => {
    if (disabled) return;
    clearCloseTimeout();
    setPickerOpen(true);
  };

  const closePickerSoon = () => {
    clearCloseTimeout();
    closeTimeoutRef.current = window.setTimeout(() => {
      setPickerOpen(false);
    }, PICKER_CLOSE_MS);
  };

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (disabled || event.pointerType === 'mouse') return;
    clearLongPressTimeout();
    longPressTimeoutRef.current = window.setTimeout(() => {
      suppressNextClickRef.current = true;
      setPickerOpen(true);
    }, LONG_PRESS_MS);
  };

  const handlePointerEnd = () => {
    clearLongPressTimeout();
  };

  const handleActionClick = () => {
    if (disabled) return;
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }

    onToggle(selectedReaction);
  };

  const handlePickerSelect = (reaction: ReactionType) => {
    if (disabled) return;
    suppressNextClickRef.current = false;
    setPickerOpen(false);
    onToggle(reaction);
  };

  return (
    <span
      className="social-reaction-action-wrap relative inline-flex"
      onMouseEnter={openPicker}
      onMouseLeave={closePickerSoon}
    >
      <button
        type="button"
        className={cn(
          'social-reaction-action-button inline-flex h-7 items-center justify-center gap-1.5 rounded-full px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-55',
          myReaction && 'text-primary',
          className,
        )}
        onClick={handleActionClick}
        onMouseEnter={openPicker}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onPointerLeave={handlePointerEnd}
        disabled={disabled}
        aria-label={label}
        aria-pressed={myReaction !== null}
        aria-haspopup="menu"
        aria-expanded={pickerOpen}
      >
        {showIcon ? (
          myReaction ? (
            <span aria-hidden="true">{REACTION_EMOJIS[myReaction]}</span>
          ) : (
            <ThumbsUp className="h-4 w-4" aria-hidden="true" />
          )
        ) : (
          myReaction && (
            <span aria-hidden="true">{REACTION_EMOJIS[myReaction]}</span>
          )
        )}
        <span>{label}</span>
      </button>

      {pickerOpen && (
        <div
          className="social-reaction-picker"
          role="menu"
          aria-label="Wybierz reakcję"
          onMouseEnter={openPicker}
          onMouseLeave={closePickerSoon}
        >
          {REACTION_TYPES.map((reaction) => (
            <button
              key={reaction}
              type="button"
              role="menuitem"
              className={cn(
                'social-reaction-picker-option',
                myReaction === reaction && 'is-selected',
              )}
              onClick={() => handlePickerSelect(reaction)}
              aria-label={REACTION_LABELS[reaction]}
            >
              <span aria-hidden="true">{REACTION_EMOJIS[reaction]}</span>
            </button>
          ))}
        </div>
      )}
    </span>
  );
}
