import { memo } from 'react';
import { motion } from 'framer-motion';

import { cn } from '@/lib/utils';
import type { Card } from '@/features/casino/api/blackjack';

interface PlayingCardProps {
  card: Card;
  hidden?: boolean;
}

const suitSymbols = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const suitColors = {
  hearts: 'text-red-500',
  diamonds: 'text-red-500',
  clubs: 'text-zinc-800',
  spades: 'text-zinc-800',
};

export const PlayingCard = memo(function PlayingCard({ card, hidden = false }: PlayingCardProps) {
  if (hidden) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="h-28 w-20 flex-shrink-0 rounded-xl border-2 border-white/20 bg-indigo-900 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-800 to-indigo-950 shadow-xl sm:h-32 sm:w-24 2xl:h-40 2xl:w-28"
      >
        <div className="flex h-full w-full items-center justify-center p-2">
          <div className="h-full w-full rounded border border-white/10 opacity-20 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(255,255,255,0.1)_10px,rgba(255,255,255,0.1)_20px)]" />
        </div>
      </motion.div>
    );
  }

  const symbol = suitSymbols[card.suit];
  const colorClass = suitColors[card.suit];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: -20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="relative flex h-28 w-20 flex-shrink-0 flex-col justify-between rounded-xl border border-white/10 bg-white p-2 shadow-xl sm:h-32 sm:w-24 2xl:h-40 2xl:w-28 2xl:p-3"
    >
      {/* Top left */}
      <div className={cn("flex flex-col items-center", colorClass)}>
        <span className="text-base font-bold leading-none sm:text-lg 2xl:text-xl">{card.rank}</span>
        <span className="text-sm leading-none sm:text-base">{symbol}</span>
      </div>

      {/* Center large suit */}
      <div className={cn("absolute inset-0 flex items-center justify-center opacity-20 text-5xl sm:text-6xl 2xl:text-7xl", colorClass)}>
        {symbol}
      </div>

      {/* Bottom right */}
      <div className={cn("flex flex-col items-center rotate-180", colorClass)}>
        <span className="text-base font-bold leading-none sm:text-lg 2xl:text-xl">{card.rank}</span>
        <span className="text-sm leading-none sm:text-base">{symbol}</span>
      </div>
    </motion.div>
  );
});
