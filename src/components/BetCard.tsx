import { memo, useMemo } from 'react';
import { CalendarClock, CircleDot, Sparkles, Trophy, Users } from 'lucide-react';

import { useCoupon } from '@/contexts/CouponContext';
import { cn } from '@/lib/utils';
import type { Bet, BetOption, Category } from '@/types/database';

interface BetCardProps {
  bet: Bet;
  category?: Category;
}

const MARKET_LABELS: Record<Bet['bet_type'], string> = {
  '1x2': '1X2',
  '12': 'Zwycięzca',
  multi: 'Rynek specjalny',
  single: 'Typ dnia',
};

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
  const selectedInCoupon = items.find((item) => item.bet.id === bet.id);
  const endTimestamp = useMemo(() => new Date(bet.ends_at).getTime(), [bet.ends_at]);
  const isExpired = Number.isFinite(endTimestamp) && endTimestamp <= Date.now();
  const isInProgress = isExpired && bet.winning_option === null;
  const isResolved = isExpired && bet.winning_option !== null;
  const endsAtLabel = useMemo(() => formatBetDate(bet.ends_at), [bet.ends_at]);
  const options = useMemo(
    () => (Array.isArray(bet.options) ? (bet.options as BetOption[]) : []),
    [bet.options],
  );
  const isBsplicboost = Boolean(bet.is_bsplicboost);
  const marketLabel = MARKET_LABELS[bet.bet_type] ?? 'Rynek';
  const useTwoColumnMultiLayout = bet.bet_type === 'multi' && (options.length === 4 || options.length === 5);
  const useThreeColumnMultiLayout = bet.bet_type === 'multi' && options.length >= 6;
  const shouldCenterLastMultiOption = useTwoColumnMultiLayout && options.length % 2 === 1;
  const totalImpliedProbability = useMemo(
    () => options.reduce((sum, option) => sum + (option.odds > 0 ? 1 / option.odds : 0), 0),
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

  const statusLabel = isInProgress
    ? 'W trakcie'
    : isResolved
      ? 'Zakończone'
      : bet.is_live
        ? 'Przyjmowanie typów live'
        : 'Przyjmowanie typów';

  return (
    <article
      className={cn(
        'sportsbook-event-card overflow-hidden rounded-lg border border-white/10 transition-shadow hover:card-shadow-hover',
        isBsplicboost && 'sportsbook-event-card-boost border-red-300/35',
        bet.is_live && 'border-primary/45 ring-1 ring-primary/25',
      )}
    >
      <div className="relative z-10 flex items-start justify-between gap-3 border-b border-white/10 px-3 py-2">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-muted-foreground">
              <Trophy className="h-3 w-3" />
              {marketLabel}
            </span>
            {category && (
              <span className="inline-flex min-w-0 items-center gap-1 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-muted-foreground">
                <span>{category.emoji}</span>
                <span className="truncate">{category.name}</span>
              </span>
            )}
            {isBsplicboost && (
              <span className="inline-flex items-center gap-1 rounded bg-[#f6bf2b]/20 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#f6bf2b] ring-1 ring-[#f6bf2b]/20">
                <Sparkles className="h-3 w-3" /> Boost
              </span>
            )}
            {bet.is_live && (
              <span className="inline-flex items-center gap-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-primary-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground pulse-live" />
                LIVE
              </span>
            )}
          </div>
          <h3 className="line-clamp-2 text-[15px] font-black leading-tight text-foreground sm:text-[16px]">
            {bet.title}
          </h3>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1 text-right">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground" title={bet.ends_at}>
            <CalendarClock className="h-3 w-3" />
            {endsAtLabel}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
            <Users className="h-3 w-3" />
            {bet.bet_count}
          </span>
        </div>
      </div>

      <div className="relative z-10 px-3 py-2.5">
        <div className="mb-2 flex min-h-5 items-center justify-between gap-3">
          <div
            className={cn(
              'flex items-center gap-1 text-[11px] font-black uppercase tracking-wide',
              isInProgress ? 'text-red-300' : isResolved ? 'text-muted-foreground' : 'text-muted-foreground',
            )}
          >
            <CircleDot className={cn('h-3.5 w-3.5', isInProgress && 'animate-pulse text-red-300', bet.is_live && !isInProgress && 'text-primary', !bet.is_live && !isInProgress && !isResolved && 'text-[#f6bf2b]')} />
            {statusLabel}
          </div>
          <span className="shrink-0 text-[10px] font-black uppercase tracking-wide text-muted-foreground">
            Kursy
          </span>
        </div>

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
          {options.map((option, index) => {
            const isSelected = selectedInCoupon?.selectedOption === option.name;
            const isCenteredLastMultiOption = shouldCenterLastMultiOption && index === options.length - 1;
            return (
              <button
                key={option.name}
                onClick={() => handleSelect(option)}
                disabled={isExpired || !bet.is_active}
                aria-pressed={isSelected}
                className={cn(
                  'odds-chip relative flex min-h-[52px] flex-col items-start justify-center rounded-md border px-2 py-2 text-left text-[12px] font-black transition-all',
                  isCenteredLastMultiOption && 'col-span-2 w-[48%] justify-self-center',
                  isSelected
                    ? 'odds-chip-selected border-[#f6bf2b] bg-[#121212] shadow-[0_0_0_1px_rgba(246,191,43,0.42),0_12px_24px_rgba(0,0,0,0.28)]'
                    : 'border-[#f6bf2b]/20 bg-[#f6bf2b] text-zinc-950 hover:brightness-105',
                  (isExpired || !bet.is_active) && 'cursor-not-allowed opacity-40',
                )}
              >
                <span
                  className={cn(
                    'mb-0.5 w-full truncate text-[11px] leading-tight transition-colors duration-200',
                    isSelected ? 'text-[#f6bf2b]' : 'text-zinc-900',
                  )}
                >
                  {option.name}
                </span>
                <span
                  className={cn(
                    'text-[16px] font-black leading-none transition-colors duration-200',
                    isSelected ? 'text-[#f6bf2b]' : 'text-zinc-950',
                  )}
                >
                  {option.odds.toFixed(2)}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex h-[3px] overflow-hidden rounded-full bg-white/[0.08]">
          {options.map((option, index) => {
            const probability =
              option.odds > 0 && totalImpliedProbability > 0
                ? (1 / option.odds) / totalImpliedProbability
                : 0;
            const colors = ['bg-primary', 'bg-[#f6bf2b]', 'bg-success', 'bg-cyan-400'];
            return (
              <div
                key={option.name}
                className={cn(colors[index % colors.length])}
                style={{ width: `${probability * 100}%` }}
              />
            );
          })}
        </div>
      </div>
    </article>
  );
});

BetCard.displayName = 'BetCard';
