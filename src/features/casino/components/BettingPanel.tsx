import { AnimatePresence, motion } from 'framer-motion';
import { Hash, Palette, ArrowUpDown, ArrowDownUp } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  getRouletteBetTypeLabel,
  getRouletteBetValueOptions,
} from '@/features/casino/lib/roulette';
import type { RouletteBetType } from '@/types/database';

interface BettingPanelProps {
  betType: RouletteBetType | '';
  betValue: string;
  onBetTypeChange: (value: RouletteBetType) => void;
  onBetValueChange: (value: string) => void;
}

const BET_TYPE_CONFIG: {
  type: RouletteBetType;
  icon: React.ReactNode;
  desc: string;
}[] = [
  { type: 'straight', icon: <Hash className="h-4 w-4" />, desc: 'x36' },
  { type: 'color', icon: <Palette className="h-4 w-4" />, desc: 'x2' },
  {
    type: 'parity',
    icon: <ArrowUpDown className="h-4 w-4" />,
    desc: 'x2',
  },
  {
    type: 'range',
    icon: <ArrowDownUp className="h-4 w-4" />,
    desc: 'x2',
  },
];

export function BettingPanel({
  betType,
  betValue,
  onBetTypeChange,
  onBetValueChange,
}: BettingPanelProps) {
  return (
    <div className="space-y-3">
      {/* Bet type selector */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">
          Typ zakładu
        </p>
        <div className="grid grid-cols-2 gap-2">
          {BET_TYPE_CONFIG.map(({ type, icon, desc }) => {
            const label = getRouletteBetTypeLabel(type);
            const active = betType === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => onBetTypeChange(type)}
                className={cn(
                  'flex items-center gap-2 rounded-xl border p-2.5 transition-all duration-200 sm:gap-3 sm:p-3',
                  active
                    ? 'border-amber-500/50 bg-amber-500/10 shadow-[0_0_20px_rgba(245,158,11,0.12)]'
                    : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]',
                )}
              >
                <span
                  className={cn(
                    'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-colors',
                    active
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-white/5 text-white/50',
                  )}
                >
                  {icon}
                </span>
                <div className="min-w-0 text-left">
                  <p
                    className={cn(
                      'text-sm font-semibold',
                      active ? 'text-amber-200' : 'text-white/80',
                    )}
                  >
                    {label}
                  </p>
                  <p className="text-[10px] text-white/40">{desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bet value selector with swipe animation */}
      <AnimatePresence mode="wait">
        {betType && (
          <motion.div
            key={betType}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">
                Wartość
              </p>
              <div
                className={cn(
                  'grid gap-2',
                  betType === 'straight'
                    ? 'grid-cols-4 sm:grid-cols-5 md:grid-cols-6'
                    : 'grid-cols-2',
                )}
              >
                {getRouletteBetValueOptions(betType).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onBetValueChange(opt.value)}
                    className={cn(
                      'rounded-lg border px-1 py-2 text-sm font-medium transition-all sm:px-2',
                      betValue === opt.value
                        ? 'border-amber-500/50 bg-amber-500/15 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.1)]'
                        : 'border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20 hover:bg-white/[0.06]',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
