import { useEffect, useState } from 'react';
import { useCoupon } from '@/contexts/CouponContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Ticket, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function CouponDrawer() {
  const { items, removeItem, clearCoupon, totalOdds } = useCoupon();
  const { user, profile, refreshProfile } = useAuth();
  const [stake, setStake] = useState('10');
  const [placing, setPlacing] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'single' | 'ako'>('single');

  useEffect(() => {
    if (items.length === 0) setOpen(false);
  }, [items.length]);

  const effectiveTotalOdds = activeTab === 'ako' ? totalOdds : items[0]?.odds || 1;
  const potentialWin = Number(stake) * effectiveTotalOdds;

  const placeBet = async () => {
    if (!user || !profile) {
      toast.error('Zaloguj się');
      return;
    }

    const stakeNum = Number(stake);
    if (stakeNum <= 0 || stakeNum > Number(profile.balance)) {
      toast.error('Niewystarczające środki');
      return;
    }

    setPlacing(true);

    try {
      const { data: coupon, error: couponErr } = await supabase
        .from('coupons')
        .insert({ user_id: user.id, total_odds: effectiveTotalOdds, stake: stakeNum, status: 'pending' })
        .select()
        .single();

      if (couponErr) throw couponErr;

      const placedBets = items.map((item) => ({
        user_id: user.id,
        bet_id: item.bet.id,
        selected_option: item.selectedOption,
        stake: activeTab === 'single' ? stakeNum : stakeNum / items.length,
        odds_at_time: item.odds,
        coupon_id: coupon.id,
      }));

      const { error: betsErr } = await supabase.from('placed_bets').insert(placedBets);
      if (betsErr) throw betsErr;

      await supabase
        .from('profiles')
        .update({ balance: Number(profile.balance) - stakeNum })
        .eq('id', user.id);

      await refreshProfile();
      clearCoupon();
      setStake('10');
      setOpen(false);
      toast.success('🎰 Kupon postawiony pomyślnie!');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setPlacing(false);
    }
  };

  const drawerContent = (
    <div className="h-full flex flex-col">
      <div className="lg:hidden flex justify-center py-2">
        <div className="h-1 w-12 rounded-full bg-muted-foreground/30" />
      </div>

      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
        <h3 className="text-[13px] font-bold">
          {items.length} {items.length === 1 ? 'zdarzenie' : items.length < 5 ? 'zdarzenia' : 'zdarzeń'}
        </h3>
        <div className="flex items-center gap-1">
          <button className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors">
            <MoreHorizontal className="h-4 w-4" />
          </button>
          <button onClick={() => setOpen(false)} className="lg:hidden p-1 text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('single')}
          className={cn(
            'flex-1 py-2 text-[12px] font-semibold text-center border-b-2 -mb-[1px] transition-colors',
            activeTab === 'single' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground'
          )}
        >
          Pojedyncze
        </button>
        <button
          onClick={() => setActiveTab('ako')}
          className={cn(
            'flex-1 py-2 text-[12px] font-semibold text-center border-b-2 -mb-[1px] transition-colors',
            activeTab === 'ako' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground'
          )}
        >
          AKO
        </button>
      </div>

      {items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center px-4">
          <p className="text-[12px] text-muted-foreground text-center">Dodaj zdarzenia do kuponu klikając na kursy.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
          {items.map((item) => (
            <div key={item.bet.id} className="relative border-b border-border pb-2 last:border-0">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 pr-5">
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1 mb-0.5">⚽ {item.bet.title}</p>
                  <p className="font-bold text-[13px]">{item.selectedOption}</p>
                  <span className="inline-block mt-1 text-primary text-[11px] font-bold">{item.odds.toFixed(2)}</span>
                </div>
                <button
                  onClick={() => removeItem(item.bet.id)}
                  className="absolute top-0 right-0 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-border p-3 space-y-2 mt-auto">
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-muted-foreground">Potencjalna wygrana:</span>
          <span className="text-[15px] font-bold text-success">{potentialWin.toFixed(2)} zł</span>
        </div>
        <div className="text-[11px] text-muted-foreground">Współczynnik {effectiveTotalOdds.toFixed(2)}</div>
        <Input
          type="number"
          value={stake}
          onChange={(event) => setStake(event.target.value)}
          min={1}
          className="text-center font-bold text-[13px] h-9 bg-muted border-border"
          placeholder="Stawka (zł)"
        />
        <Button
          onClick={placeBet}
          disabled={placing || items.length === 0}
          className="w-full gradient-primary text-primary-foreground font-bold h-10 text-[13px] rounded-md"
        >
          {placing ? 'Stawianie...' : 'Obstaw'}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {items.length > 0 && !open && (
        <button
          onClick={() => setOpen(true)}
          className="lg:hidden fixed bottom-4 right-4 z-[80] gradient-primary text-primary-foreground rounded-full h-16 w-16 shadow-2xl flex items-center justify-center"
          style={{ WebkitTapHighlightColor: 'transparent' }}
          aria-label="Otwórz kupon"
        >
          <div className="relative">
            <Ticket className="h-6 w-6" />
            <span className="absolute -top-2 -right-2 bg-card text-foreground text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center shadow">
              {items.length}
            </span>
          </div>
        </button>
      )}

      {open && (
        <>
          <div className="lg:hidden fixed inset-0 z-[70] bg-foreground/50" onClick={() => setOpen(false)} />
          <aside className="lg:hidden fixed inset-x-0 bottom-0 z-[81] bg-card border-t border-border rounded-t-2xl card-shadow h-[min(82vh,640px)] max-h-[82vh]">
            {drawerContent}
          </aside>
        </>
      )}

      <aside className="hidden lg:flex w-[300px] shrink-0 bg-card border-l border-border card-shadow sticky top-[2.75rem] h-[calc(100vh-2.75rem)]">
        {drawerContent}
      </aside>
    </>
  );
}
