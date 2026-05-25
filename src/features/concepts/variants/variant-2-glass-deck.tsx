import { Play, Plus, Radio, Search, Sparkles, Trophy } from 'lucide-react';
import { PrototypeFrame } from '@/features/redesign/PrototypeFrame';
import { cn } from '@/lib/utils';
import type { ConceptVariantProps } from '../types';
import { formatBalance, formatOdds } from '../shared/format-odds';
import { getHeroImage, mockGoalscorers } from '../shared/mock-data';
import { ConceptLoadingState } from '../shared/loading-state';

export const Variant2GlassDeck = ({
  events,
  categories,
  profile,
  loading,
}: ConceptVariantProps) => (
  <PrototypeFrame
    background="bg-neutral-950"
    top={
      <div className="px-4 pb-3 pt-10">
        <div className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div className="rounded-xl bg-red-600 px-3 py-1.5 text-[13px] font-black text-white">
              BSPLIC
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-full bg-black/30 px-2 py-1 text-[11px] font-bold text-white">
                <span className="text-amber-400">F</span> 0 zł
              </div>
              <button
                type="button"
                className="flex items-center gap-1 rounded-full bg-red-600 px-2 py-1 text-[11px] font-bold text-white"
              >
                <Plus className="h-3 w-3" />
                {formatBalance(profile?.balance ?? 0)} zł
              </button>
            </div>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-hide">
            {['Dla Ciebie', ...categories.slice(0, 3).map((c) => `${c.emoji} ${c.label}`)].map(
              (label, index) => (
                <button
                  key={label}
                  type="button"
                  className={cn(
                    'shrink-0 rounded-full px-3 py-1.5 text-[12px] font-bold',
                    index === 0
                      ? 'bg-white text-black'
                      : 'bg-black/30 text-white/80 backdrop-blur',
                  )}
                >
                  {index === 0 ? <Sparkles className="mr-1 inline h-3 w-3" /> : null}
                  {label}
                </button>
              ),
            )}
          </div>
        </div>
      </div>
    }
    bottom={
      <div className="mx-3 mb-4 rounded-2xl border border-white/15 bg-white/10 p-2 backdrop-blur-xl">
        <div className="grid grid-cols-4 gap-1 text-[10px] font-bold text-white/70">
          {[
            { icon: Search, label: 'Sport' },
            { icon: Radio, label: 'Live', badge: '99' },
            { icon: Trophy, label: 'Top' },
            { icon: Sparkles, label: 'Boost' },
          ].map(({ icon: Icon, label, badge }) => (
            <button key={label} type="button" className="relative flex flex-col items-center gap-1 py-2">
              <Icon className="h-4 w-4" />
              {badge ? (
                <span className="absolute right-3 top-0 rounded-full bg-white px-1.5 text-[8px] font-black text-black">
                  {badge}
                </span>
              ) : null}
              {label}
            </button>
          ))}
        </div>
      </div>
    }
  >
    <div className="space-y-5 px-3 pb-32 pt-44">
      <div className="rounded-2xl bg-gradient-to-r from-amber-500 to-orange-400 p-3 text-black">
        <div className="text-[12px] font-black">
          Wygrywaj więcej! Bez podatku i z Multiboost
        </div>
      </div>

      {loading ? (
        <ConceptLoadingState />
      ) : (
        events.slice(0, 4).map((event, index) => (
          <article
            key={event.id}
            className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm"
          >
            <div className="relative h-36">
              <img
                src={getHeroImage(index)}
                alt=""
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-black/50 px-2 py-1 text-[10px] font-bold text-white backdrop-blur">
                <span>{event.leagueEmoji}</span>
                {event.league}
              </div>
              {event.isLive ? (
                <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-red-600 px-2 py-1 text-[10px] font-black text-white">
                  <Play className="h-3 w-3 fill-white" />
                  LIVE
                </div>
              ) : null}
              <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-white/20 bg-white/15 p-3 backdrop-blur-xl">
                <div className="text-[15px] font-black text-white">{event.title}</div>
                <div className="text-[12px] text-white/70">{event.startsAt}</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 p-3">
              {event.options.slice(0, 3).map((option) => (
                <button
                  key={option.label}
                  type="button"
                  className="rounded-2xl bg-amber-400 py-3 text-center"
                >
                  <div className="text-[10px] font-bold text-black/60">{option.label}</div>
                  <div className="text-[15px] font-black text-black">
                    {formatOdds(option.odds)}
                  </div>
                  <div
                    className={cn(
                      'mx-auto mt-1 h-0.5 w-8 rounded-full',
                      option.isHighest ? 'bg-emerald-500' : 'bg-red-500/70',
                    )}
                  />
                </button>
              ))}
            </div>
          </article>
        ))
      )}

      <section>
        <h2 className="mb-3 px-1 text-[14px] font-black text-white">
          Strzelcy warci uwagi
        </h2>
        <div className="flex gap-3 overflow-x-auto scrollbar-hide">
          {mockGoalscorers.map((player) => (
            <div
              key={player.id}
              className="w-[155px] shrink-0 overflow-hidden rounded-3xl border border-white/15 backdrop-blur"
              style={{ background: `linear-gradient(180deg, ${player.accent}99, rgba(0,0,0,0.6))` }}
            >
              <div className="p-3">
                <span className="rounded-md bg-black/40 px-1.5 py-0.5 text-[10px] font-black text-white">
                  #{player.rank}
                </span>
                <div className="mt-2 text-[14px] font-black uppercase text-white">
                  {player.name}
                </div>
              </div>
              <button
                type="button"
                className="w-full bg-amber-400 py-2.5 text-[12px] font-black text-black"
              >
                Strzelec {formatOdds(player.odds)}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  </PrototypeFrame>
);
