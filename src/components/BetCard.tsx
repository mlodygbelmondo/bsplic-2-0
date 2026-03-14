import { useMemo } from 'react';
import { Bet, BetOption, Category } from '@/types/database';
import { useCoupon } from '@/contexts/CouponContext';
import { cn } from '@/lib/utils';
import { Users } from 'lucide-react';

interface BetCardProps {
  bet: Bet;
  category?: Category;
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

export function BetCard({ bet, category }: BetCardProps) {
  const { items, addItem, removeItem } = useCoupon();
  const selectedInCoupon = items.find(i => i.bet.id === bet.id);
  const endTimestamp = useMemo(() => new Date(bet.ends_at).getTime(), [bet.ends_at]);
  const isExpired = Number.isFinite(endTimestamp) && endTimestamp <= Date.now();
  const endsAtLabel = useMemo(() => formatBetDate(bet.ends_at), [bet.ends_at]);
  const options = (bet.options as unknown as BetOption[]) || [];
  const useTwoColumnMultiLayout = bet.bet_type === 'multi' && (options.length === 4 || options.length === 5);
  const useThreeColumnMultiLayout = bet.bet_type === 'multi' && options.length >= 6;
  const shouldCenterLastMultiOption = useTwoColumnMultiLayout && options.length % 2 === 1;

  const handleSelect = (option: BetOption) => {
    if (isExpired || !bet.is_active) return;
    if (selectedInCoupon?.selectedOption === option.name) {
      removeItem(bet.id);
    } else {
      addItem({ bet, selectedOption: option.name, odds: option.odds });
    }
  };

  return (
    <div className={cn(
      'bg-card rounded-lg overflow-hidden card-shadow transition-shadow hover:card-shadow-hover',
      bet.is_live && 'ring-1 ring-primary/30'
    )}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b border-border">
        <div className="flex items-center gap-1.5">
          {category && (
            <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
              <span>{category.emoji}</span> {category.name}
            </span>
          )}
          {bet.is_live && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-primary-foreground ml-1 gradient-primary px-1.5 py-0.5 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground pulse-live" />
              LIVE
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-0.5"><Users className="h-3 w-3" /> {bet.bet_count}</span>
        </div>
      </div>

      {/* Match content */}
      <div className="px-3 py-2.5">
        <div className="mb-3 text-center">
          <p className="font-bold text-base sm:text-lg text-foreground leading-tight">{bet.title}</p>
          <p className="text-[11px] text-muted-foreground font-medium mt-1" title={bet.ends_at}>{endsAtLabel}</p>
        </div>

        {/* Odds buttons */}
        <div
          className={cn(
            'grid gap-1.5',
            useTwoColumnMultiLayout
              ? 'grid-cols-2'
              : useThreeColumnMultiLayout
                ? 'grid-cols-3'
                : options.length === 3
                  ? 'grid-cols-3'
                  : options.length === 2
                    ? 'grid-cols-2'
                    : 'grid-cols-2 sm:grid-cols-3'
          )}
        >
          {options.map((opt, index) => {
            const isSelected = selectedInCoupon?.selectedOption === opt.name;
            const isCenteredLastMultiOption = shouldCenterLastMultiOption && index === options.length - 1;
            return (
              <button
                key={opt.name}
                onClick={() => handleSelect(opt)}
                disabled={isExpired || !bet.is_active}
                className={cn(
                  'odds-chip flex flex-col items-center py-2 px-1.5 rounded-md text-[12px] font-semibold transition-all relative',
                  isCenteredLastMultiOption && 'col-span-2 justify-self-center w-[48%]',
                  isSelected
                    ? 'odds-selected odds-chip-selected shadow-md'
                    : 'odds-yellow hover:brightness-105',
                  (isExpired || !bet.is_active) && 'opacity-40 cursor-not-allowed'
                )}
              >
                <span
                  className={cn(
                    'text-[10px] mb-0.5 truncate w-full text-center transition-colors duration-200',
                    isSelected ? 'text-[#f6bf2b]' : index % 2 === 0 ? 'text-zinc-900' : 'text-zinc-800'
                  )}
                >
                  {opt.name}
                </span>
                <span
                  className={cn(
                    'text-[15px] font-bold transition-colors duration-200',
                    isSelected ? 'text-[#f6bf2b]' : index % 2 === 0 ? 'text-zinc-950' : 'text-zinc-900'
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
            const totalOdds = options.reduce((sum, o) => sum + (1 / o.odds), 0);
            const probability = (1 / opt.odds) / totalOdds;
            const colors = ['bg-primary', 'bg-muted-foreground/30', 'bg-success'];
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
}
