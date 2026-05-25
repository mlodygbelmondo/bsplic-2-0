import { CircleDot, Layers, List, Radio, Zap } from 'lucide-react';
import { PrototypeFrame } from '@/features/redesign/PrototypeFrame';
import type { ConceptVariantProps } from '../types';
import { formatBalance, formatOdds } from '../shared/format-odds';
import { mockParlays } from '../shared/mock-data';
import { ConceptLoadingState } from '../shared/loading-state';

export const Variant3BrutalistLedger = ({
  events,
  categories,
  profile,
  loading,
}: ConceptVariantProps) => (
  <PrototypeFrame
    background="bg-black"
    top={
      <div className="border-b-4 border-red-600 bg-black px-4 pb-3 pt-10">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[28px] font-black leading-none tracking-tighter text-white">
              BSPLIC
            </div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.4em] text-red-600">
              Sportsbook
            </div>
          </div>
          <div className="border-2 border-white px-3 py-1 text-right">
            <div className="text-[9px] font-bold uppercase text-white/50">Saldo</div>
            <div className="font-mono text-[16px] font-black text-white">
              {formatBalance(profile?.balance ?? 0)} PLN
            </div>
          </div>
        </div>
        <div className="mt-4 flex border-2 border-white">
          {categories.slice(0, 4).map((category, index) => (
            <button
              key={category.id}
              type="button"
              className={`flex-1 border-white py-2 text-[10px] font-black uppercase ${
                index > 0 ? 'border-l-2' : ''
              } ${index === 0 ? 'bg-red-600 text-white' : 'text-white/70'}`}
            >
              {category.emoji} {category.label}
            </button>
          ))}
        </div>
      </div>
    }
    bottom={
      <div className="border-t-4 border-red-600 bg-black px-2 pb-6 pt-2">
        <div className="grid grid-cols-4 border-2 border-white">
          {[
            { icon: List, label: 'Lista' },
            { icon: Radio, label: 'Live' },
            { icon: Layers, label: 'Taśmy' },
            { icon: Zap, label: 'Boost' },
          ].map(({ icon: Icon, label }, index) => (
            <button
              key={label}
              type="button"
              className={`flex flex-col items-center gap-1 py-3 text-[9px] font-black uppercase text-white ${
                index > 0 ? 'border-l-2 border-white' : ''
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>
    }
  >
    <div className="space-y-0 px-0 pb-28 pt-44">
      <div className="border-b-2 border-white bg-red-600 px-4 py-2 text-[11px] font-black uppercase tracking-widest text-white">
        Dzisiaj · {events.length} wydarzeń
      </div>

      {loading ? (
        <ConceptLoadingState />
      ) : (
        events.slice(0, 10).map((event) => (
          <article
            key={event.id}
            className="border-b-2 border-white/20 px-4 py-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-red-500">
                  {event.isLive ? (
                    <CircleDot className="h-3 w-3 animate-pulse" />
                  ) : null}
                  {event.league}
                </div>
                <h3 className="mt-1 text-[15px] font-black uppercase leading-tight text-white">
                  {event.title}
                </h3>
                <div className="mt-1 font-mono text-[11px] text-white/50">
                  {event.startsAt}
                </div>
              </div>
              {event.isBoosted ? (
                <div className="border-2 border-yellow-400 px-2 py-1 text-[9px] font-black text-yellow-400">
                  BOOST
                </div>
              ) : null}
            </div>
            <div className="mt-3 grid grid-cols-3 border-2 border-white">
              {event.options.slice(0, 3).map((option, index) => (
                <button
                  key={option.label}
                  type="button"
                  className={`py-3 text-center ${index > 0 ? 'border-l-2 border-white' : ''}`}
                >
                  <div className="text-[9px] font-black uppercase text-white/50">
                    {option.short}
                  </div>
                  <div className="font-mono text-[18px] font-black text-yellow-400">
                    {formatOdds(option.odds)}
                  </div>
                </button>
              ))}
            </div>
          </article>
        ))
      )}

      <section className="border-t-4 border-white px-4 py-5">
        <h2 className="text-[12px] font-black uppercase tracking-[0.3em] text-red-600">
          Popularne taśmy
        </h2>
        <div className="mt-3 space-y-0 border-2 border-white">
          {mockParlays.map((parlay, index) => (
            <div
              key={parlay.id}
              className={`flex items-center justify-between px-3 py-3 ${
                index > 0 ? 'border-t-2 border-white' : ''
              }`}
            >
              <div>
                <div className="text-[13px] font-black uppercase text-white">
                  {parlay.label}
                </div>
                <div className="text-[10px] text-white/50">{parlay.picks} typy</div>
              </div>
              <div className="bg-yellow-400 px-3 py-2 font-mono text-[14px] font-black text-black">
                {formatOdds(parlay.odds)}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  </PrototypeFrame>
);
