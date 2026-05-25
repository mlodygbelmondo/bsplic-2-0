import { ChevronRight } from 'lucide-react';
import { PrototypeFrame } from '@/features/redesign/PrototypeFrame';
import type { ConceptVariantProps } from '../types';
import { formatBalance, formatOdds } from '../shared/format-odds';
import { getHeroImage, mockGoalscorers } from '../shared/mock-data';
import { ConceptLoadingState } from '../shared/loading-state';

export const Variant4EditorialFeed = ({
  events,
  categories,
  profile,
  loading,
}: ConceptVariantProps) => (
  <PrototypeFrame
    background="bg-[#111111]"
    top={
      <div className="border-b border-white/10 bg-[#111111]/95 px-5 pb-4 pt-10 backdrop-blur">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="font-serif text-[22px] italic text-white">The Line</div>
            <div className="text-[10px] font-medium uppercase tracking-[0.35em] text-white/40">
              by BSPLIC
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-white/40">Konto</div>
            <div className="font-serif text-[18px] text-amber-300">
              {formatBalance(profile?.balance ?? 0)} zł
            </div>
          </div>
        </div>
        <div className="mt-4 flex gap-4 overflow-x-auto border-t border-white/10 pt-3 scrollbar-hide">
          {categories.slice(0, 5).map((category, index) => (
            <button
              key={category.id}
              type="button"
              className={`shrink-0 text-[12px] ${
                index === 0
                  ? 'border-b-2 border-amber-300 pb-1 font-semibold text-white'
                  : 'text-white/45'
              }`}
            >
              {category.label}
            </button>
          ))}
        </div>
      </div>
    }
    bottom={
      <div className="border-t border-white/10 bg-[#111111]/95 px-5 pb-6 pt-3 backdrop-blur">
        <div className="flex items-center justify-between text-[11px] text-white/45">
          {['Odkrywaj', 'Na żywo', 'Kupon', 'Profil'].map((item, index) => (
            <button
              key={item}
              type="button"
              className={index === 0 ? 'font-semibold text-white' : ''}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
    }
  >
    <div className="space-y-8 px-5 pb-28 pt-40">
      {loading ? (
        <ConceptLoadingState />
      ) : (
        events.slice(0, 5).map((event, index) => (
          <article key={event.id} className="group">
            <div className="relative mb-4 aspect-[16/10] overflow-hidden">
              <img
                src={getHeroImage(index + 1)}
                alt=""
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <div className="text-[10px] font-medium uppercase tracking-[0.3em] text-amber-300/90">
                  {event.league} · {event.startsAt}
                </div>
                <h2 className="mt-1 font-serif text-[26px] leading-tight text-white">
                  {event.title}
                </h2>
              </div>
            </div>
            <div className="flex items-end justify-between border-b border-white/10 pb-4">
              <p className="max-w-[55%] text-[13px] leading-relaxed text-white/50">
                {event.isLive
                  ? 'Mecz trwa — kursy aktualizowane na żywo.'
                  : 'Główne rynki 1X2. Wybierz swój typ poniżej.'}
              </p>
              <div className="flex gap-3">
                {event.options.slice(0, 3).map((option) => (
                  <button key={option.label} type="button" className="text-left">
                    <div className="text-[10px] uppercase tracking-wider text-white/35">
                      {option.short}
                    </div>
                    <div className="border-b-2 border-amber-300 font-serif text-[20px] text-white">
                      {formatOdds(option.odds)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </article>
        ))
      )}

      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="font-serif text-[22px] text-white">Strzelcy</h2>
          <button type="button" className="flex items-center gap-1 text-[11px] text-white/40">
            Wszystkie <ChevronRight className="h-3 w-3" />
          </button>
        </div>
        <div className="divide-y divide-white/10 border-y border-white/10">
          {mockGoalscorers.map((player) => (
            <div key={player.id} className="flex items-center justify-between py-4">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-white/35">
                  #{player.rank} · {player.team}
                </div>
                <div className="font-serif text-[18px] text-white">{player.name}</div>
              </div>
              <button
                type="button"
                className="border border-amber-300/40 px-4 py-2 font-serif text-[16px] text-amber-300"
              >
                {formatOdds(player.odds)}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  </PrototypeFrame>
);
