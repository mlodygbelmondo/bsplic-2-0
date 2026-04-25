import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight, History } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { RouletteTableRound } from '@/types/database';

interface RecentSpinsCarouselProps {
  spins: RouletteTableRound[];
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

  if (spins.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-amber-400" />
          <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
            Ostatnie spiny
          </p>
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
