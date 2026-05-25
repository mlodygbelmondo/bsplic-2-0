import { Bell, Flame, Plus, Search, Sparkles, Star, Tv, Wallet } from 'lucide-react';
import { PrototypeFrame } from '@/features/redesign/PrototypeFrame';
import { cn } from '@/lib/utils';
import type { ConceptVariantProps } from '../types';
import { formatBalance, formatOdds } from '../shared/format-odds';
import { mockGoalscorers, mockParlays } from '../shared/mock-data';
import { ConceptLoadingState } from '../shared/loading-state';

export const Variant1NeonGrid = ({
  events,
  categories,
  profile,
  loading,
}: ConceptVariantProps) => (
  <PrototypeFrame
    background="bg-[#050810]"
    top={
      <div className="border-b border-cyan-500/20 bg-[#050810]/95 px-4 pb-3 pt-10 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="font-black tracking-tight text-cyan-400">
            BSPLIC<span className="text-white">.</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[11px] font-bold text-cyan-300">
              {formatBalance(profile?.balance ?? 0)} zł
            </div>
            <button
              type="button"
              className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5"
            >
              <Bell className="h-4 w-4 text-white/70" />
            </button>
          </div>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-hide">
          {['Dla Ciebie', ...categories.slice(0, 4).map((c) => c.label)].map(
            (label, index) => (
              <button
                key={label}
                type="button"
                className={cn(
                  'shrink-0 rounded-md px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide',
                  index === 0
                    ? 'bg-cyan-400 text-black'
                    : 'border border-white/10 text-white/60',
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
      <div className="border-t border-cyan-500/20 bg-[#050810]/95 px-2 pb-6 pt-2 backdrop-blur">
        <div className="grid grid-cols-5 gap-1 text-[10px] font-bold text-white/50">
          {[
            { icon: Search, label: 'Sport' },
            { icon: Tv, label: 'Live', badge: '99' },
            { icon: Flame, label: 'Hot' },
            { icon: Star, label: 'Misje', badge: '2' },
            { icon: Wallet, label: 'Kupon' },
          ].map(({ icon: Icon, label, badge }) => (
            <button key={label} type="button" className="relative flex flex-col items-center gap-1 py-1">
              <Icon className="h-4 w-4" />
              {badge ? (
                <span className="absolute -right-0 top-0 rounded-full bg-cyan-400 px-1 text-[8px] font-black text-black">
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
    <div className="space-y-4 px-3 pb-28 pt-36">
      <div className="rounded-lg border border-cyan-500/30 bg-gradient-to-r from-cyan-950/80 to-transparent p-3">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-400">
          <Sparkles className="h-3.5 w-3.5" />
          Multiboost aktywny
        </div>
        <p className="mt-1 text-[13px] text-white/70">
          Wygrywaj więcej — graj bez podatku i z podbitymi kursami.
        </p>
      </div>

      {loading ? (
        <ConceptLoadingState />
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-px bg-white/10 text-[10px] font-bold uppercase tracking-wider text-white/40">
            <div className="bg-[#0a1020] px-3 py-2">Mecz</div>
            <div className="bg-[#0a1020] px-2 py-2 text-center">1</div>
            <div className="bg-[#0a1020] px-2 py-2 text-center">X</div>
            <div className="bg-[#0a1020] px-2 py-2 text-center">2</div>
          </div>
          {events.slice(0, 8).map((event) => (
            <div
              key={event.id}
              className="grid grid-cols-[1fr_auto_auto_auto] gap-px border-t border-white/5 bg-white/5"
            >
              <div className="bg-[#0a1020] px-3 py-3">
                <div className="flex items-center gap-1.5 text-[10px] text-cyan-400/80">
                  <span>{event.leagueEmoji}</span>
                  {event.league}
                  {event.isLive ? (
                    <span className="rounded bg-red-500 px-1 text-[8px] font-black text-white">
                      LIVE
                    </span>
                  ) : null}
                </div>
                <div className="mt-0.5 text-[13px] font-bold text-white">{event.title}</div>
                <div className="text-[11px] text-white/40">{event.startsAt}</div>
              </div>
              {event.options.slice(0, 3).map((option) => (
                <button
                  key={option.label}
                  type="button"
                  className="flex min-w-[52px] flex-col items-center justify-center bg-[#0a1020] px-1 py-2 hover:bg-cyan-500/10"
                >
                  <span className="text-[9px] font-bold text-white/40">{option.short}</span>
                  <span className="font-mono text-[13px] font-black text-cyan-300">
                    {formatOdds(option.odds)}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      <section>
        <h2 className="mb-2 text-[11px] font-black uppercase tracking-[0.25em] text-white/40">
          Strzelcy warci uwagi
        </h2>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {mockGoalscorers.map((player) => (
            <div
              key={player.id}
              className="w-[140px] shrink-0 overflow-hidden rounded-lg border border-white/10"
              style={{ background: `linear-gradient(160deg, ${player.accent}88, #0a1020)` }}
            >
              <div className="p-2">
                <span className="text-[10px] font-black text-white/60">#{player.rank}</span>
                <div className="text-[13px] font-black uppercase text-white">{player.name}</div>
                <div className="text-[10px] text-white/60">
                  {player.team} · {player.time}
                </div>
              </div>
              <button
                type="button"
                className="w-full bg-cyan-400 py-2 text-[12px] font-black text-black"
              >
                Strzelec {formatOdds(player.odds)}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-[11px] font-black uppercase tracking-[0.25em] text-white/40">
          Popularne taśmy
        </h2>
        <div className="space-y-2">
          {mockParlays.map((parlay) => (
            <div
              key={parlay.id}
              className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] p-3"
            >
              <div>
                <div className="text-[13px] font-bold text-white">{parlay.label}</div>
                <div className="text-[11px] text-white/40">{parlay.legs.join(' · ')}</div>
              </div>
              <button
                type="button"
                className="rounded-md bg-cyan-400 px-3 py-2 font-mono text-[13px] font-black text-black"
              >
                {formatOdds(parlay.odds)}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  </PrototypeFrame>
);
