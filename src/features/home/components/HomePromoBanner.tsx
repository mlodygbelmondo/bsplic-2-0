import { Flame, Trophy, Zap } from 'lucide-react';

export function HomePromoBanner() {
  return (
    <section className="sportsbook-hero-card relative shrink-0 overflow-hidden rounded-lg border border-white/10 px-4 py-3 card-shadow sm:px-5 sm:py-4">
      <div className="relative z-10 flex min-h-[108px] flex-col justify-between gap-3 sm:min-h-[120px]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-red-100/80">
              <Flame className="h-3.5 w-3.5 text-[#f6bf2b]" />
              Sportsbook na dziś
            </div>
            <h1 className="text-[22px] font-black leading-none text-white sm:text-[30px]">
              BSPlic 2.0
            </h1>
            <p className="mt-1 max-w-[26rem] text-[12px] font-semibold leading-snug text-red-50/80 sm:text-[13px]">
              Najmocniejsze zdarzenia, live i boosty w jednym, szybkim widoku.
            </p>
          </div>

          <img
            src="/logo.png"
            alt="BSPlic 2.0"
            className="hidden h-12 w-40 shrink-0 object-contain object-right opacity-95 sm:block"
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-md border border-white/10 bg-black/20 px-2.5 py-2">
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-[#f6bf2b]">
              <Zap className="h-3 w-3" />
              LIVE
            </div>
            <p className="mt-0.5 text-[11px] font-semibold text-white/80">Akcja teraz</p>
          </div>
          <div className="rounded-md border border-white/10 bg-black/20 px-2.5 py-2">
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-[#f6bf2b]">
              <Trophy className="h-3 w-3" />
              Boost
            </div>
            <p className="mt-0.5 text-[11px] font-semibold text-white/80">Wyższe kursy</p>
          </div>
          <div className="rounded-md border border-white/10 bg-black/20 px-2.5 py-2">
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-[#f6bf2b]">
              <Flame className="h-3 w-3" />
              AKO
            </div>
            <p className="mt-0.5 text-[11px] font-semibold text-white/80">Kupon combo</p>
          </div>
        </div>
      </div>
    </section>
  );
}
