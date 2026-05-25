import { motion } from 'framer-motion';
import { Clock, Flame, Gamepad2, Sparkles, Zap } from 'lucide-react';
import { PrototypeFrame } from '@/features/redesign/PrototypeFrame';
import { cn } from '@/lib/utils';
import type { ConceptVariantProps } from '../types';
import { formatBalance, formatOdds } from '../shared/format-odds';
import { getHeroImage, mockGoalscorers } from '../shared/mock-data';
import { ConceptLoadingState } from '../shared/loading-state';

export const Variant5AuroraBoost = ({
  events,
  categories,
  profile,
  loading,
}: ConceptVariantProps) => {
  const boostedEvent = events.find((event) => event.isBoosted) ?? events[0];
  const topOption = boostedEvent?.options[0];

  return (
    <PrototypeFrame
      background="bg-[#0c0618]"
      top={
        <div className="px-4 pb-3 pt-10">
          <div className="flex items-center justify-between">
            <div className="bg-gradient-to-r from-fuchsia-500 to-violet-500 bg-clip-text text-[18px] font-black text-transparent">
              BSPLIC
            </div>
            <div className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold text-white backdrop-blur">
              {formatBalance(profile?.balance ?? 0)} zł
            </div>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-hide">
            {['Dla Ciebie', ...categories.slice(0, 3).map((c) => c.label)].map(
              (label, index) => (
                <button
                  key={label}
                  type="button"
                  className={cn(
                    'shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold',
                    index === 0
                      ? 'bg-gradient-to-r from-fuchsia-500 to-violet-500 text-white'
                      : 'bg-white/10 text-white/70',
                  )}
                >
                  {label}
                </button>
              ),
            )}
          </div>
        </div>
      }
      bottom={
        <div className="mx-3 mb-4 rounded-2xl bg-gradient-to-r from-fuchsia-600/30 to-violet-600/30 p-2 ring-1 ring-fuchsia-400/30 backdrop-blur">
          <div className="grid grid-cols-4 gap-1 text-[10px] font-bold text-white/80">
            {[
              { icon: Gamepad2, label: 'Sport' },
              { icon: Flame, label: 'Live' },
              { icon: Zap, label: 'Boost' },
              { icon: Sparkles, label: 'Misje' },
            ].map(({ icon: Icon, label }) => (
              <button key={label} type="button" className="flex flex-col items-center gap-1 py-2">
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </div>
      }
    >
      <div className="space-y-5 px-3 pb-32 pt-32">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl p-[2px]"
          style={{
            background: 'linear-gradient(135deg, #ec4899, #8b5cf6, #06b6d4)',
          }}
        >
          <div className="relative overflow-hidden rounded-[22px] bg-[#120a22]">
            <img
              src={getHeroImage(2)}
              alt=""
              className="h-32 w-full object-cover opacity-40"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#120a22] via-[#120a22]/60 to-transparent" />
            <div className="absolute left-4 top-4 flex items-center gap-1 rounded-full bg-red-600 px-2 py-1 text-[10px] font-black text-white">
              <Clock className="h-3 w-3" />
              01:17:49
            </div>
            <div className="relative p-4">
              <div className="bg-gradient-to-r from-pink-400 to-violet-300 bg-clip-text text-[22px] font-black italic text-transparent">
                Esportowy BOOOOST
              </div>
              {boostedEvent ? (
                <>
                  <div className="mt-2 inline-flex rounded-full bg-black/50 px-3 py-1 text-[11px] font-bold text-white">
                    {boostedEvent.title}
                  </div>
                  <div className="mt-3 flex overflow-hidden rounded-2xl">
                    <div className="flex flex-1 items-center justify-center bg-white/10 py-3 text-[14px] text-white/40 line-through">
                      {topOption ? formatOdds(topOption.odds) : '—'}
                    </div>
                    <button
                      type="button"
                      className="flex-[1.4] bg-gradient-to-r from-amber-400 to-yellow-300 py-3 text-[18px] font-black text-black"
                    >
                      {topOption ? formatOdds(topOption.odds * 1.5) : '—'}
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </motion.div>

        {loading ? (
          <ConceptLoadingState />
        ) : (
          events.slice(0, 4).map((event, index) => (
            <article
              key={event.id}
              className="overflow-hidden rounded-2xl bg-gradient-to-br from-white/[0.08] to-transparent ring-1 ring-white/10"
            >
              <div className="relative h-28">
                <img src={getHeroImage(index)} alt="" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0c0618] to-transparent" />
                <div className="absolute bottom-3 left-3 right-3">
                  <div className="text-[11px] text-fuchsia-300/80">
                    {event.leagueEmoji} {event.league}
                  </div>
                  <div className="text-[14px] font-black text-white">{event.title}</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 p-3">
                {event.options.slice(0, 3).map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    className="rounded-xl bg-amber-400 py-2.5 text-[13px] font-black text-black"
                  >
                    <span className="block text-[9px] font-bold opacity-60">{option.short}</span>
                    {formatOdds(option.odds)}
                  </button>
                ))}
              </div>
            </article>
          ))
        )}

        <section>
          <h2 className="mb-2 text-[13px] font-black text-white">Strzelcy warci uwagi</h2>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {mockGoalscorers.map((player) => (
              <div
                key={player.id}
                className="w-[130px] shrink-0 rounded-2xl p-[1px]"
                style={{
                  background: `linear-gradient(160deg, ${player.accent}, #8b5cf6)`,
                }}
              >
                <div className="rounded-[15px] bg-[#120a22] p-2">
                  <div className="text-[12px] font-black text-white">{player.name}</div>
                  <button
                    type="button"
                    className="mt-2 w-full rounded-lg bg-amber-400 py-1.5 text-[11px] font-black text-black"
                  >
                    {formatOdds(player.odds)}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </PrototypeFrame>
  );
};
