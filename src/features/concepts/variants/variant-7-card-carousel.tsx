import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { PrototypeFrame } from '@/features/redesign/PrototypeFrame';
import { cn } from '@/lib/utils';
import type { ConceptVariantProps } from '../types';
import { formatBalance, formatOdds } from '../shared/format-odds';
import { getHeroImage } from '../shared/mock-data';
import { ConceptLoadingState } from '../shared/loading-state';

export const Variant7CardCarousel = ({
  events,
  categories,
  profile,
  loading,
}: ConceptVariantProps) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const visibleEvents = events.slice(0, 6);
  const activeEvent = visibleEvents[activeIndex];

  const goPrev = () =>
    setActiveIndex((current) =>
      current === 0 ? visibleEvents.length - 1 : current - 1,
    );
  const goNext = () =>
    setActiveIndex((current) =>
      current === visibleEvents.length - 1 ? 0 : current + 1,
    );

  return (
    <PrototypeFrame
      background="bg-neutral-950"
      top={
        <div className="flex items-center justify-between px-4 pb-2 pt-10">
          <div className="text-[16px] font-black text-white">BSPLIC</div>
          <div className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold text-white">
            {formatBalance(profile?.balance ?? 0)} zł
          </div>
        </div>
      }
      bottom={
        <div className="flex items-center justify-center gap-3 px-4 pb-8 pt-2">
          <button
            type="button"
            onClick={goPrev}
            className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex gap-1">
            {visibleEvents.map((event, index) => (
              <button
                key={event.id}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  index === activeIndex ? 'w-6 bg-red-500' : 'w-1.5 bg-white/25',
                )}
                aria-label={event.title}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={goNext}
            className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      }
    >
      <div className="flex h-full flex-col px-4 pb-24 pt-20">
        <div className="mb-4 flex gap-2 overflow-x-auto scrollbar-hide">
          {categories.slice(0, 5).map((category, index) => (
            <button
              key={category.id}
              type="button"
              className={cn(
                'shrink-0 rounded-full px-3 py-1 text-[11px] font-bold',
                index === 0 ? 'bg-red-600 text-white' : 'bg-white/10 text-white/60',
              )}
            >
              {category.emoji} {category.label}
            </button>
          ))}
        </div>

        {loading ? (
          <ConceptLoadingState />
        ) : activeEvent ? (
          <div className="flex flex-1 flex-col">
            <div className="relative flex-1 overflow-hidden rounded-[32px] shadow-2xl ring-1 ring-white/10">
              <img
                src={getHeroImage(activeIndex)}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-black/10" />
              <div className="relative flex h-full flex-col justify-between p-5">
                <div>
                  {activeEvent.isLive ? (
                    <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-black text-white">
                      NA ŻYWO
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-white/70">
                      {activeEvent.startsAt}
                    </span>
                  )}
                  <div className="mt-2 text-[11px] text-white/60">
                    {activeEvent.leagueEmoji} {activeEvent.league}
                  </div>
                </div>
                <div>
                  <h2 className="text-[28px] font-black leading-tight text-white">
                    {activeEvent.title}
                  </h2>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {activeEvent.options.slice(0, 3).map((option) => (
                      <button
                        key={option.label}
                        type="button"
                        className="rounded-2xl bg-amber-400 py-4 text-center shadow-lg"
                      >
                        <div className="text-[10px] font-bold text-black/55">{option.label}</div>
                        <div className="text-[18px] font-black text-black">
                          {formatOdds(option.odds)}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 text-center text-[11px] text-white/40">
              Przesuń lub użyj strzałek · {activeIndex + 1}/{visibleEvents.length}
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-white/40">
            Brak wydarzeń
          </div>
        )}
      </div>
    </PrototypeFrame>
  );
};
