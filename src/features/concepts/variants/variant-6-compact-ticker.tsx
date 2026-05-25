import { ArrowDown, ArrowUp, Minus, TrendingUp } from 'lucide-react';
import { PrototypeFrame } from '@/features/redesign/PrototypeFrame';
import { cn } from '@/lib/utils';
import type { ConceptVariantProps } from '../types';
import { formatBalance, formatOdds } from '../shared/format-odds';
import { mockParlays } from '../shared/mock-data';
import { ConceptLoadingState } from '../shared/loading-state';

const trendForIndex = (index: number) => {
  if (index % 3 === 0) {
    return { icon: ArrowUp, color: 'text-emerald-400', label: '↑' };
  }
  if (index % 3 === 1) {
    return { icon: ArrowDown, color: 'text-red-400', label: '↓' };
  }
  return { icon: Minus, color: 'text-white/40', label: '—' };
};

export const Variant6CompactTicker = ({
  events,
  categories,
  profile,
  loading,
}: ConceptVariantProps) => (
  <PrototypeFrame
    background="bg-[#080808]"
    top={
      <div className="border-b border-lime-400/30 bg-[#080808] pt-10">
        <div className="flex items-center justify-between px-3 py-2">
          <div className="font-mono text-[14px] font-black text-lime-400">BSPLIC/TICK</div>
          <div className="font-mono text-[12px] text-white">
            PLN {formatBalance(profile?.balance ?? 0)}
          </div>
        </div>
        <div className="flex overflow-x-auto border-y border-white/10 bg-lime-400/5 scrollbar-hide">
          {events.slice(0, 6).map((event) => (
            <div
              key={event.id}
              className="flex shrink-0 items-center gap-2 border-r border-white/10 px-3 py-1.5"
            >
              {event.isLive ? (
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
              ) : null}
              <span className="font-mono text-[10px] text-white/80">{event.title}</span>
              <span className="font-mono text-[10px] font-bold text-lime-400">
                {event.options[0] ? formatOdds(event.options[0].odds) : '—'}
              </span>
            </div>
          ))}
        </div>
        <div className="flex gap-1 overflow-x-auto px-2 py-2 scrollbar-hide">
          {categories.slice(0, 6).map((category, index) => (
            <button
              key={category.id}
              type="button"
              className={cn(
                'shrink-0 rounded px-2 py-1 font-mono text-[10px] font-bold uppercase',
                index === 0
                  ? 'bg-lime-400 text-black'
                  : 'bg-white/5 text-white/50',
              )}
            >
              {category.label}
            </button>
          ))}
        </div>
      </div>
    }
    bottom={
      <div className="border-t border-lime-400/30 bg-[#080808] px-3 pb-6 pt-2">
        <div className="grid grid-cols-5 font-mono text-[9px] font-bold uppercase text-white/40">
          {['Mecze', 'Live', 'Kursy', 'Taśmy', 'Kupon'].map((item, index) => (
            <button
              key={item}
              type="button"
              className={cn('py-2', index === 2 ? 'text-lime-400' : '')}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
    }
  >
    <div className="space-y-1 px-2 pb-24 pt-36">
      <div className="mb-2 flex items-center gap-1 px-1 text-[10px] font-mono uppercase text-white/40">
        <TrendingUp className="h-3 w-3 text-lime-400" />
        Główne rynki · sortowane wg popularności
      </div>

      {loading ? (
        <ConceptLoadingState />
      ) : (
        events.slice(0, 12).map((event, index) => {
          const trend = trendForIndex(index);
          const TrendIcon = trend.icon;

          return (
            <article
              key={event.id}
              className="flex items-center gap-2 rounded border border-white/5 bg-white/[0.02] px-2 py-2"
            >
              <div className="w-[38%] min-w-0">
                <div className="truncate font-mono text-[9px] uppercase text-white/35">
                  {event.league}
                </div>
                <div className="truncate text-[11px] font-bold text-white">{event.title}</div>
                <div className="font-mono text-[9px] text-white/35">{event.startsAt}</div>
              </div>
              <div className="flex flex-1 gap-1">
                {event.options.slice(0, 3).map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    className="flex-1 rounded bg-lime-400/90 py-1.5 text-center"
                  >
                    <div className="font-mono text-[8px] font-bold text-black/50">
                      {option.short}
                    </div>
                    <div className="font-mono text-[11px] font-black text-black">
                      {formatOdds(option.odds)}
                    </div>
                  </button>
                ))}
              </div>
              <TrendIcon className={cn('h-3 w-3 shrink-0', trend.color)} />
            </article>
          );
        })
      )}

      <section className="mt-4 px-1">
        <h2 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-lime-400">
          Taśmy / PARLAYS
        </h2>
        {mockParlays.map((parlay) => (
          <div
            key={parlay.id}
            className="mb-1 flex items-center justify-between rounded border border-white/5 px-2 py-2"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-[11px] font-bold text-white">{parlay.label}</div>
              <div className="truncate font-mono text-[9px] text-white/35">
                {parlay.legs.join(' + ')}
              </div>
            </div>
            <div className="ml-2 rounded bg-lime-400 px-2 py-1 font-mono text-[11px] font-black text-black">
              {formatOdds(parlay.odds)}
            </div>
          </div>
        ))}
      </section>
    </div>
  </PrototypeFrame>
);
