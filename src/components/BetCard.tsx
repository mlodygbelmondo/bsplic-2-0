import { memo, useEffect, useMemo, useState } from 'react';
import { Bet, BetOption, Category } from '@/types/database';
import { useCoupon } from '@/contexts/CouponContext';
import { cn } from '@/lib/utils';
import { Sparkles, Users } from 'lucide-react';

interface BetCardProps {
  bet: Bet;
  category?: Category;
}

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

function formatTimeRemaining(remainingMs: number): string {
  const totalMinutes = Math.floor(remainingMs / 60_000);
  if (totalMinutes < 1) return 'za chwilę';
  if (totalMinutes < 60) return `za ${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `za ${hours} godz. ${minutes} min` : `za ${hours} godz.`;
}

function formatBetDate(endsAt: string) {
  const date = new Date(endsAt);

  if (Number.isNaN(date.getTime())) {
    return '--.-- --:--';
  }

  return new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(date)
    .replace(',', '');
}

export const BetCard = memo(function BetCard({ bet, category }: BetCardProps) {
  const { items, addItem, removeItem } = useCoupon();
  const selectedInCoupon = items.find((i) => i.bet.id === bet.id);
  const endTimestamp = useMemo(
    () => new Date(bet.ends_at).getTime(),
    [bet.ends_at],
  );
  const [now, setNow] = useState(() => Date.now());
  const isExpired = Number.isFinite(endTimestamp) && endTimestamp <= now;
  const remainingMs = endTimestamp - now;
  const endsSoon =
    Number.isFinite(endTimestamp) &&
    bet.is_active &&
    remainingMs > 0 &&
    remainingMs <= DAY_MS;

  useEffect(() => {
    if (!endsSoon) return;
    const intervalId = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(intervalId);
  }, [endsSoon]);

  const isInProgress = isExpired && bet.winning_option === null;
  const endsAtLabel = useMemo(() => formatBetDate(bet.ends_at), [bet.ends_at]);
  const options = useMemo(
    () => (bet.options as unknown as BetOption[]) || [],
    [bet.options],
  );
  const isBsplicboost = Boolean(bet.is_bsplicboost);
  const useTwoColumnMultiLayout =
    bet.bet_type === 'multi' && (options.length === 4 || options.length === 5);
  const useThreeColumnMultiLayout =
    bet.bet_type === 'multi' && options.length >= 6;
  const shouldCenterLastMultiOption =
    useTwoColumnMultiLayout && options.length % 2 === 1;
  const probabilityDenominator = useMemo(
    () =>
      options.reduce((sum, option) => {
        if (!Number.isFinite(option.odds) || option.odds <= 0) {
          return sum;
        }

        return sum + 1 / option.odds;
      }, 0),
    [options],
  );

  const handleSelect = (option: BetOption) => {
    if (isExpired || !bet.is_active) return;
    if (selectedInCoupon?.selectedOption === option.name) {
      removeItem(bet.id);
    } else {
      addItem({ bet, selectedOption: option.name, odds: option.odds });
    }
  };

  return (
    <div
      className={cn(
        'bg-card border border-border/60 rounded-lg overflow-hidden card-shadow transition-shadow hover:card-shadow-hover',
        isBsplicboost && 'bsplicboost-card border border-red-300/40',
        bet.is_live && 'ring-1 ring-primary/30',
      )}
    >
      {/* Top bar */}
      <div
        className={cn(
          'flex items-center justify-between px-3 py-1.5 border-b border-border',
          isBsplicboost ? 'bsplicboost-topbar' : 'bg-muted/50',
        )}
      >
        <div className="flex items-center gap-1.5">
          {category && (
            <span
              className={cn(
                'text-[11px] font-medium flex items-center gap-1',
                isBsplicboost ? 'text-red-100/90' : 'text-muted-foreground',
              )}
            >
              <span>{category.emoji}</span> {category.name}
            </span>
          )}
          {isBsplicboost && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100/20 px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-red-50 ring-1 ring-red-200/30">
              <Sparkles className="h-3 w-3" /> BSPLBOOST
            </span>
          )}
          {bet.is_live && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-primary-foreground ml-1 gradient-primary px-1.5 py-0.5 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground pulse-live" />
              LIVE
            </span>
          )}
        </div>
        <div
          className={cn(
            'flex items-center gap-2 text-[10px]',
            isBsplicboost ? 'text-red-100/90' : 'text-muted-foreground',
          )}
        >
          <span className="flex items-center gap-0.5">
            <Users className="h-3 w-3" /> {bet.bet_count}
          </span>
        </div>
      </div>

      {/* Match content */}
      <div className="px-3 py-2.5">
        <div className="mb-3 text-center">
          <p className="font-bold text-base sm:text-lg text-foreground leading-tight">
            {bet.title}
          </p>
          {isInProgress && (
            <div className="mt-1 flex items-center justify-center gap-1 text-red-500 text-sm font-medium">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              W trakcie
            </div>
          )}
          <p
            className="text-[12px] text-muted-foreground font-medium mt-1"
            title={bet.ends_at}
          >
            {endsAtLabel}
            {endsSoon && (
              <span
                className={cn(
                  'ml-1 font-semibold',
                  remainingMs <= HOUR_MS ? 'text-red-500' : 'text-amber-600',
                )}
              >
                · kończy się {formatTimeRemaining(remainingMs)}
              </span>
            )}
          </p>
        </div>

        {/* Odds buttons */}
        <div
          className={cn(
            'grid gap-1.5',
            useTwoColumnMultiLayout
              ? 'grid-cols-2'
              : useThreeColumnMultiLayout
                ? 'grid-cols-3'
                : options.length === 1
                  ? 'grid-cols-1'
                  : options.length === 3
                    ? 'grid-cols-3'
                    : options.length === 2
                      ? 'grid-cols-2'
                      : 'grid-cols-2 sm:grid-cols-3',
          )}
        >
          {options.map((opt, index) => {
            const isSelected = selectedInCoupon?.selectedOption === opt.name;
            const isCenteredLastMultiOption =
              shouldCenterLastMultiOption && index === options.length - 1;
            return (
              <button
                key={opt.name}
                onClick={() => handleSelect(opt)}
                disabled={isExpired || !bet.is_active}
                className={cn(
                  'odds-chip flex flex-col items-center py-2 px-1.5 rounded-md text-[12px] font-semibold transition-all relative',
                  isCenteredLastMultiOption &&
                    'col-span-2 justify-self-center w-[48%]',
                  isSelected
                    ? 'odds-selected odds-chip-selected shadow-md'
                    : 'odds-yellow hover:brightness-105',
                  (isExpired || !bet.is_active) &&
                    'opacity-40 cursor-not-allowed',
                )}
              >
                <span
                  className={cn(
                    'text-[12px] mb-0.5 truncate w-full text-center transition-colors duration-200',
                    isSelected
                      ? 'text-[#f6bf2b]'
                      : index % 2 === 0
                        ? 'text-zinc-900'
                        : 'text-zinc-800',
                  )}
                >
                  {opt.name}
                </span>
                <span
                  className={cn(
                    'text-[15px] font-bold transition-colors duration-200',
                    isSelected
                      ? 'text-[#f6bf2b]'
                      : index % 2 === 0
                        ? 'text-zinc-950'
                        : 'text-zinc-900',
                  )}
                >
                  {opt.odds.toFixed(2)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Probability bar */}
        <div className="flex mt-2 h-[3px] rounded-full overflow-hidden gap-0.5">
          {options.map((opt, i) => {
            const probability =
              probabilityDenominator > 0 &&
              Number.isFinite(opt.odds) &&
              opt.odds > 0
                ? 1 / opt.odds / probabilityDenominator
                : 0;
            const colors = [
              'bg-primary',
              'bg-muted-foreground/30',
              'bg-success',
            ];
            return (
              <div
                key={i}
                className={cn('rounded-full', colors[i % colors.length])}
                style={{ width: `${probability * 100}%` }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
});

BetCard.displayName = 'BetCard';
