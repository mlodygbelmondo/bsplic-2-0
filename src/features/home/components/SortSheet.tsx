import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, Flame, Sparkles, Timer, type LucideIcon } from 'lucide-react';

import { Switch } from '@/components/ui/switch';
import type { SortMode } from '@/features/home/hooks/sortBets';
import { SORT_OPTIONS } from '@/features/home/sortOptions';
import { cn } from '@/lib/utils';

const SORT_ICONS: Record<SortMode, LucideIcon> = {
  newest: Sparkles,
  popular: Flame,
  ending_soon: Timer,
};

// Matches .sort-sheet-panel[data-state="closed"] in index.css.
const CLOSE_ANIMATION_MS = 240;
// Lets the highlight slide to the picked option before the sheet goes away.
const SELECT_CLOSE_DELAY_MS = 220;
// h-14 option rows with gap-1 between them.
const OPTION_ROW_PX = 60;
const DRAG_START_PX = 6;
const DRAG_CLOSE_PX = 96;
const DRAG_CLOSE_VELOCITY = 0.5; // px per ms

interface DragState {
  pointerId: number;
  startY: number;
  lastY: number;
  lastTime: number;
  velocity: number;
  dragging: boolean;
}

interface SortSheetProps {
  open: boolean;
  onClose: () => void;
  sort: SortMode;
  onSortChange: (value: SortMode) => void;
  activeOnly: boolean;
  onToggleActiveOnly: () => void;
}

const stagger = (index: number) => ({ '--stagger': index }) as CSSProperties;

/**
 * Bottom sheet with the home sort modes and the active-only filter. It springs
 * up on open, slides back down on close and can be dragged down to dismiss.
 */
export function SortSheet({
  open,
  onClose,
  sort,
  onSortChange,
  activeOnly,
  onToggleActiveOnly,
}: SortSheetProps) {
  // Stays mounted while the close animation plays.
  const [rendered, setRendered] = useState(open);
  if (open && !rendered) {
    setRendered(true);
  }

  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const selectTimerRef = useRef<number | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (open || !rendered) return;
    const timer = window.setTimeout(() => setRendered(false), CLOSE_ANIMATION_MS);
    return () => window.clearTimeout(timer);
  }, [open, rendered]);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setDragOffset(sheetRef.current, 0, false);
    sheetRef.current?.focus({ preventScroll: true });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus({ preventScroll: true });
    };
  }, [open]);

  useEffect(
    () => () => {
      if (selectTimerRef.current !== null) window.clearTimeout(selectTimerRef.current);
    },
    [],
  );

  if (!rendered) return null;

  const state = open ? 'open' : 'closed';
  const selectedIndex = Math.max(
    0,
    SORT_OPTIONS.findIndex((option) => option.value === sort),
  );

  const handleSelect = (value: SortMode) => {
    if (value === sort) {
      onClose();
      return;
    }
    onSortChange(value);
    if (selectTimerRef.current !== null) window.clearTimeout(selectTimerRef.current);
    selectTimerRef.current = window.setTimeout(() => {
      selectTimerRef.current = null;
      onCloseRef.current();
    }, SELECT_CLOSE_DELAY_MS);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    suppressClickRef.current = false;
    if (!open) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      lastY: event.clientY,
      lastTime: event.timeStamp,
      velocity: 0,
      dragging: false,
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const offset = event.clientY - drag.startY;
    if (!drag.dragging) {
      if (offset < DRAG_START_PX) return;
      drag.dragging = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }

    const elapsed = event.timeStamp - drag.lastTime;
    if (elapsed > 0) drag.velocity = (event.clientY - drag.lastY) / elapsed;
    drag.lastY = event.clientY;
    drag.lastTime = event.timeStamp;
    // Pulling up past the resting point only gives a little.
    setDragOffset(sheetRef.current, offset > 0 ? offset : offset / 4, false);
  };

  const handlePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (!drag.dragging) return;

    suppressClickRef.current = true;
    const offset = event.clientY - drag.startY;
    if (offset > DRAG_CLOSE_PX || drag.velocity > DRAG_CLOSE_VELOCITY) {
      // The sheet slides out from where the finger left it.
      onClose();
    } else {
      setDragOffset(sheetRef.current, 0, true);
    }
  };

  // A drag that ends over an option must not also pick it.
  const handleClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current) return;
    suppressClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  return createPortal(
    <div className={cn('fixed inset-0 z-[70] lg:hidden', !open && 'pointer-events-none')}>
      <div
        aria-hidden="true"
        data-state={state}
        onClick={onClose}
        className="sort-sheet-backdrop absolute inset-0 touch-none bg-black/60"
      />
      <div data-state={state} className="sort-sheet-panel absolute inset-x-0 bottom-0">
        <div
          ref={sheetRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onClickCapture={handleClickCapture}
          className="-mb-8 touch-none select-none rounded-t-[28px] border-t border-border bg-card px-4 pb-[calc(2.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-16px_48px_rgba(0,0,0,0.5)] outline-none"
        >
          <div aria-hidden="true" className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-muted-foreground/30" />

          <h2
            id={titleId}
            className="sort-sheet-item mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
            style={stagger(0)}
          >
            Sortowanie
          </h2>

          <div role="radiogroup" aria-labelledby={titleId} className="relative flex flex-col gap-1">
            <span
              aria-hidden="true"
              className="sort-sheet-highlight pointer-events-none absolute inset-x-0 top-0 h-14 rounded-2xl border border-primary/40 bg-primary/15"
              style={{ transform: `translateY(${selectedIndex * OPTION_ROW_PX}px)` }}
            />
            {SORT_OPTIONS.map((option, index) => {
              const Icon = SORT_ICONS[option.value];
              const selected = option.value === sort;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => handleSelect(option.value)}
                  className="sort-sheet-item press-scale relative flex h-14 items-center gap-3 rounded-2xl px-3 text-left"
                  style={stagger(index + 1)}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors duration-200',
                      selected
                        ? 'sport-rail-glow bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold leading-tight text-foreground">
                      {option.label}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{option.hint}</span>
                  </span>
                  {selected && (
                    <Check aria-hidden="true" className="sort-sheet-check h-5 w-5 shrink-0 text-primary" />
                  )}
                </button>
              );
            })}
          </div>

          <div aria-hidden="true" className="sort-sheet-item my-3 h-px bg-border" style={stagger(4)} />

          <div className="sort-sheet-item flex h-14 items-center gap-3 px-3" style={stagger(5)}>
            <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted">
              <span
                className={cn(
                  'h-2 w-2 rounded-full transition-colors duration-200',
                  activeOnly ? 'bg-success shadow-[0_0_8px_hsl(var(--success))]' : 'bg-muted-foreground/50',
                )}
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold leading-tight text-foreground">Tylko aktywne</span>
              <span className="block truncate text-xs text-muted-foreground">
                Ukrywa zakłady w trakcie
              </span>
            </span>
            <Switch checked={activeOnly} onCheckedChange={onToggleActiveOnly} aria-label="Tylko aktywne" />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function setDragOffset(sheet: HTMLDivElement | null, offset: number, animate: boolean) {
  if (!sheet) return;
  sheet.style.transition = animate ? 'transform 280ms cubic-bezier(0.34, 1.3, 0.64, 1)' : 'none';
  sheet.style.transform = offset ? `translateY(${offset}px)` : '';
}
