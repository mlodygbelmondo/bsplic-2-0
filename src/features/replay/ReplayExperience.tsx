import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowLeft, ArrowRight, Pause, Play, RotateCcw, Sparkles } from 'lucide-react';

import type { CouponHistoryEntry } from '@/types/database';

import { formatReplayDate, formatReplayMoney, replayChart, STATUS_LABELS, type ReplayModel } from './model';
import { ReplayShare } from './ReplayShare';

const CHAPTERS = ['Wejście', 'Bilans', 'Kadr', 'Mapa', 'Finał'];
const STATUS_SYMBOLS = { won: '✓', lost: '×', pending: '·', refund: '↩' };

function CouponTicket({ coupon, compact = false }: { coupon: CouponHistoryEntry; compact?: boolean }) {
  return (
    <article className={`replay-ticket${compact ? ' replay-ticket-compact' : ''}`}>
      <div className="replay-ticket-top"><span>BSPLIC / KUPON</span><span className="replay-status" data-status={coupon.status}>{STATUS_LABELS[coupon.status]}</span></div>
      <p className="replay-note">{formatReplayDate(coupon.created_at)}</p>
      <h3>{coupon.legs?.[0]?.bet_title || 'Kupon sportsbook'}</h3>
      <div className="replay-ticket-value"><span>{coupon.status === 'pending' ? 'Kurs łączny' : 'Wypłata'}</span><strong>{coupon.status === 'pending' ? `×${coupon.total_odds.toFixed(2)}` : formatReplayMoney(Math.round(coupon.payout * 100))}</strong></div>
      <div className="replay-ticket-meta"><span>Stawka <b>{formatReplayMoney(Math.round(coupon.stake * 100))}</b></span><span>Kurs <b>×{coupon.total_odds.toFixed(2)}</b></span></div>
      <details>
        <summary>Szczegóły kuponu{coupon.legs?.length ? ` (${coupon.legs.length})` : ''}</summary>
        {coupon.legs?.length ? <ul className="replay-legs">{coupon.legs.map((leg) => <li key={leg.id}><strong>{leg.bet_title || 'Wydarzenie'}</strong><span>{leg.selected_option} · ×{leg.odds_at_time.toFixed(2)} · {STATUS_LABELS[leg.result]}</span></li>)}</ul> : <p className="replay-note">Brak szczegółów tego kuponu.</p>}
      </details>
    </article>
  );
}

function BalanceScene({ model }: { model: ReplayModel }) {
  const [selected, setSelected] = useState(Math.max(0, model.timeline.length - 1));
  const id = useId();
  const chart = replayChart(model.timeline.map((moment) => moment.cumulativeCents));
  const moment = model.timeline[selected];
  const point = chart.points[selected + 1];
  return (
    <div className="replay-balance">
      <p className="replay-eyebrow">02 / LICZBY BEZ FILTRA</p>
      <h2>Wzloty. Spadki.<br /><em>Cały obraz.</em></h2>
      <p className="replay-big-money" data-negative={model.netCents < 0}>{model.settledCount ? formatReplayMoney(model.netCents, true) : 'Jeszcze w grze'}</p>
      <p className="replay-note">Bilans rozliczonych kuponów w tym zestawieniu. To nie saldo konta.</p>
      <div className="replay-chart">
        <svg viewBox="0 0 1000 320" role="img" aria-label="Bilans kuponów w kolejności postawienia">
          <line x1="24" x2="976" y1={chart.zeroY} y2={chart.zeroY} className="replay-chart-zero" />
          <path d={chart.path} className="replay-chart-line" />
          {point && <><line x1={point.x} x2={point.x} y1="20" y2="300" className="replay-chart-cursor" /><circle cx={point.x} cy={point.y} r="8" className="replay-chart-dot" /></>}
        </svg>
        {moment ? <>
          <label htmlFor={id}>Przesuń, aby odtworzyć bilans</label>
          <input id={id} type="range" min={0} max={model.timeline.length - 1} value={selected} disabled={model.timeline.length < 2} onChange={(event) => setSelected(Number(event.target.value))} aria-valuetext={`${formatReplayDate(moment.coupon.created_at)}, ${STATUS_LABELS[moment.coupon.status]}, bilans ${formatReplayMoney(moment.cumulativeCents, true)}`} />
          <output htmlFor={id} className="replay-chart-output">{formatReplayDate(moment.coupon.created_at)} · {STATUS_LABELS[moment.coupon.status]} <strong>{formatReplayMoney(moment.cumulativeCents, true)}</strong></output>
        </> : <p className="replay-note">Bilans pojawi się po rozliczeniu kuponów. Oczekujące nie są liczone jako przegrane.</p>}
      </div>
      <div className="replay-metrics"><div><span>Rozliczone</span><strong>{model.settledCount}</strong></div><div><span>Stawki rozliczonych</span><strong>{formatReplayMoney(model.stakeCents)}</strong></div><div><span>Wypłaty rozliczonych</span><strong>{formatReplayMoney(model.payoutCents)}</strong></div></div>
    </div>
  );
}

function MapScene({ model }: { model: ReplayModel }) {
  const [selectedId, setSelectedId] = useState(model.coupons[model.coupons.length - 1]?.id);
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? model.coupons : model.coupons.slice(-40);
  const selected = model.coupons.find((coupon) => coupon.id === selectedId);
  return (
    <div>
      <p className="replay-eyebrow">04 / KAŻDY KUPON MA SWOJE MIEJSCE</p>
      <h2>Twoja <em>mapa gry.</em></h2>
      <p className="replay-copy">Każdy kafelek to prawdziwy kupon. Dotknij go i wróć do szczegółów.</p>
      <div className="replay-map-layout">
        <div>
          <div className="replay-legend">{(Object.keys(STATUS_LABELS) as CouponHistoryEntry['status'][]).map((status) => <span key={status}><i data-status={status} aria-hidden="true">{STATUS_SYMBOLS[status]}</i>{STATUS_LABELS[status]} <b>{model.counts[status]}</b></span>)}</div>
          <div className="replay-map" role="group" aria-label="Mapa kuponów, od najstarszego do najnowszego">{visible.map((coupon, index) => <button type="button" key={coupon.id} data-status={coupon.status} aria-pressed={coupon.id === selectedId} aria-label={`Kupon ${model.coupons.length - visible.length + index + 1}: ${formatReplayDate(coupon.created_at)}, ${STATUS_LABELS[coupon.status]}`} onClick={() => setSelectedId(coupon.id)}><span aria-hidden="true">{STATUS_SYMBOLS[coupon.status]}</span></button>)}</div>
          <p className="replay-note">Od najstarszego do najnowszego · {visible.length} z {model.coupons.length}</p>
          {model.coupons.length > 40 && <button type="button" className="replay-button" onClick={() => setShowAll((value) => !value)}>{showAll ? 'Zwiń mapę' : `Pokaż wszystkie (${model.coupons.length})`}</button>}
          <div className="replay-metrics replay-metrics-two"><div><span>Trafność wygrane / (wygrane + przegrane)</span><strong>{model.winRate === null ? '—' : `${model.winRate}%`}</strong></div><div><span>Dni z kuponem</span><strong>{model.activeDays}</strong></div></div>
        </div>
        <div>{selected && <CouponTicket key={selected.id} coupon={selected} compact />}<p className="sr-only" aria-live="polite">{selected ? `Wybrany kupon: ${formatReplayDate(selected.created_at)}, ${STATUS_LABELS[selected.status]}` : ''}</p></div>
      </div>
    </div>
  );
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

export function ReplayExperience({ model, username }: { model: ReplayModel; username: string }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [chapter, setChapter] = useState(0);
  const [playing, setPlaying] = useState(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!playing || reducedMotion || chapter === CHAPTERS.length - 1) return;
    const timer = window.setTimeout(() => {
      setChapter((value) => value + 1);
      if (chapter === CHAPTERS.length - 2) setPlaying(false);
    }, 7000);
    return () => window.clearTimeout(timer);
  }, [chapter, playing, reducedMotion]);

  useEffect(() => {
    if (reducedMotion) setPlaying(false);
  }, [reducedMotion]);

  useEffect(() => {
    const pauseWhenHidden = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener('visibilitychange', pauseWhenHidden);
    return () => document.removeEventListener('visibilitychange', pauseWhenHidden);
  }, []);

  const goTo = (index: number) => {
    setPlaying(false);
    setChapter(Math.max(0, Math.min(CHAPTERS.length - 1, index)));
    stageRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable="true"]'))) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      goTo(chapter + (event.key === 'ArrowRight' ? 1 : -1));
    }
  };

  return (
    <section className="replay-experience" aria-label="Twój Replay" aria-roledescription="karuzela" onKeyDown={onKeyDown}>
      <div className="replay-controls">
        <nav aria-label="Rozdziały Replay"><ol className="replay-chapters">{CHAPTERS.map((label, index) => <li key={label}><button type="button" aria-label={`Rozdział ${index + 1}: ${label}`} aria-current={chapter === index ? 'step' : undefined} onClick={() => goTo(index)}><span className="replay-chapter-number">0{index + 1}</span><span className="replay-chapter-label">{label}</span><i aria-hidden="true" className={playing && chapter === index ? 'is-playing' : ''} /></button></li>)}</ol></nav>
        <button type="button" className="replay-button replay-autoplay" disabled={reducedMotion || chapter === CHAPTERS.length - 1} aria-label={playing ? 'Wstrzymaj Replay' : 'Odtwórz automatycznie'} aria-pressed={playing} onClick={() => setPlaying((value) => !value)}>{playing ? <Pause aria-hidden="true" size={18} /> : <Play aria-hidden="true" size={18} />}</button>
      </div>
      <p className="sr-only" aria-live={playing ? 'off' : 'polite'}>{CHAPTERS[chapter]}, rozdział {chapter + 1} z {CHAPTERS.length}</p>
      <div ref={stageRef} className="replay-stage" onFocusCapture={() => setPlaying(false)} onPointerDown={() => setPlaying(false)} onMouseEnter={() => setPlaying(false)}>
        <div className="replay-scene" key={chapter}>
          {chapter === 0 && <div className="replay-intro">
            <div><p className="replay-eyebrow"><Sparkles aria-hidden="true" size={15} /> BSPLIC ORIGINAL / TWÓJ REPLAY</p><h2>Twoja gra.<br /><em>Bez filtra.</em></h2><p className="replay-copy"><b className="replay-username">{username}</b>, za każdym kuponem jest historia. Przewiń swoją — od pierwszego ruchu do ostatniego wyniku.</p><button type="button" className="replay-button replay-button-primary" onClick={() => goTo(1)}>Zobacz swoją historię <ArrowRight aria-hidden="true" size={18} /></button><div className="replay-metrics"><div><span>Kupony</span><strong>{model.coupons.length}</strong></div><div><span>Wygrane</span><strong>{model.counts.won}</strong></div><div><span>Dni z kuponem</span><strong>{model.activeDays}</strong></div></div></div>
            <div className="replay-art"><div className="replay-orbits" aria-hidden="true"><i /><i /><i /></div><div className="replay-cover-ticket"><div className="replay-ticket-top"><span>BSPLIC 2.0</span><Sparkles aria-hidden="true" size={24} /></div><span className="replay-edition">EDYCJA OSOBISTA / {model.periodLabel}</span><strong className="replay-cover-number">{String(model.coupons.length).padStart(2, '0')}</strong><span className="replay-cover-label">KUPONY W KADRZE</span><div className="replay-ticket-perforation" /><div className="replay-cover-footer"><span>TWOJA GRA.<br />TWOJE EMOCJE.</span><span className="replay-cover-arrow" aria-hidden="true">↗</span></div><div className="replay-barcode" aria-hidden="true" /></div><span className="replay-art-stamp" aria-hidden="true">NIE DO PODROBIENIA.</span></div>
          </div>}
          {chapter === 1 && <BalanceScene model={model} />}
          {chapter === 2 && <div className="replay-highlight"><div><p className="replay-eyebrow">03 / ZATRZYMAJ TEN KADR</p><h2>{model.highlight?.status === 'won' ? <>Ten kupon.<br /><em>Ten moment.</em></> : <>Każdy wynik<br /><em>to historia.</em></>}</h2><p className="replay-copy">{model.highlight?.status === 'won' ? 'Największa wypłata z wygranego kuponu w tym zestawieniu. Oto szczegóły, nie tylko liczba.' : 'W tym zestawieniu nie ma jeszcze wygranej. Zamiast wymyślać rekord, wracamy do Twojego ostatniego kuponu.'}</p><p className="replay-note">Wypłata zawiera zwróconą stawkę. Bilans netto zobaczysz w rozdziale „Bilans”.</p></div>{model.highlight && <CouponTicket coupon={model.highlight} />}</div>}
          {chapter === 3 && <MapScene model={model} />}
          {chapter === 4 && <ReplayShare model={model} username={username} />}
        </div>
      </div>
      <footer className="replay-footer"><button type="button" className="replay-button" onClick={() => goTo(chapter - 1)} disabled={chapter === 0}><ArrowLeft aria-hidden="true" size={18} /><span>Wstecz</span></button><span className="replay-footer-count">0{chapter + 1} / 05</span>{chapter < CHAPTERS.length - 1 ? <button type="button" className="replay-button replay-button-primary" onClick={() => goTo(chapter + 1)}>Dalej <ArrowRight aria-hidden="true" size={18} /></button> : <button type="button" className="replay-button" onClick={() => goTo(0)}><RotateCcw aria-hidden="true" size={18} /> Od początku</button>}</footer>
      <p className="replay-note replay-keyboard-hint">{reducedMotion ? 'Ograniczony ruch: przewijaj rozdziały ręcznie.' : 'Twoje tempo. Strzałki ← → lub przyciski. Auto odtwarzanie jest opcjonalne.'}</p>
    </section>
  );
}
