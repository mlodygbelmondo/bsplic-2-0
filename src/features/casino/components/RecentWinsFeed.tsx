import { motion } from 'framer-motion';
import { Trophy } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  formatRouletteBetValue,
  getRouletteBetTypeLabel,
} from '@/features/casino/lib/roulette';
import type { RouletteRecentWin } from '@/types/database';

interface RecentWinsFeedProps {
  wins: RouletteRecentWin[];
}

export function RecentWinsFeed({ wins }: RecentWinsFeedProps) {
  if (wins.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.25 }}
        className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm"
      >
        <div className="mb-2 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-400" />
          <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
            Ostatnie wygrane
          </p>
        </div>
        <p className="text-sm text-white/40">Brak ostatnich wygranych</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.25 }}
      className="max-h-[400px] overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm scrollbar-hide"
    >
      <div className="mb-3 flex items-center gap-2">
        <Trophy className="h-4 w-4 text-amber-400" />
        <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
          Ostatnie wygrane
        </p>
      </div>

      <div className="space-y-2">
        {wins.slice(0, 10).map((win, index) => (
          <motion.div
            key={win.id}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.04 }}
            className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-2.5"
          >
            <Avatar className="h-8 w-8 border border-white/10">
              <AvatarImage
                src={win.avatar_url ?? undefined}
                alt={win.username}
              />
              <AvatarFallback className="bg-white/5 text-[10px] text-white/60">
                {win.username.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <p className="truncate text-sm font-medium text-white">
                  {win.username}
                </p>
                <p className="text-sm font-bold text-emerald-400">
                  +{win.payout.toFixed(2)}
                </p>
              </div>
              <p className="text-[10px] text-white/40">
                {getRouletteBetTypeLabel(win.bet_type)} •{' '}
                {formatRouletteBetValue(win.bet_type, win.bet_value)} • #
                {win.round_number}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
