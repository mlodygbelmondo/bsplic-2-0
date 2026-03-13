import { useEffect, useState } from 'react';
import { Bet, BetOption, Category } from '@/types/database';
import { useCoupon } from '@/contexts/CouponContext';
import { cn } from '@/lib/utils';
import { Clock, Users } from 'lucide-react';

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
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${h}h ${m}min ${s}s`);
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
      'rounded-xl border transition-all',
      bet.is_live
        ? 'bg-[hsl(220,20%,12%)] text-[hsl(0,0%,95%)] border-primary/20'
        : 'bg-card border-border'
    )}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
        <div className="flex items-center gap-2">
          {category && (
            <span className="text-xs font-medium flex items-center gap-1.5" style={{ color: category.color }}>
              {category.emoji} {category.name}
            </span>
          )}
          {bet.is_live && (
            <span className="flex items-center gap-1 text-[11px] font-bold text-primary ml-2">
              <span className="h-2 w-2 rounded-full bg-primary pulse-live" />
              LIVE
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {bet.bet_count}</span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span className={cn(bet.is_live && 'text-primary font-semibold')}>{countdown}</span>
          </span>
        </div>
      </div>

      {/* Match info */}
      <div className="px-4 py-3">
        <h3 className="font-bold text-sm mb-3">{bet.title}</h3>

        {/* Odds buttons - Betclic style */}
        <div className={cn('grid gap-2', options.length === 3 ? 'grid-cols-3' : options.length === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3')}>
          {options.map((opt) => {
            const isSelected = selectedInCoupon?.selectedOption === opt.name;
            return (
              <button
                key={opt.name}
                onClick={() => handleSelect(opt)}
                disabled={isExpired || !bet.is_active}
                className={cn(
                  'flex flex-col items-center py-2.5 px-2 rounded-lg text-sm font-medium transition-all border',
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary ring-2 ring-primary/30'
                    : bet.is_live
                      ? 'bg-[hsl(220,15%,18%)] border-[hsl(220,15%,22%)] hover:border-primary/50 text-[hsl(0,0%,95%)]'
                      : 'bg-muted border-border hover:border-primary/50',
                  (isExpired || !bet.is_active) && 'opacity-40 cursor-not-allowed'
                )}
              >
                <span className={cn('text-[10px] mb-0.5 truncate w-full text-center', 
                  isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'
                )}>{opt.name}</span>
                <span className="text-base font-bold">{opt.odds.toFixed(2)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
