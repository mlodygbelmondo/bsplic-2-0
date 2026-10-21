import { type ReactNode, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Monitor,
  RotateCcw,
  Sliders,
  Smartphone,
  Tablet,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type DeviceViewportMode = 'responsive' | 'mobile' | 'tablet';

interface JackpotDevOverlayProps {
  activeScreen: 'home' | 'draw';
  onSetScreen: (screen: 'home' | 'draw') => void;
  viewportMode: DeviceViewportMode;
  onSetViewportMode: (mode: DeviceViewportMode) => void;
  userTicketCount: number;
  onSetUserTicketCount: (count: number) => void;
  prizeAmount: number;
  onSetPrizeAmount: (amount: number) => void;
  isUserWinner: boolean;
  onSetIsUserWinner: (winner: boolean) => void;
  onResetAll: () => void;
}

const VIEWPORT_OPTIONS = [
  { mode: 'responsive', label: 'Pełna responsywność', Icon: Monitor },
  { mode: 'mobile', label: 'Telefon (390 px)', Icon: Smartphone },
  { mode: 'tablet', label: 'Tablet (768 px)', Icon: Tablet },
] as const;

function SegmentButton({
  active,
  onClick,
  children,
  label,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  label?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        'flex-1 rounded-md px-3 py-1.5 text-xs font-bold transition',
        active
          ? 'bg-amber-500 text-black shadow'
          : 'text-zinc-400 hover:text-white',
      )}
    >
      {children}
    </button>
  );
}

function ControlGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
        {title}
      </span>
      <div className="flex rounded-lg border border-white/10 bg-black/50 p-0.5">
        {children}
      </div>
    </div>
  );
}

/** Dev-only controls for the /dev/jackpot playground. */
export function JackpotDevOverlay({
  activeScreen,
  onSetScreen,
  viewportMode,
  onSetViewportMode,
  userTicketCount,
  onSetUserTicketCount,
  prizeAmount,
  onSetPrizeAmount,
  isUserWinner,
  onSetIsUserWinner,
  onResetAll,
}: JackpotDevOverlayProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-[100] flex flex-col items-center">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="pointer-events-auto mb-2 flex items-center gap-2 rounded-full border border-amber-500/50 bg-black/90 px-4 py-2 text-xs font-black text-amber-300 shadow-2xl backdrop-blur-md transition hover:bg-zinc-900"
      >
        <Sliders className="h-4 w-4 text-amber-400" />
        Jackpot Lab
        {isOpen ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronUp className="h-4 w-4" />
        )}
      </button>

      {isOpen && (
        <div className="pointer-events-auto max-h-[65vh] w-full max-w-4xl overflow-y-auto rounded-t-2xl border-x border-t border-amber-500/40 bg-zinc-950/95 p-4 shadow-[0_-15px_40px_rgba(0,0,0,0.8)] backdrop-blur-xl">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <ControlGroup title="Widok">
              <SegmentButton
                active={activeScreen === 'home'}
                onClick={() => onSetScreen('home')}
              >
                Strona główna
              </SegmentButton>
              <SegmentButton
                active={activeScreen === 'draw'}
                onClick={() => onSetScreen('draw')}
              >
                Losowanie
              </SegmentButton>
            </ControlGroup>

            <ControlGroup title="Ekran">
              {VIEWPORT_OPTIONS.map(({ mode, label, Icon }) => (
                <SegmentButton
                  key={mode}
                  active={viewportMode === mode}
                  onClick={() => onSetViewportMode(mode)}
                  label={label}
                >
                  <Icon className="mx-auto h-3.5 w-3.5" />
                </SegmentButton>
              ))}
            </ControlGroup>

            <ControlGroup title="Zwycięzca">
              <SegmentButton
                active={isUserWinner}
                onClick={() => onSetIsUserWinner(true)}
              >
                Ty
              </SegmentButton>
              <SegmentButton
                active={!isUserWinner}
                onClick={() => onSetIsUserWinner(false)}
              >
                Ktoś inny
              </SegmentButton>
            </ControlGroup>

            <ControlGroup title="Twoje tickety">
              {[0, 1, 2].map((count) => (
                <SegmentButton
                  key={count}
                  active={userTicketCount === count}
                  onClick={() => onSetUserTicketCount(count)}
                >
                  {count}
                </SegmentButton>
              ))}
            </ControlGroup>

            <ControlGroup title="Pula">
              {[2480.75, 25000, 100000].map((amount) => (
                <SegmentButton
                  key={amount}
                  active={prizeAmount === amount}
                  onClick={() => onSetPrizeAmount(amount)}
                >
                  {Math.round(amount).toLocaleString('pl-PL')} zł
                </SegmentButton>
              ))}
            </ControlGroup>

            <div className="flex items-end">
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={onResetAll}
                className="h-8 w-full text-xs"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
