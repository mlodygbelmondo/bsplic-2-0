import { Share2 } from 'lucide-react';
import { toast } from 'sonner';

import type { PlayerCardDisplayModel } from '@/features/player-card/displayModel';

interface PlayerCardHeroProps {
  model: PlayerCardDisplayModel;
  profileName: string;
  profileUrl: string;
}

function formatProfit(profit: number) {
  return `${profit >= 0 ? '+' : ''}${profit.toFixed(2)} zł`;
}

function isShareCancellation(error: unknown) {
  return typeof error === 'object'
    && error !== null
    && 'name' in error
    && error.name === 'AbortError';
}

export function PlayerCardHero({ model, profileName, profileUrl }: PlayerCardHeroProps) {
  const primaryMetrics = [
    {
      label: 'Zysk',
      value: formatProfit(model.profit),
      valueClassName: model.profit >= 0 ? 'text-emerald-300' : 'text-rose-200',
    },
    {
      label: 'Win rate',
      value: `${model.winRate.toFixed(1)}%`,
      valueClassName: 'text-white',
    },
    {
      label: 'Seria',
      value: model.currentStreak.toString(),
      valueClassName: 'text-amber-100',
    },
  ];

  const handleShareProfile = async () => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `Profil ${profileName}`,
          text: `Sprawdź profil gracza ${profileName}`,
          url: profileUrl,
        });
        toast.success('Profil udostępniony');
      } catch (error) {
        if (isShareCancellation(error)) return;
        toast.error('Nie udało się udostępnić profilu');
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(profileUrl);
      toast.success('Link do profilu skopiowany');
    } catch {
      toast.error('Nie udało się skopiować linku do profilu');
    }
  };

  return (
    <section
      aria-label="Karta gracza"
      className="player-card-hero card-shadow rounded-2xl border border-amber-200/20 p-4 text-white sm:p-5"
    >
      <div className="relative z-10 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-100/70">Karta gracza</p>
            <h2 className="mt-1 text-xl font-black tracking-tight sm:text-2xl">{model.archetype.label}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-fit rounded-full border border-amber-100/20 bg-white/10 px-3 py-1 text-xs font-semibold text-amber-50">
              Sportsbook
            </span>
            <button
              type="button"
              onClick={handleShareProfile}
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-100/20 bg-white/10 px-3 py-1 text-xs font-semibold text-amber-50 transition-colors hover:bg-white/15"
            >
              <Share2 className="h-3.5 w-3.5" />
              Udostępnij profil
            </button>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          {primaryMetrics.map((metric) => (
            <div key={metric.label} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-100/65">{metric.label}</p>
              <p className={`mt-1 text-xl font-black tracking-tight ${metric.valueClassName}`}>{metric.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-100/65">Kupony</p>
            <p className="mt-1 text-lg font-bold">{model.totalCoupons}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-100/65">Wygrane</p>
            <p className="mt-1 text-lg font-bold">{model.wins}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
