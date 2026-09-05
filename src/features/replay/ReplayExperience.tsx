import { useId, useState } from 'react';
import { Share2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { CouponHistoryEntry } from '@/types/database';

import { formatReplayDate, formatReplayMoney, replayChart, STATUS_LABELS, type ReplayModel } from './model';
import { ReplayShare } from './ReplayShare';

const STATUS_SYMBOLS = { won: '✓', lost: '×', pending: '·', refund: '↩' };
const COUNT_LABELS = { won: 'Wygrane', lost: 'Przegrane', pending: 'W grze', refund: 'Zwroty' };

function CouponTicket({ coupon }: { coupon: CouponHistoryEntry }) {
  return (
    <article className="replay-ticket">
      <div className="replay-ticket-top">
        <time dateTime={coupon.created_at}>{formatReplayDate(coupon.created_at)}</time>
        <span className="replay-status" data-status={coupon.status}>{STATUS_LABELS[coupon.status]}</span>
      </div>
      <h3>{coupon.legs?.[0]?.bet_title || 'Kupon sportsbook'}</h3>
      <dl className="replay-ticket-values">
        <div><dt>Stawka</dt><dd>{formatReplayMoney(Math.round(coupon.stake * 100))}</dd></div>
        <div><dt>Kurs</dt><dd className="replay-odds">{coupon.total_odds.toFixed(2)}</dd></div>
        <div><dt>{coupon.status === 'pending' ? 'Wypłata' : 'Wypłata ze stawką'}</dt><dd className="replay-payout">{coupon.status === 'pending' ? '—' : formatReplayMoney(Math.round(coupon.payout * 100))}</dd></div>
      </dl>
      <details>
        <summary>Szczegóły kuponu{coupon.legs?.length ? ` (${coupon.legs.length})` : ''}</summary>
        {coupon.legs?.length ? <ul className="replay-legs">{coupon.legs.map((leg) => (
          <li key={leg.id}>
            <strong>{leg.bet_title || 'Wydarzenie'}</strong>
            <span>{leg.selected_option} · {leg.odds_at_time.toFixed(2)} · {STATUS_LABELS[leg.result]}</span>
          </li>
        ))}</ul> : <p className="replay-muted">Brak szczegółów tego kuponu.</p>}
      </details>
    </article>
  );
}

function Balance({ model }: { model: ReplayModel }) {
  // Identity-based selection survives a refresh without pointing at a different coupon.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const id = useId();
  const selectedIndex = model.timeline.findIndex(({ coupon }) => coupon.id === selectedId);
  const index = selectedIndex < 0 ? model.timeline.length - 1 : selectedIndex;
  const moment = model.timeline[index];
  const chart = replayChart(model.timeline.map((entry) => entry.cumulativeCents));
  const point = chart.points[index + 1];
  const fill = `${chart.path} L976,${chart.zeroY} L24,${chart.zeroY} Z`;

  return (
    <section className="app-surface replay-balance" aria-label="Bilans kuponów">
      <div className="replay-summary">
        <div className="replay-result">
          <h2>Wynik netto</h2>
          <p className="replay-big-money" data-negative={model.netCents < 0}>{model.settledCount ? formatReplayMoney(model.netCents, true) : '—'}</p>
          <p className="replay-muted">{model.settledCount ? 'Rozliczone kupony · wirtualne zł' : 'Kupony czekają na rozliczenie'}</p>
        </div>
        <dl className="replay-stats">
          <div><dt>Kupony</dt><dd>{model.coupons.length}</dd></div>
          <div><dt>Trafność</dt><dd>{model.winRate === null ? '—' : `${model.winRate}%`}</dd></div>
        </dl>
      </div>
      {moment ? <div className="replay-chart">
        <svg viewBox="0 0 1000 320" preserveAspectRatio="none" role="img" aria-label="Bilans kuponów w kolejności postawienia">
          <path d={fill} className="replay-chart-fill" />
          <line x1="24" x2="976" y1={chart.zeroY} y2={chart.zeroY} className="replay-chart-zero" />
          <path d={chart.path} className="replay-chart-line" />
          {point && <><line x1={point.x} x2={point.x} y1="20" y2="300" className="replay-chart-cursor" /><circle cx={point.x} cy={point.y} r="5" className="replay-chart-dot" /></>}
        </svg>
        <input id={id} type="range" aria-label="Odtwórz bilans kuponów" min={0} max={model.timeline.length - 1} value={index} disabled={model.timeline.length < 2} onChange={(event) => setSelectedId(model.timeline[Number(event.target.value)].coupon.id)} aria-valuetext={`${formatReplayDate(moment.coupon.created_at)}, ${STATUS_LABELS[moment.coupon.status]}, bilans ${formatReplayMoney(moment.cumulativeCents, true)}`} />
        <output htmlFor={id} className="replay-chart-output"><span>{formatReplayDate(moment.coupon.created_at)} · {STATUS_LABELS[moment.coupon.status]}</span><strong>{formatReplayMoney(moment.cumulativeCents, true)}</strong></output>
      </div> : <div className="replay-chart-empty">Wykres pojawi się po rozliczeniu kuponów.</div>}
      <dl className="replay-totals">
        <div><dt>Stawki rozliczonych</dt><dd>{formatReplayMoney(model.stakeCents)}</dd></div>
        <div><dt>Wypłaty rozliczonych</dt><dd>{formatReplayMoney(model.payoutCents)}</dd></div>
      </dl>
    </section>
  );
}

function CouponExplorer({ model }: { model: ReplayModel }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const selected = model.coupons.find((coupon) => coupon.id === selectedId) ?? model.highlight;
  const visible = showAll ? model.coupons : model.coupons.slice(-40);
  const highlightSelected = selected?.id === model.highlight?.id && selected?.status === 'won';

  return (
    <section className="replay-explorer" aria-label="Kupony Replay">
      <div className="app-surface replay-map-panel">
        <h2>Kupony</h2>
        <div className="replay-legend">{(Object.keys(STATUS_LABELS) as CouponHistoryEntry['status'][]).map((status) => (
          <span key={status}><i data-status={status} aria-hidden="true">{STATUS_SYMBOLS[status]}</i>{COUNT_LABELS[status]} <b>{model.counts[status]}</b></span>
        ))}</div>
        <div className="replay-map" role="group" aria-label="Mapa kuponów, od najstarszego do najnowszego">{visible.map((coupon, index) => (
          <button type="button" key={coupon.id} data-status={coupon.status} aria-pressed={coupon.id === selected?.id} aria-label={`Kupon ${model.coupons.length - visible.length + index + 1}: ${formatReplayDate(coupon.created_at)}, ${STATUS_LABELS[coupon.status]}`} onClick={() => setSelectedId(coupon.id)}><span aria-hidden="true">{STATUS_SYMBOLS[coupon.status]}</span></button>
        ))}</div>
        {model.coupons.length > 40 && <Button type="button" variant="ghost" className="replay-expand h-11" onClick={() => setShowAll((value) => !value)}>{showAll ? 'Zwiń mapę' : `Pokaż wszystkie (${model.coupons.length})`}</Button>}
      </div>
      <div className="app-surface replay-coupon-panel">
        <h2>{highlightSelected ? 'Największa wypłata' : selectedId ? 'Wybrany kupon' : 'Ostatni kupon'}</h2>
        {selected && <CouponTicket key={selected.id} coupon={selected} />}
        <p className="sr-only" aria-live="polite">{selected ? `Wybrany kupon: ${formatReplayDate(selected.created_at)}, ${STATUS_LABELS[selected.status]}` : ''}</p>
      </div>
    </section>
  );
}

export function ReplayExperience({ model, username }: { model: ReplayModel; username: string }) {
  return (
    <div className="replay-experience">
      <Balance model={model} />
      <CouponExplorer model={model} />
      <div className="replay-share-entry">
        <Dialog>
          <DialogTrigger asChild><Button type="button" className="h-11"><Share2 aria-hidden="true" /> Udostępnij Replay</Button></DialogTrigger>
          <DialogContent className="replay-dialog" hideCloseButton>
            <div className="replay-dialog-header">
              <DialogTitle>Udostępnij Replay</DialogTitle>
              <DialogClose asChild><Button type="button" variant="ghost" size="icon" className="h-11 w-11" aria-label="Zamknij"><X aria-hidden="true" /></Button></DialogClose>
            </div>
            <DialogDescription className="sr-only">Podgląd obrazu ze statystykami. Dodanie nicku jest opcjonalne.</DialogDescription>
            <ReplayShare model={model} username={username} />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
