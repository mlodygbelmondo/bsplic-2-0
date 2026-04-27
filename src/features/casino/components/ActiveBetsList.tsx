import { AnimatePresence, motion } from 'framer-motion';
import { Check, Ticket, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatRouletteBetValue } from '@/features/casino/lib/roulette';
import type { RouletteBetRecord } from '@/types/database';

interface ActiveBetsListProps {
  bets: RouletteBetRecord[];
}

export function ActiveBetsList({ bets }: ActiveBetsListProps) {
  if (bets.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm"
      >
        <div className="flex items-center gap-2">
          <Ticket className="h-4 w-4 text-white/30" />
          <p className="text-xs font-semibold uppercase tracking-wider text-white/30">
            Brak aktywnych zakładów
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm"
    >
      <div className="mb-3 flex items-center gap-2">
        <Ticket className="h-4 w-4 text-amber-400" />
        <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
          Twoje zakłady
        </p>
      </div>

      <div className="space-y-2">
        <AnimatePresence>
          {bets.map((bet) => (
            <motion.div
              key={bet.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className={cn(
                'flex items-center justify-between rounded-xl border p-3',
                bet.is_win === true
                  ? 'border-emerald-500/30 bg-emerald-500/10'
                  : bet.is_win === false
                    ? 'border-red-500/30 bg-red-500/10'
                    : 'border-white/10 bg-white/[0.02]',
              )}
            >
              <div>
                <p className="text-sm font-medium text-white">
                  {formatRouletteBetValue(bet.bet_type, bet.bet_value)}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-white/40">
                  {bet.bet_type}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-amber-200">
                  {bet.stake.toFixed(2)} zł
                </span>
                {bet.is_win === true && (
                  <Check className="h-4 w-4 text-emerald-400" />
                )}
                {bet.is_win === false && (
                  <X className="h-4 w-4 text-red-400" />
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
