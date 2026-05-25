import { Circle } from 'lucide-react';
import { PrototypeFrame } from '@/features/redesign/PrototypeFrame';
import { cn } from '@/lib/utils';
import type { ConceptVariantProps } from '../types';
import { formatBalance, formatOdds } from '../shared/format-odds';
import { getHeroImage, mockGoalscorers } from '../shared/mock-data';
import { ConceptLoadingState } from '../shared/loading-state';

export const Variant8SplitPane = ({
  events,
  categories,
  profile,
  loading,
}: ConceptVariantProps) => {
  const liveEvents = events.filter((event) => event.isLive);
  const upcomingEvents = events.filter((event) => !event.isLive);

  return (
    <PrototypeFrame
      background="bg-[#10131a]"
      top={
        <div className="border-b border-white/10 bg-[#10131a] px-3 pb-2 pt-10">
          <div className="flex items-center justify-between">
            <div className="text-[15px] font-black text-white">BSPLIC</div>
            <div className="text-[11px] font-bold text-orange-400">
              {formatBalance(profile?.balance ?? 0)} zł
            </div>
          </div>
        </div>
      }
      bottom={
        <div className="border-t border-white/10 bg-[#10131a] px-4 pb-6 pt-2">
          <div className="flex justify-between text-[10px] font-bold text-white/45">
            {['Feed', 'Live', 'Kupon', 'Profil'].map((item, index) => (
              <button
                key={item}
                type="button"
                className={index === 0 ? 'text-orange-400' : ''}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      }
    >
      <div className="flex h-full pb-20 pt-16">
        <aside className="sticky top-0 flex w-[38%] shrink-0 flex-col border-r border-white/10 bg-[#0a0d12]">
          <div className="border-b border-white/10 px-2 py-2">
            <div className="flex items-center gap-1 text-[10px] font-black uppercase text-red-400">
              <Circle className="h-2 w-2 fill-red-500 text-red-500" />
              Live
            </div>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            {loading ? (
              <ConceptLoadingState label="Live…" />
            ) : liveEvents.length > 0 ? (
              liveEvents.slice(0, 5).map((event) => (
                <button
                  key={event.id}
                  type="button"
                  className="w-full border-b border-white/5 px-2 py-3 text-left hover:bg-white/[0.03]"
                >
                  <div className="text-[9px] text-white/40">{event.league}</div>
                  <div className="text-[11px] font-bold leading-tight text-white">
                    {event.title}
                  </div>
                  <div className="mt-1 text-[12px] font-black text-orange-400">
                    {event.options[0] ? formatOdds(event.options[0].odds) : '—'}
                  </div>
                </button>
              ))
            ) : (
              <div className="px-2 py-4 text-[10px] text-white/35">
                Brak live — poniżej nadchodzące.
              </div>
            )}
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto px-2 pb-28 pt-2 scrollbar-hide">
          <div className="mb-3 flex gap-1 overflow-x-auto scrollbar-hide">
            {categories.slice(0, 5).map((category, index) => (
              <button
                key={category.id}
                type="button"
                className={cn(
                  'shrink-0 rounded-md px-2 py-1 text-[10px] font-bold',
                  index === 0 ? 'bg-orange-500 text-black' : 'bg-white/10 text-white/60',
                )}
              >
                {category.label}
              </button>
            ))}
          </div>

          {loading ? (
            <ConceptLoadingState />
          ) : (
            <>
              {(upcomingEvents.length > 0 ? upcomingEvents : events)
                .slice(0, 6)
                .map((event, index) => (
                  <article key={event.id} className="mb-3 overflow-hidden rounded-xl bg-white/[0.03]">
                    <div className="relative h-24">
                      <img
                        src={getHeroImage(index)}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-transparent" />
                      <div className="absolute bottom-2 left-2 right-2">
                        <div className="text-[10px] text-white/60">{event.startsAt}</div>
                        <div className="text-[13px] font-bold text-white">{event.title}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-1 p-2">
                      {event.options.slice(0, 3).map((option) => (
                        <button
                          key={option.label}
                          type="button"
                          className="rounded-lg bg-amber-400 py-2 text-[11px] font-black text-black"
                        >
                          {formatOdds(option.odds)}
                        </button>
                      ))}
                    </div>
                  </article>
                ))}

              <section className="mt-2">
                <h2 className="mb-2 text-[11px] font-black uppercase text-white/40">
                  Strzelcy
                </h2>
                <div className="space-y-1">
                  {mockGoalscorers.slice(0, 3).map((player) => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between rounded-lg bg-white/[0.04] px-2 py-2"
                    >
                      <div>
                        <div className="text-[11px] font-bold text-white">{player.name}</div>
                        <div className="text-[9px] text-white/40">{player.team}</div>
                      </div>
                      <button
                        type="button"
                        className="rounded bg-amber-400 px-2 py-1 text-[11px] font-black text-black"
                      >
                        {formatOdds(player.odds)}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </PrototypeFrame>
  );
};
