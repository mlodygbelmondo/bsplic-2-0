import { useEffect, useMemo, useState } from 'react';
import { useCoupon } from '@/contexts/CouponContext';
import { useCouponPlacement } from '@/features/home/hooks/useCouponPlacement';
import { getCouponCategoryEmoji } from '@/features/coupons/categoryEmoji';
import { Input } from '@/components/ui/input';
import { X, Ticket } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Category } from '@/types/database';

interface CouponDrawerProps {
  categoryMap: Record<string, Category>;
}

export function CouponDrawer({ categoryMap }: CouponDrawerProps) {
  const { items, removeItem, clearCoupon, preferredCouponType, setPreferredCouponType } = useCoupon();
  const [stake, setStake] = useState('10');
  const [singleStakes, setSingleStakes] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [activeTab, setActiveTab] = useState<'single' | 'ako'>('single');
  const stakePresets = ['5', '10', '25', '50'];

  useEffect(() => {
    if (!preferredCouponType) {
      return;
    }

    setActiveTab(preferredCouponType);
    setPreferredCouponType(null);
  }, [preferredCouponType, setPreferredCouponType]);

  useEffect(() => {
    setSingleStakes((previous) => {
      const next: Record<string, string> = {};

      items.forEach((item) => {
        next[item.bet.id] = previous[item.bet.id] ?? '10';
      });

      return next;
    });
  }, [items]);

  const { placing, placeBet, potentialWin, effectiveTotalOdds, totalStake } = useCouponPlacement(
    activeTab,
    stake,
    singleStakes,
    () => {
      setStake('10');
      setSingleStakes({});
      handleClose();
    }
  );

  const handleClose = () => {
    setIsClosing(true);
    window.setTimeout(() => {
      setOpen(false);
      setIsClosing(false);
    }, 220);
  };

  const eventsLabel = useMemo(() => {
    if (items.length === 1) {
      return 'zdarzenie';
    }
    if (items.length < 5) {
      return 'zdarzenia';
    }
    return 'zdarzeń';
  }, [items.length]);

  const hasItems = items.length > 0;

  const drawerContent = (
    <div className="h-full min-h-0 flex flex-col">
      <div className="lg:hidden flex justify-center py-2.5 border-b border-border/70 shrink-0">
        <div className="h-1 w-12 rounded-full bg-muted-foreground/30" aria-hidden="true" />
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <h3 className="text-[13px] font-bold">
          {items.length} {eventsLabel}
        </h3>
        <div className="flex items-center gap-1.5">
          {items.length > 0 && (
            <button
              onClick={clearCoupon}
              className="text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              Wyczyść
            </button>
          )}
          <button
            onClick={handleClose}
            className="lg:hidden p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Zamknij kupon"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="px-3 py-2 border-b border-border shrink-0">
        <div className="grid grid-cols-2 rounded-lg bg-muted p-0.5">
          <button
            onClick={() => setActiveTab('single')}
            className={cn(
              'py-1.5 text-[13px] font-semibold text-center rounded-md transition-colors',
              activeTab === 'single' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            )}
          >
            Pojedyncze
          </button>
          <button
            onClick={() => setActiveTab('ako')}
            className={cn(
              'py-1.5 text-[13px] font-semibold text-center rounded-md transition-colors',
              activeTab === 'ako' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            )}
          >
            AKO
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3">
        {items.length === 0 ? (
          <div className="h-full flex items-center justify-center px-2">
            <p className="text-[12px] text-muted-foreground text-center max-w-[240px]">
              Dodaj zdarzenia do kuponu klikając na kursy.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {items.map((item) => (
              <article key={item.bet.id} className="rounded-xl border border-border bg-background/60 p-2.5">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-muted-foreground truncate">
                      {getCouponCategoryEmoji(item.bet.category_id, categoryMap)} {item.bet.title}
                    </p>
                    <p className="font-bold text-[13px] leading-snug mt-0.5">{item.selectedOption}</p>
                    <span className="inline-block mt-1 text-[11px] font-bold text-primary">{item.odds.toFixed(2)}</span>
                    {activeTab === 'single' && (
                      <div className="mt-2.5 grid grid-cols-[auto_1fr_auto] items-center gap-2">
                        <span className="text-[11px] text-muted-foreground">Stawka</span>
                        <Input
                          type="number"
                          min={0.01}
                          step={0.01}
                          value={singleStakes[item.bet.id] ?? ''}
                          onChange={(event) =>
                            setSingleStakes((previous) => ({
                              ...previous,
                              [item.bet.id]: event.target.value,
                            }))
                          }
                          className="h-8 text-base md:text-[12px] font-semibold text-center bg-muted border-border"
                          placeholder="0.00"
                        />
                        <span className="text-[11px] text-muted-foreground">zł</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => removeItem(item.bet.id)}
                    className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    aria-label="Usuń zdarzenie"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-border p-3 space-y-2.5 shrink-0 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85">
        <div className="flex items-center justify-between">
          <span className="text-[14px] text-muted-foreground">Potencjalna wygrana</span>
          <span className="text-[15px] font-bold text-success">{potentialWin.toFixed(2)} zł</span>
        </div>
        {activeTab === 'ako' ? (
          <>
            <div className="text-[11px] text-muted-foreground">Współczynnik {effectiveTotalOdds.toFixed(2)}</div>
            <Input
              type="number"
              value={stake}
              onChange={(event) => setStake(event.target.value)}
              min={0.01}
              step={0.01}
              className="text-center font-bold text-base md:text-[13px] h-9 bg-muted border-border"
              placeholder="Stawka (zł)"
            />
            <div className="grid grid-cols-4 gap-1.5">
              {stakePresets.map((preset) => (
                <button
                  key={preset}
                  onClick={() => setStake(preset)}
                  className={cn(
                    'w-full text-[11px] font-semibold px-2 h-8 rounded-md transition-all duration-200',
                    stake === preset
                      ? 'bg-foreground text-background shadow-sm scale-[1.02]'
                      : 'bg-card text-foreground hover:bg-muted'
                  )}
                >
                  {preset} zł
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="text-[12px] text-muted-foreground">Łączna stawka: {totalStake.toFixed(2)} zł</div>
        )}
        <button
          onClick={placeBet}
          disabled={placing || items.length === 0}
          className="w-full gradient-primary text-primary-foreground font-bold h-10 text-[13px] rounded-md disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {placing ? 'Stawianie...' : 'Obstaw'}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className={cn(
            'lg:hidden fixed bottom-4 right-4 z-[80] rounded-full h-16 w-16 shadow-2xl flex items-center justify-center transition-colors',
            hasItems
              ? 'gradient-primary text-primary-foreground'
              : 'bg-card text-foreground border border-border'
          )}
          style={{ WebkitTapHighlightColor: 'transparent' }}
          aria-label="Otwórz kupon"
        >
          <div className="relative">
            <Ticket className="h-6 w-6" />
            {hasItems && (
              <span className="absolute -top-2 -right-2 bg-card text-foreground text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center shadow">
                {items.length}
              </span>
            )}
          </div>
        </button>
      )}

      {open && (
        <>
          <div
            className={cn(
              'lg:hidden fixed inset-0 z-[70] bg-foreground/45 backdrop-blur-[1px] transition-opacity duration-200',
              isClosing ? 'opacity-0' : 'opacity-100'
            )}
            onClick={handleClose}
          />
          <aside
            className={cn(
              'lg:hidden fixed inset-x-2 bottom-2 z-[81] bg-card border border-border rounded-2xl card-shadow h-[min(78vh,680px)] max-h-[78vh] overflow-hidden pb-[max(0.5rem,env(safe-area-inset-bottom))] transition-transform duration-200 ease-out coupon-drawer-enter',
              isClosing ? 'translate-y-4 opacity-95' : 'translate-y-0 opacity-100'
            )}
          >
            {drawerContent}
          </aside>
        </>
      )}

      <aside className="hidden lg:block w-[300px] shrink-0 h-full p-2 pl-1">
        <div className="h-full rounded-2xl bg-card border border-border card-shadow overflow-hidden">
          {drawerContent}
        </div>
      </aside>
    </>
  );
}
