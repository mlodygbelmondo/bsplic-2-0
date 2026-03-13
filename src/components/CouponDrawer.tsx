import { useState } from 'react';
import { useCoupon } from '@/contexts/CouponContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Ticket, Trash2, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function CouponDrawer() {
  const { items, removeItem, clearCoupon, totalOdds, couponType } = useCoupon();
  const { user, profile, refreshProfile } = useAuth();
  const [stake, setStake] = useState('10');
  const [placing, setPlacing] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'single' | 'ako'>('single');

  const effectiveTotalOdds = activeTab === 'ako' ? totalOdds : (items[0]?.odds || 1);
  const potentialWin = Number(stake) * effectiveTotalOdds;

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
      const { data: coupon, error: couponErr } = await supabase
        .from('coupons')
        .insert({ user_id: user.id, total_odds: effectiveTotalOdds, stake: stakeNum, status: 'pending' })
        .select().single();
      if (couponErr) throw couponErr;

      const placedBets = items.map(item => ({
        user_id: user.id,
        bet_id: item.bet.id,
        selected_option: item.selectedOption,
        stake: activeTab === 'single' ? stakeNum : stakeNum / items.length,
        odds_at_time: item.odds,
        coupon_id: coupon.id,
      }));

      const { error: betsErr } = await supabase.from('placed_bets').insert(placedBets);
      if (betsErr) throw betsErr;

      await supabase.from('profiles').update({ balance: Number(profile.balance) - stakeNum }).eq('id', user.id);
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

  return (
    <>
      {/* Mobile floating button */}
      {items.length > 0 && (
        <button
          onClick={() => setOpen(!open)}
          className="lg:hidden fixed bottom-4 right-4 z-50 gradient-primary text-primary-foreground rounded-full h-14 w-14 shadow-xl flex items-center justify-center"
        >
          <div className="relative">
            <Ticket className="h-6 w-6" />
            <span className="absolute -top-2 -right-2 bg-card text-foreground text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center">
              {items.length}
            </span>
          </div>
        </button>
      )}

      {/* Right panel - always visible on desktop */}
      <aside className={cn(
        'w-[320px] shrink-0 border-l border-border bg-card',
        'fixed lg:sticky right-0 top-12 bottom-0 z-40 lg:z-auto transition-transform',
        'lg:translate-x-0 max-h-[calc(100vh-3rem)] overflow-y-auto',
        items.length === 0 && !open ? 'translate-x-full' : open ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
      )}>
        <div className="p-4 h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-base">
              {items.length} {items.length === 1 ? 'zdarzenie' : items.length < 5 ? 'zdarzenia' : 'zdarzeń'}
            </h3>
            <div className="flex items-center gap-1">
              <button onClick={clearCoupon} className="p-1 text-muted-foreground hover:text-destructive rounded">
                <Trash2 className="h-4 w-4" />
              </button>
              <button className="p-1 text-muted-foreground rounded">
                <MoreHorizontal className="h-4 w-4" />
              </button>
              <button onClick={() => setOpen(false)} className="lg:hidden p-1 text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Tabs: Pojedyncze / AKO */}
          <div className="flex border-b border-border mb-4">
            <button
              onClick={() => setActiveTab('single')}
              className={cn('flex-1 pb-2 text-sm font-semibold text-center border-b-2 transition-colors',
                activeTab === 'single' ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground'
              )}
            >
              Pojedyncze
            </button>
            <button
              onClick={() => setActiveTab('ako')}
              className={cn('flex-1 pb-2 text-sm font-semibold text-center border-b-2 transition-colors',
                activeTab === 'ako' ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground'
              )}
            >
              AKO
            </button>
          </div>

          {/* Items */}
          {items.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-muted-foreground text-center">Dodaj zdarzenia do kuponu</p>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                {items.map(item => (
                  <div key={item.bet.id} className="relative border-b border-border pb-3 last:border-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0 pr-6">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <span>⚽</span> {item.bet.title}
                        </p>
                        <p className="font-bold text-sm mt-1">{item.selectedOption}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.bet.title}
                        </p>
                      </div>
                      <button
                        onClick={() => removeItem(item.bet.id)}
                        className="absolute top-0 right-0 text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="space-y-3 pt-3 border-t border-border">
                {items.length > 0 && (
                  <div className="text-xs text-primary text-center">
                    {activeTab === 'ako' 
                      ? `Współczynnik ${effectiveTotalOdds.toFixed(2)}`
                      : `Kurs ${effectiveTotalOdds.toFixed(2)}`
                    }
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Potencjalna wygrana:</span>
                  <span className="text-lg font-bold text-success">{potentialWin.toFixed(2)} zł</span>
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={stake}
                    onChange={e => setStake(e.target.value)}
                    min={1}
                    className="bg-muted text-center font-bold"
                    placeholder="Stawka"
                  />
                </div>

                <Button
                  onClick={placeBet}
                  disabled={placing || items.length === 0}
                  className="w-full gradient-primary text-primary-foreground font-bold h-11 text-sm rounded-lg"
                >
                  {placing ? 'Stawianie...' : 'Obstaw'}
                </Button>
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
