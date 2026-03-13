import { useEffect, useState } from 'react';
import { Bet, BetOption, Category } from '@/types/database';
import { useCoupon } from '@/contexts/CouponContext';
import { cn } from '@/lib/utils';
import { Clock, Users, Zap } from 'lucide-react';

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
      'rounded-xl border p-4 transition-all',
      bet.is_live
        ? 'bg-[hsl(var(--bet-card-live))] text-[hsl(var(--bet-card-live-foreground))] border-primary/30'
        : 'bg-card border-border'
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {category && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: category.color + '22', color: category.color }}>
              {category.emoji} {category.name}
            </span>
          )}
          {bet.is_live && (
            <span className="flex items-center gap-1 text-xs font-bold text-primary">
              <span className="h-2 w-2 rounded-full bg-primary pulse-live" />
              LIVE
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {bet.bet_count}</span>
        </div>
      </div>

      <h3 className="font-bold text-base mb-3">{bet.title}</h3>

      <div className="flex items-center gap-1 mb-3 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />
        <span>Koniec za: <span className={cn(bet.is_live && 'text-primary font-bold countdown-glow')}>{countdown}</span></span>
      </div>

      <div className={cn('grid gap-2', options.length === 3 ? 'grid-cols-3' : options.length === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3')}>
        {options.map((opt) => {
          const isSelected = selectedInCoupon?.selectedOption === opt.name;
          return (
            <button
              key={opt.name}
              onClick={() => handleSelect(opt)}
              disabled={isExpired || !bet.is_active}
              className={cn(
                'flex flex-col items-center p-3 rounded-lg border text-sm font-medium transition-all',
                isSelected
                  ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/25'
                  : 'bg-odds-button text-odds-button-foreground border-border hover:border-primary/50',
                (isExpired || !bet.is_active) && 'opacity-50 cursor-not-allowed'
              )}
            >
              <span className="text-xs text-muted-foreground mb-1 truncate w-full text-center">{opt.name}</span>
              <span className="text-lg font-bold">{opt.odds.toFixed(2)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
