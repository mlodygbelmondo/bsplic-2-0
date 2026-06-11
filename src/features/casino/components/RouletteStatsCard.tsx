import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Flame, Snowflake, BarChart3 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { getRouletteColor } from '@/features/casino/lib/roulette';
import type { RouletteColor, RouletteTableRound } from '@/types/database';

interface RouletteStatsCardProps {
  spins: RouletteTableRound[];
}

const NUMBER_CHIP_CLASSES: Record<RouletteColor, string> = {
  red: 'border-rose-400/50 bg-rose-500/15 text-rose-200',
  black: 'border-stone-400/40 bg-stone-800 text-stone-200',
  green: 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200',
};

function NumberChip({ number, count }: { number: number; count: number }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[11px] font-bold',
        NUMBER_CHIP_CLASSES[getRouletteColor(number)],
      )}
    >
      {number}
      <span className="font-sans text-[9px] font-semibold opacity-60">
        ×{count}
      </span>
    </span>
  );
}

export function RouletteStatsCard({ spins }: RouletteStatsCardProps) {
  const stats = useMemo(() => {
    const settled = spins.filter((spin) => spin.winning_number !== null);
    if (settled.length < 5) return null;

    const counts = new Map<number, number>();
    let red = 0;
    let black = 0;
    let green = 0;

    settled.forEach((spin) => {
      const number = spin.winning_number as number;
      counts.set(number, (counts.get(number) ?? 0) + 1);
      const color = spin.winning_color ?? getRouletteColor(number);
      if (color === 'red') red += 1;
      else if (color === 'black') black += 1;
      else green += 1;
    });

    const allCounts = Array.from({ length: 37 }, (_, number) => ({
      number,
      count: counts.get(number) ?? 0,
    }));
    const hot = [...allCounts]
      .sort((a, b) => b.count - a.count || a.number - b.number)
      .slice(0, 3)
      .filter((entry) => entry.count > 0);
    const cold = [...allCounts]
      .sort((a, b) => a.count - b.count || a.number - b.number)
      .slice(0, 3);

    const total = settled.length;
    return { hot, cold, red, black, green, total };
  }, [spins]);

  if (!stats) return null;

  const redPct = (stats.red / stats.total) * 100;
  const blackPct = (stats.black / stats.total) * 100;
  const greenPct = (stats.green / stats.total) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.34 }}
      data-testid="roulette-stats-card"
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm"
    >
      <div className="mb-3 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-amber-400" />
        <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
          Statystyki · {stats.total} spinów
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <div
            className="flex h-2.5 w-full overflow-hidden rounded-full border border-white/10"
            role="img"
            aria-label={`Czerwone ${redPct.toFixed(0)}%, czarne ${blackPct.toFixed(0)}%, zielone ${greenPct.toFixed(0)}%`}
          >
            <div className="bg-rose-500/80" style={{ width: `${redPct}%` }} />
            <div className="bg-stone-700" style={{ width: `${blackPct}%` }} />
            <div
              className="bg-emerald-500/80"
              style={{ width: `${greenPct}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] font-semibold">
            <span className="text-rose-300">
              {redPct.toFixed(0)}% czerwone
            </span>
            <span className="text-stone-300">
              {blackPct.toFixed(0)}% czarne
            </span>
            <span className="text-emerald-300">
              {greenPct.toFixed(0)}% zielone
            </span>
          </div>
        </div>

        {stats.hot.length > 0 && (
          <div className="flex items-center gap-2">
            <Flame
              className="h-3.5 w-3.5 flex-shrink-0 text-orange-400"
              aria-hidden="true"
            />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
              Gorące
            </span>
            <div className="flex flex-wrap gap-1.5">
              {stats.hot.map(({ number, count }) => (
                <NumberChip key={number} number={number} count={count} />
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Snowflake
            className="h-3.5 w-3.5 flex-shrink-0 text-sky-400"
            aria-hidden="true"
          />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
            Zimne
          </span>
          <div className="flex flex-wrap gap-1.5">
            {stats.cold.map(({ number, count }) => (
              <NumberChip key={number} number={number} count={count} />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
