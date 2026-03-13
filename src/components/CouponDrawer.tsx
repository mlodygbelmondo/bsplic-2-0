import { useState } from 'react';
import { useCoupon } from '@/contexts/CouponContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Ticket, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function CouponDrawer() {
  const { items, removeItem, clearCoupon, totalOdds, couponType } = useCoupon();
  const { user, profile, refreshProfile } = useAuth();
  const [stake, setStake] = useState('10');
  const [placing, setPlacing] = useState(false);
  const [open, setOpen] = useState(false);

  const potentialWin = Number(stake) * totalOdds;

  const placeBet = async () => {
    if (!user || !profile) {
      toast.error('Zaloguj się, aby postawić zakład');
      return;
    }
    const stakeNum = Number(stake);
    if (stakeNum <= 0 || stakeNum > Number(profile.balance)) {
      toast.error('Niewystarczające środki');
      return;
    }

    setPlacing(true);
    try {
      // Create coupon
      const { data: coupon, error: couponErr } = await supabase
        .from('coupons')
        .insert({
          user_id: user.id,
          total_odds: totalOdds,
          stake: stakeNum,
          status: 'pending',
        })
        .select()
        .single();
      if (couponErr) throw couponErr;

      // Create placed bets
      const placedBets = items.map(item => ({
        user_id: user.id,
        bet_id: item.bet.id,
        selected_option: item.selectedOption,
        stake: couponType === 'single' ? stakeNum : stakeNum / items.length,
        odds_at_time: item.odds,
        coupon_id: coupon.id,
      }));

      const { error: betsErr } = await supabase.from('placed_bets').insert(placedBets);
      if (betsErr) throw betsErr;

      // Deduct balance
      const { error: balErr } = await supabase
        .from('profiles')
        .update({ balance: Number(profile.balance) - stakeNum })
        .eq('id', user.id);
      if (balErr) throw balErr;

      await refreshProfile();
      clearCoupon();
      setStake('10');
      toast.success('🎰 Kupon postawiony pomyślnie!');
    } catch (err: any) {
      toast.error(err.message || 'Błąd podczas stawiania');
    } finally {
      setPlacing(false);
    }
  };

  if (items.length === 0) return null;

  return (
    <>
      {/* Mobile floating button */}
      <button
        onClick={() => setOpen(!open)}
        className="lg:hidden fixed bottom-4 right-4 z-50 gradient-primary text-primary-foreground rounded-full p-4 shadow-xl flex items-center gap-2"
      >
        <Ticket className="h-5 w-5" />
        <span className="font-bold">{items.length}</span>
      </button>

      {/* Drawer / Sidebar */}
      <div className={cn(
        'fixed lg:sticky lg:top-[3.5rem] right-0 bottom-0 z-40 w-80 bg-card border-l border-border shadow-xl transition-transform lg:translate-x-0 lg:h-[calc(100vh-3.5rem)]',
        open ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
      )}>
        <div className="p-4 h-full flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg">
              {items.length} {items.length === 1 ? 'zdarzenie' : 'zdarzenia'}
            </h3>
            <div className="flex gap-2">
              <button onClick={clearCoupon} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
              <button onClick={() => setOpen(false)} className="lg:hidden text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            <span className={cn('px-3 py-1 rounded-full text-xs font-bold', couponType === 'single' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
              Pojedyncze
            </span>
            <span className={cn('px-3 py-1 rounded-full text-xs font-bold', couponType === 'ako' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
              AKO
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 mb-4">
            {items.map(item => (
              <div key={item.bet.id} className="bg-muted rounded-lg p-3 relative">
                <button
                  onClick={() => removeItem(item.bet.id)}
                  className="absolute top-2 right-2 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
                <p className="text-xs text-muted-foreground truncate pr-6">{item.bet.title}</p>
                <p className="font-bold text-sm">{item.selectedOption}</p>
                <p className="text-primary font-bold text-sm">{item.odds.toFixed(2)}</p>
              </div>
            ))}
          </div>

          <div className="border-t border-border pt-4 space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Stawka (zł)</label>
              <Input
                type="number"
                value={stake}
                onChange={e => setStake(e.target.value)}
                min={1}
                className="bg-muted mt-1"
              />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Kurs łączny:</span>
              <span className="font-bold">{totalOdds.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">Potencjalna wygrana:</span>
              <span className="font-bold text-lg text-primary">{potentialWin.toFixed(2)} zł</span>
            </div>
            <Button
              onClick={placeBet}
              disabled={placing}
              className="w-full gradient-primary text-primary-foreground font-bold h-12 text-base"
            >
              {placing ? 'Stawianie...' : 'Postaw'}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
