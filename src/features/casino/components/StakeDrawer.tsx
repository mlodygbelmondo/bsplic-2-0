import { useState } from 'react';
import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Zap } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface StakeDrawerProps {
  balance: number;
  stake: string;
  loading: boolean;
  submitDisabled: boolean;
  betControls?: ReactNode;
  onStakeChange: (value: string) => void;
  onSubmit: () => void;
}

const STAKE_PRESETS = [10, 25, 50, 100];

export function StakeDrawer({
  balance,
  stake,
  loading,
  submitDisabled,
  betControls,
  onStakeChange,
  onSubmit,
}: StakeDrawerProps) {
  const [isDesktopOpen, setIsDesktopOpen] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const parsedStake = Number(stake);

  const adjustStake = (multiplier: number) => {
    const nextStake = Math.max(0.01, (Number(stake) || 0) * multiplier);
    onStakeChange(String(Math.round(nextStake * 100) / 100));
  };

  return (
    <>
      {/* Desktop floating bar */}
      <div className="hidden md:block">
        <AnimatePresence initial={false} mode="wait">
          {isDesktopOpen ? (
            <motion.div
              key="desktop-open"
              initial={{ y: 96, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 96, opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 520 }}
              className="fixed inset-x-0 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-50 mx-auto w-full max-w-xl px-4"
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
                <div className="flex flex-1 items-center gap-2">
                  {STAKE_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => onStakeChange(String(preset))}
                      className={cn(
                        'flex-1 rounded-lg border py-2 text-sm font-medium transition-all',
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
              <p className="mt-1 text-center text-[10px] text-white/30">
                Saldo: {balance.toFixed(2)} zł
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
      </div>

      {/* Mobile swipe drawer */}
      <div className="md:hidden">
        {/* Collapsed handle */}
        <AnimatePresence>
          {!isMobileOpen && (
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="fixed inset-x-0 bottom-0 z-50"
            >
              <button
                type="button"
                aria-label="Otwórz kupon ruletki"
                onClick={() => setIsMobileOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-t-3xl border-t border-white/10 bg-black/90 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 text-white/70 shadow-[0_-8px_30px_rgba(0,0,0,0.5)] backdrop-blur-xl"
              >
                <ChevronUp className="h-5 w-5" />
                <span className="text-sm font-semibold uppercase tracking-wider">
                  Stawka
                </span>
                <span className="ml-2 rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-200">
                  {parsedStake > 0 ? `${parsedStake.toFixed(2)} zł` : '—'}
                </span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Expanded drawer */}
        <AnimatePresence>
          {isMobileOpen && (
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              data-testid="mobile-stake-drawer"
              className="fixed inset-x-0 bottom-0 z-50 max-h-[calc(var(--app-viewport-height,100dvh)-4rem)] overflow-y-auto overscroll-contain rounded-t-3xl border-t border-white/10 bg-black/95 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[0_-12px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl"
            >
              {/* Drag handle */}
              <div className="mb-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => setIsMobileOpen(false)}
                  className="h-1.5 w-12 rounded-full bg-white/20"
                />
              </div>

              {betControls && <div className="mb-4">{betControls}</div>}

              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">
                Wybierz stawkę
              </p>

              <div className="mb-3 grid grid-cols-4 gap-2">
                {STAKE_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => onStakeChange(String(preset))}
                    className={cn(
                      'rounded-lg border py-2.5 text-sm font-medium transition-all',
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
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                value={stake}
                onChange={(e) => onStakeChange(e.target.value)}
                className="mb-3 h-12 rounded-xl border-white/10 bg-white/[0.06] text-center text-lg font-bold text-white placeholder:text-white/20"
              />

              <div className="mb-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => adjustStake(0.5)}
                  className="rounded-xl border border-white/10 bg-white/[0.04] py-2.5 text-sm font-bold text-white/75 transition-colors active:border-amber-500/40 active:text-amber-200"
                >
                  1/2
                </button>
                <button
                  type="button"
                  onClick={() => adjustStake(2)}
                  className="rounded-xl border border-white/10 bg-white/[0.04] py-2.5 text-sm font-bold text-white/75 transition-colors active:border-amber-500/40 active:text-amber-200"
                >
                  2x
                </button>
              </div>

              <Button
                type="button"
                onClick={() => {
                  onSubmit();
                  setIsMobileOpen(false);
                }}
                disabled={loading || submitDisabled}
                className="h-12 w-full rounded-xl bg-amber-500 font-bold text-base text-black transition-all hover:bg-amber-400 hover:shadow-[0_0_24px_rgba(245,158,11,0.3)] active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? (
                  'Przyjmowanie…'
                ) : (
                  <span className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Postaw zakład
                  </span>
                )}
              </Button>

              {submitDisabled && (
                <p className="mt-2 text-center text-xs text-white/40">
                  Zakłady zablokowane – trwa runda
                </p>
              )}

              <p className="mt-3 text-center text-[10px] text-white/30">
                Saldo: {balance.toFixed(2)} zł
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
