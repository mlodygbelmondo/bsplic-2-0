import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, Zap } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface StakeDrawerProps {
  balance: number;
  stake: string;
  loading: boolean;
  submitDisabled: boolean;
  onStakeChange: (value: string) => void;
  onSubmit: () => void;
}

const STAKE_PRESETS = [10, 25, 50, 100];

export function StakeDrawer({
  balance,
  stake,
  loading,
  submitDisabled,
  onStakeChange,
  onSubmit,
}: StakeDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const parsedStake = Number(stake);

  return (
    <>
      {/* Desktop floating bar */}
      <div className="hidden md:block">
        <div className="fixed bottom-6 left-1/2 z-50 w-full max-w-xl -translate-x-1/2 px-4">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/80 p-3 shadow-2xl backdrop-blur-xl">
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
        </div>
      </div>

      {/* Mobile swipe drawer */}
      <div className="md:hidden">
        {/* Collapsed handle */}
        <AnimatePresence>
          {!isOpen && (
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="fixed bottom-0 left-0 right-0 z-50"
            >
              <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="flex w-full items-center justify-center gap-1 rounded-t-2xl border-t border-white/10 bg-black/90 py-2 text-white/60 shadow-[0_-8px_30px_rgba(0,0,0,0.5)] backdrop-blur-xl"
              >
                <ChevronUp className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">
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
          {isOpen && (
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl border-t border-white/10 bg-black/95 p-5 shadow-[0_-12px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl"
            >
              {/* Drag handle */}
              <div className="mb-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="h-1.5 w-12 rounded-full bg-white/20"
                />
              </div>

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

              <Button
                type="button"
                onClick={() => {
                  onSubmit();
                  setIsOpen(false);
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
