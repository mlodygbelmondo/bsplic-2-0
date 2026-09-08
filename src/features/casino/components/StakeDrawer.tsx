import { useId, useState } from 'react';
import type { CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Zap } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface StakeDrawerProps {
  balance: number;
  stake: string;
  loading: boolean;
  submitDisabled: boolean;
  submitHint?: string | null;
  potentialWin?: number | null;
  betSummary?: string;
  onStakeChange: (value: string) => void;
  onSubmit: () => void;
}

const STAKE_PRESETS = [10, 25, 50, 100];
const MOBILE_STAKE_DRAWER_STYLE = {
  '--roulette-mobile-stake-nav-anchor':
    'calc(max(0rem, calc(var(--mobile-floating-stack-offset, 4.75rem) - 0.375rem)) + env(safe-area-inset-bottom))',
  '--roulette-mobile-stake-top-anchor':
    'calc(2.75rem + env(safe-area-inset-top))',
} as CSSProperties & {
  '--roulette-mobile-stake-nav-anchor': string;
  '--roulette-mobile-stake-top-anchor': string;
};

export function StakeDrawer({
  balance,
  stake,
  loading,
  submitDisabled,
  submitHint = null,
  potentialWin = null,
  betSummary,
  onStakeChange,
  onSubmit,
}: StakeDrawerProps) {
  const isMobile = useIsMobile();
  const stakeInputId = useId();
  const [isDesktopOpen, setIsDesktopOpen] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const parsedStake = Number(stake);

  const adjustStake = (multiplier: number) => {
    const nextStake = Math.max(0.01, (Number(stake) || 0) * multiplier);
    onStakeChange(String(Math.round(nextStake * 100) / 100));
  };

  const setMaxStake = () => {
    onStakeChange(String(Math.max(0.01, Math.floor(balance * 100) / 100)));
  };

  const statusLine = submitHint ? (
    <span className="text-amber-300/80">{submitHint}</span>
  ) : potentialWin !== null ? (
    <span>
      Możliwa wygrana:{' '}
      <span className="font-mono font-bold text-emerald-300">
        {potentialWin.toFixed(2)} zł
      </span>
    </span>
  ) : null;

  return (
    <>
      {/* Desktop floating bar */}
      {!isMobile && <div className="hidden md:block">
        <AnimatePresence initial={false} mode="wait">
          {isDesktopOpen ? (
            <motion.div
              key="desktop-open"
              initial={{ y: 96, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 96, opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 520 }}
              className="fixed inset-x-0 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-50 mx-auto w-full max-w-3xl px-4"
            >
              <div className="flex justify-center">
                <button
                  type="button"
                  aria-label="Schowaj stawkę"
                  onClick={() => setIsDesktopOpen(false)}
                  className="flex h-7 w-11 items-center justify-center rounded-t-xl border border-b-0 border-white/10 bg-black text-white/50 shadow-2xl transition-colors hover:text-white"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black p-3 shadow-2xl">
                <div
                  className="grid shrink-0 grid-cols-4 gap-2"
                  data-testid="desktop-stake-presets"
                >
                  {STAKE_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => onStakeChange(String(preset))}
                      className={cn(
                        'flex h-10 w-16 items-center justify-center rounded-lg border text-sm font-medium tabular-nums transition-all',
                        parsedStake === preset
                          ? 'border-amber-500/50 bg-amber-500/15 text-amber-200'
                          : 'border-white/10 bg-white/[0.03] text-white/60 hover:border-white/20',
                      )}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <Input
                  aria-label="Stawka ruletki"
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  value={stake}
                  onChange={(e) => onStakeChange(e.target.value)}
                  className="h-10 w-24 rounded-xl border-white/10 bg-white/[0.06] text-center text-base font-bold text-white placeholder:text-white/20"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => adjustStake(0.5)}
                    className="h-10 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm font-bold text-white/75 transition-colors hover:border-amber-500/40 hover:text-amber-200"
                  >
                    1/2
                  </button>
                  <button
                    type="button"
                    onClick={() => adjustStake(2)}
                    className="h-10 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm font-bold text-white/75 transition-colors hover:border-amber-500/40 hover:text-amber-200"
                  >
                    2x
                  </button>
                  <button
                    type="button"
                    onClick={setMaxStake}
                    className="h-10 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm font-bold text-white/75 transition-colors hover:border-amber-500/40 hover:text-amber-200"
                  >
                    MAX
                  </button>
                </div>
                <Button
                  type="button"
                  onClick={onSubmit}
                  disabled={loading || submitDisabled}
                  className="h-10 rounded-xl bg-amber-500 px-5 font-bold text-sm text-black transition-all hover:bg-amber-400 hover:shadow-[0_0_24px_rgba(245,158,11,0.3)] active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? (
                    '…'
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <Zap className="h-4 w-4" />
                      Postaw
                    </span>
                  )}
                </Button>
              </div>
              <p className="mt-1 flex items-center justify-center gap-3 text-center text-[10px] text-white/30">
                <span>Saldo: {balance.toFixed(2)} zł</span>
                {statusLine && <span>·</span>}
                {statusLine}
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="desktop-closed"
              initial={{ y: 48, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 48, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 520 }}
              className="fixed inset-x-0 bottom-[env(safe-area-inset-bottom)] z-50 mx-auto w-fit"
            >
              <button
                type="button"
                onClick={() => setIsDesktopOpen(true)}
                className="flex items-center gap-2 rounded-t-2xl border border-b-0 border-white/10 bg-black px-5 py-2 text-sm font-semibold text-white/70 shadow-[0_-8px_30px_rgba(0,0,0,0.45)] transition-colors hover:text-white"
              >
                <ChevronUp className="h-4 w-4" />
                <span>Pokaż stawkę</span>
                <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-200">
                  {parsedStake > 0 ? `${parsedStake.toFixed(2)} zł` : '—'}
                </span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>}

      {isMobile && <div className="md:hidden">
        <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
          <div
            style={MOBILE_STAKE_DRAWER_STYLE}
            data-testid="roulette-mobile-controls"
            className="fixed inset-x-0 bottom-[var(--roulette-mobile-stake-nav-anchor)] z-40 border-t border-white/15 bg-[#0b1713] px-3 py-2"
          >
            <div className="mx-auto flex max-w-lg items-center gap-3">
              <SheetTrigger asChild>
                <button
                  type="button"
                  aria-label="Zmień stawkę ruletki"
                  className="flex min-h-12 min-w-24 items-center justify-between gap-3 rounded-xl border border-white/20 px-3 text-left text-white"
                >
                  <span><span className="block text-xs text-white/70">Stawka</span><strong>{parsedStake > 0 ? `${parsedStake.toFixed(2)} zł` : 'Ustaw'}</strong></span>
                  <ChevronUp className="h-4 w-4" />
                </button>
              </SheetTrigger>
              <Button
                onClick={onSubmit}
                disabled={loading || submitDisabled}
                className="h-12 min-w-0 flex-1 rounded-xl bg-amber-400 text-base font-bold text-black hover:bg-amber-300"
              >
                {loading ? 'Przyjmowanie…' : 'Postaw zakład'}
              </Button>
            </div>
            <p className="mx-auto mt-1 max-w-lg truncate text-center text-xs text-white/80" role="status">
              {submitHint ?? `${betSummary ?? 'Zakład'} · wypłata ${potentialWin?.toFixed(2) ?? '0.00'} zł`}
            </p>
          </div>
          <SheetContent
            side="bottom"
            data-testid="mobile-stake-drawer"
            className="max-h-[85dvh] overflow-y-auto overscroll-contain rounded-t-2xl border-white/15 bg-[#0b1713] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-white [&>button:last-child]:h-11 [&>button:last-child]:w-11 [&>button:last-child]:right-2 [&>button:last-child]:top-2 [&>button:last-child]:flex [&>button:last-child]:items-center [&>button:last-child]:justify-center"
          >
            <SheetTitle className="text-white">Wybierz stawkę</SheetTitle>
            <SheetDescription className="mt-1 text-white/75">Saldo: {balance.toFixed(2)} zł. Kwota dotyczy jednego zakładu.</SheetDescription>
            <div className="my-4 grid grid-cols-4 gap-2">
              {STAKE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  disabled={preset > balance || loading}
                  aria-pressed={parsedStake === preset}
                  onClick={() => onStakeChange(String(preset))}
                  className={cn('min-h-12 rounded-xl border text-base font-semibold disabled:opacity-40', parsedStake === preset ? 'border-amber-300 bg-amber-400/15 text-amber-100' : 'border-white/20 text-white')}
                >{preset}</button>
              ))}
            </div>
            <label htmlFor={stakeInputId} className="mb-2 block text-sm text-white/80">Własna kwota w zł</label>
            <Input
              id={stakeInputId}
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={stake}
              disabled={loading}
              onChange={(e) => onStakeChange(e.target.value)}
              className="h-12 border-white/25 bg-black/30 text-center text-lg font-bold text-white"
            />
            <div className="my-3 grid grid-cols-3 gap-2">
              <button type="button" onClick={() => adjustStake(0.5)} className="min-h-11 rounded-xl border border-white/20 font-semibold">1/2</button>
              <button type="button" onClick={() => adjustStake(2)} className="min-h-11 rounded-xl border border-white/20 font-semibold">2x</button>
              <button type="button" onClick={setMaxStake} className="min-h-11 rounded-xl border border-white/20 font-semibold">MAX</button>
            </div>
            <SheetClose asChild>
              <Button className="h-12 w-full rounded-xl bg-amber-400 text-base font-bold text-black hover:bg-amber-300">Gotowe</Button>
            </SheetClose>
          </SheetContent>
        </Sheet>
      </div>}
    </>
  );
}
