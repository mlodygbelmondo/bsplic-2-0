import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight, History } from 'lucide-react';

import { cn } from '@/lib/utils';
import { getRouletteColorLabel } from '@/features/casino/lib/roulette';
import type { RouletteColor, RouletteTableRound } from '@/types/database';

interface RecentSpinsCarouselProps {
  spins: RouletteTableRound[];
}

const STREAK_BADGE_CLASSES: Record<RouletteColor, string> = {
  red: 'border-rose-400/30 bg-rose-500/10 text-rose-200',
  black: 'border-white/20 bg-white/[0.06] text-stone-200',
  green: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
};

function getLeadingColorStreak(
  spins: RouletteTableRound[],
): { color: RouletteColor; length: number } | null {
  const color = spins[0]?.winning_color;
  if (!color) return null;

  let length = 0;
  for (const spin of spins) {
    if (spin.winning_color !== color) break;
    length += 1;
  }

  return length >= 2 ? { color, length } : null;
}

export function RecentSpinsCarousel({ spins }: RecentSpinsCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    dragFree: true,
  });
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const scrollPrev = useCallback(
    () => emblaApi?.scrollPrev(),
    [emblaApi],
  );
  const scrollNext = useCallback(
    () => emblaApi?.scrollNext(),
    [emblaApi],
  );

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => {
      setCanScrollPrev(emblaApi.canScrollPrev());
      setCanScrollNext(emblaApi.canScrollNext());
    };
    emblaApi.on('select', onSelect);
    onSelect();
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi]);

  const streak = getLeadingColorStreak(spins);

  if (spins.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <History className="h-4 w-4 flex-shrink-0 text-amber-400" />
          <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
            Ostatnie spiny
          </p>
          {streak && (
            <span
              data-testid="roulette-color-streak"
              className={cn(
                'truncate rounded-full border px-2 py-0.5 text-[10px] font-bold',
                STREAK_BADGE_CLASSES[streak.color],
              )}
            >
              {streak.length}× {getRouletteColorLabel(streak.color)} z rzędu
            </span>
          )}
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={scrollPrev}
            disabled={!canScrollPrev}
            className="rounded-lg bg-white/5 p-1 disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4 text-white/60" />
          </button>
          <button
            type="button"
            onClick={scrollNext}
            disabled={!canScrollNext}
            className="rounded-lg bg-white/5 p-1 disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4 text-white/60" />
          </button>
        </div>
      </div>

      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex gap-3">
          {spins.map((spin) => (
            <div
              key={spin.id}
              className="flex min-w-[72px] flex-shrink-0 flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3"
            >
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-bold',
                  spin.winning_color === 'red' &&
                    'border-rose-400 bg-rose-500/20 text-rose-200',
                  spin.winning_color === 'black' &&
                    'border-stone-400 bg-stone-800 text-stone-200',
                  spin.winning_color === 'green' &&
                    'border-emerald-400 bg-emerald-500/20 text-emerald-200',
                )}
              >
                {spin.winning_number ?? '?'}
              </div>
              <span className="font-mono text-[10px] text-white/30">
                #{spin.round_number}
              </span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
