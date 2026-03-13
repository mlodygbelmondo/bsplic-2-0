import { useEffect, useState } from 'react';
import { Bet, BetOption, Category } from '@/types/database';
import { useCoupon } from '@/contexts/CouponContext';
import { cn } from '@/lib/utils';
import { Users } from 'lucide-react';

interface BetCardProps {
  bet: Bet;
  category?: Category;
}

function useCountdown(endsAt: string) {
  const [timeLeft, setTimeLeft] = useState('');
  useEffect(() => {
    const update = () => {
      const diff = new Date(endsAt).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft('Zakończony'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setTimeLeft(`${h}:${m.toString().padStart(2, '0')}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [endsAt]);
  return timeLeft;
}

export function BetCard({ bet, category }: BetCardProps) {
  const countdown = useCountdown(bet.ends_at);
  const { items, addItem, removeItem } = useCoupon();
  const selectedInCoupon = items.find(i => i.bet.id === bet.id);
  const isExpired = new Date(bet.ends_at).getTime() <= Date.now();
  const options = (bet.options as unknown as BetOption[]) || [];

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
        <div className="flex items-center justify-center gap-3 mb-3">
          <span className="font-bold text-[13px] text-foreground text-right flex-1">{options[0]?.name || ''}</span>
          <span className="text-[11px] text-muted-foreground font-medium px-1.5">{countdown}</span>
          <span className="font-bold text-[13px] text-foreground text-left flex-1">{options.length >= 2 ? options[options.length - 1]?.name : ''}</span>
        </div>

        {(bet.bet_type === 'multi' || options.length > 3) && (
          <p className="text-[12px] text-muted-foreground text-center mb-2">{bet.title}</p>
        )}

        {/* Odds buttons */}
        <div className={cn('grid gap-1.5', options.length === 3 ? 'grid-cols-3' : options.length === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3')}>
          {options.map((opt) => {
            const isSelected = selectedInCoupon?.selectedOption === opt.name;
            return (
              <button
                key={opt.name}
                onClick={() => handleSelect(opt)}
                disabled={isExpired || !bet.is_active}
                className={cn(
                  'flex flex-col items-center py-2 px-1.5 rounded-md text-[12px] font-semibold transition-all relative',
                  isSelected
                    ? 'odds-selected shadow-md'
                    : 'odds-green hover:brightness-110',
                  (isExpired || !bet.is_active) && 'opacity-40 cursor-not-allowed'
                )}
              >
                <span className="text-[10px] opacity-80 mb-0.5 truncate w-full text-center">{opt.name}</span>
                <span className="text-[15px] font-bold">{opt.odds.toFixed(2)}</span>
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
