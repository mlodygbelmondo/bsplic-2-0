import { motion } from 'framer-motion';
import { Radio } from 'lucide-react';

import { Progress } from '@/components/ui/progress';
import {
  getRoulettePhaseLabel,
  ROULETTE_BETTING_WINDOW_MS,
  ROULETTE_SPIN_REVEAL_MS,
} from '@/features/casino/lib/roulette';
import type { RouletteTableRound } from '@/types/database';

interface GameStatusBarProps {
  round: RouletteTableRound | null;
  countdownLabel: string;
  countdownMs: number;
}

export function GameStatusBar({
  round,
  countdownLabel,
  countdownMs,
}: GameStatusBarProps) {
  const phase = round?.phase ?? 'waiting';
  const maxMs =
    phase === 'spinning' ? ROULETTE_SPIN_REVEAL_MS : ROULETTE_BETTING_WINDOW_MS;
  const progressValue = Math.max(
    0,
    Math.min(100, (countdownMs / maxMs) * 100),
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-black/40 p-4 backdrop-blur-xl sm:p-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10">
              <Radio className="h-5 w-5 text-amber-400 pulse-live" />
            </div>
            <span className="absolute -right-1 -top-1 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-200/70">
                Kasyno Premium
              </span>
              <span className="font-mono text-xs text-white/50">
                #{round?.round_number ?? '—'}
              </span>
            </div>
            <h2 className="mt-0.5 text-lg font-bold text-white">
              Ruletka
            </h2>
          </div>
        </div>

        <div className="flex min-w-[200px] items-center gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex justify-between text-xs text-white/60">
              <span>Do spinu</span>
              <span className="font-mono text-sm font-bold text-white">
                {countdownLabel}
              </span>
            </div>
            <Progress value={progressValue} className="h-1.5 bg-white/10" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
