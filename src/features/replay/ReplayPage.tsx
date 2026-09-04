import { useMemo, useState } from 'react';
import { ArrowLeft, RefreshCw, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/contexts/AuthContext';
import { usePageTitle } from '@/hooks/usePageTitle';

import { buildReplay, PERIOD_LABELS, type ReplayPeriod } from './model';
import { ReplayExperience } from './ReplayExperience';
import { useReplayHistory } from './useReplayHistory';
import './replay.css';

export default function ReplayPage() {
  usePageTitle('Twój Replay');
  const { user, profile } = useAuth();
  const [period, setPeriod] = useState<ReplayPeriod>('30');
  const history = useReplayHistory(user?.id ?? null);
  const model = useMemo(() => history.data ? buildReplay(history.data, period) : null, [history.data, period]);

  return (
    <main className="replay-page">
      <div className="replay-shell">
        <header className="replay-header">
          <h1 className="replay-brand">BSPLIC 2.0 <span>REPLAY</span></h1>
          <Link to="/profile" className="replay-button"><ArrowLeft aria-hidden="true" size={17} /> Do profilu</Link>
        </header>
        <div className="replay-toolbar">
          <div className="replay-periods" role="group" aria-label="Zakres Replay">
            {(Object.keys(PERIOD_LABELS) as ReplayPeriod[]).map((value) => <button type="button" key={value} aria-pressed={period === value} onClick={() => setPeriod(value)}>{PERIOD_LABELS[value]}</button>)}
          </div>
          <button type="button" className="replay-button replay-refresh" aria-label="Odśwież Replay" disabled={history.isFetching} onClick={() => void history.refetch()}><RefreshCw aria-hidden="true" size={17} /><span>{history.isFetching ? 'Odświeżanie…' : 'Odśwież'}</span></button>
        </div>
        <p className="replay-range">Według daty postawienia · sportsbook · ostatnie 200 kuponów · wirtualne zł{model && <> <br />{model.rangeLabel} · {model.coverageLabel}</>}</p>
        {model?.limited && <p className="replay-notice" role="status">Dużo się działo! Pokazujemy najnowsze 200 kuponów. Ten zakres jest częściowy — nie traktuj go jako pełnych statystyk okresu.</p>}
        {history.isError && <div className="replay-notice" role="alert">{model ? 'Nie udało się odświeżyć danych. Pokazujemy poprzedni zapis.' : 'Nie udało się wczytać Replay. Sprawdź połączenie i spróbuj ponownie.'}<br /><button type="button" className="replay-button" disabled={history.isFetching} onClick={() => void history.refetch()}>Spróbuj ponownie</button></div>}
        {!model && history.isPending && <div className="replay-stage replay-skeleton" role="status" aria-label="Wczytywanie Replay"><p className="replay-eyebrow">PRZYGOTOWUJEMY TWOJĄ HISTORIĘ</p><i aria-hidden="true" /><i aria-hidden="true" /><p className="replay-copy">Chwila na zebranie kadrów…</p></div>}
        {model && (model.coupons.length ? <ReplayExperience key={`${user?.id}-${period}-${history.dataUpdatedAt}`} model={model} username={profile?.username ?? 'Gracz'} /> : <section className="replay-stage replay-empty" aria-label="Pusty Replay"><p className="replay-eyebrow"><Sparkles aria-hidden="true" size={15} /> JESZCZE NIE MA KADRÓW</p><h2>Ta historia<br /><em>czeka na Ciebie.</em></h2><p className="replay-copy">W wybranym zakresie nie ma kuponów. Zobacz starsze wpisy albo wróć do swojego profilu.</p><div className="replay-actions">{period !== 'all' && <button type="button" className="replay-button replay-button-primary" onClick={() => setPeriod('all')}>Zobacz ostatnie kupony</button>}<Link to="/profile" className="replay-button">Wróć do profilu</Link></div></section>)}
        <p className="replay-note">Podsumowanie historii, nie prognoza. Kupony oczekujące nie wpływają na bilans. Zwroty nie wpływają na trafność. Daty w strefie Europe/Warsaw; 7 i 30 dni to ostatnie 7 × 24 i 30 × 24 godziny od pobrania danych.</p>
      </div>
    </main>
  );
}
