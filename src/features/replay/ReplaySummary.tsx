import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';

import { formatReplayDate, formatReplayMoney, STATUS_LABELS, type ReplayModel } from './model';
import { ReplayChart } from './ReplayChart';
import { ReplayCouponDetails } from './ReplayCouponDetails';
import { ReplayHistoryList } from './ReplayHistoryList';

export function ReplaySummary({ model }: { model: ReplayModel }) {
  const coupon = model.highlight;
  const hasResults = model.settledCount > 0;
  return (
    <div className="space-y-5">
      <section className="app-surface rounded-xl p-5 sm:p-6" aria-label="Bilans kuponów">
        <h2 className="text-sm font-medium text-muted-foreground">Bilans</h2>
        <p className={cn('replay-net mt-1 font-bold tracking-tight tabular-nums', hasResults && (model.netCents > 0 ? 'text-success' : model.netCents < 0 ? 'text-destructive' : 'text-foreground'))}>
          {hasResults ? formatReplayMoney(model.netCents, true) : '—'}
        </p>
        {!hasResults && <p className="mt-2 text-sm text-muted-foreground">Brak rozliczonych kuponów.</p>}
        <ReplayChart model={model} />
        <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-5 border-t border-border pt-5 sm:grid-cols-4">
          <div><dt className="text-sm text-muted-foreground">Stawki rozliczonych</dt><dd className="mt-1 break-words text-lg font-semibold tabular-nums">{hasResults ? formatReplayMoney(model.stakeCents) : '—'}</dd></div>
          <div><dt className="text-sm text-muted-foreground">Wypłaty rozliczonych</dt><dd className="mt-1 break-words text-lg font-semibold tabular-nums">{hasResults ? formatReplayMoney(model.payoutCents) : '—'}</dd></div>
          <div><dt className="text-sm text-muted-foreground">Wygrane</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{model.counts.won}<span className="ml-1 text-sm font-normal text-muted-foreground">/ {model.counts.won + model.counts.lost}</span></dd></div>
          <div><dt className="text-sm text-muted-foreground">Skuteczność</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{model.winRate === null ? '—' : `${model.winRate}%`}</dd></div>
        </dl>
        <details className="replay-method mt-4 text-sm">
          <summary className="inline-flex min-h-10 cursor-pointer items-center gap-1 rounded-md text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">Jak liczymy? <ChevronDown size={14} aria-hidden="true" /></summary>
          <div className="max-w-2xl space-y-2 pb-1 pt-2 leading-relaxed text-muted-foreground">
            <p>Bilans to wypłaty minus stawki rozliczonych kuponów, nie saldo konta. Kupony w grze są pomijane. Skuteczność to wygrane / (wygrane + przegrane); zwroty się nie liczą.</p>
            <p>Wykres pokazuje obecne wyniki w kolejności postawienia, nie historię salda ani dat rozliczeń. Zakres 7 lub 30 dni oznacza ostatnie 7 × 24 lub 30 × 24 godziny od pobrania danych. Daty: Europe/Warsaw.</p>
            <p>Tylko zakłady za wirtualne zł, bez kasyna, wpłat i transferów. Maksymalnie 200 najnowszych kuponów. {model.coverageLabel}.</p>
          </div>
        </details>
      </section>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.6fr)]">
        {coupon && <section className="app-surface min-w-0 rounded-xl p-5" aria-label={coupon.status === 'won' ? 'Najwyższa wypłata' : 'Ostatni kupon'}>
          <h2 className="text-base font-semibold">{coupon.status === 'won' ? 'Najwyższa wypłata' : 'Ostatni kupon'}</h2>
          <div className="mt-4 flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">{formatReplayDate(coupon.created_at)}</span>
            <span className="replay-status font-medium" data-status={coupon.status}>{STATUS_LABELS[coupon.status]}</span>
          </div>
          <p className="mt-3 break-words text-base font-semibold">{coupon.legs?.[0]?.bet_title || 'Kupon'}</p>
          <p className="mt-2 break-words text-2xl font-bold tabular-nums">{coupon.status === 'pending' ? '—' : formatReplayMoney(Math.round(coupon.payout * 100))}<span className="sr-only"> wypłaty</span></p>
          <div className="mt-4 border-t border-border pt-4"><ReplayCouponDetails coupon={coupon} /></div>
        </section>}
        <ReplayHistoryList model={model} />
      </div>
    </div>
  );
}
