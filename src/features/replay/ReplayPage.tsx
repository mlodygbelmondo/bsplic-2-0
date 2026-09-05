import { useMemo, useState } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { usePageTitle } from '@/hooks/usePageTitle';

import { buildReplay, PERIOD_LABELS, type ReplayPeriod } from './model';
import { ReplayExperience } from './ReplayExperience';
import { useReplayHistory } from './useReplayHistory';
import './replay.css';

export default function ReplayPage() {
  usePageTitle('Replay');
  const { user, profile } = useAuth();
  const [period, setPeriod] = useState<ReplayPeriod>('30');
  const history = useReplayHistory(user?.id ?? null);
  const model = useMemo(() => history.data ? buildReplay(history.data, period) : null, [history.data, period]);

  return (
    <div className="h-safe-screen bg-background overflow-hidden flex flex-col">
      <Navbar />
      <main className="replay-page">
        <div className="replay-shell">
          <header className="replay-header">
            <div className="replay-title">
              <Button asChild variant="ghost" size="icon" className="h-11 w-11">
                <Link to="/profile" aria-label="Do profilu"><ArrowLeft aria-hidden="true" /></Link>
              </Button>
              <h1>Replay</h1>
            </div>
            <Button type="button" variant="ghost" size="icon" className="h-11 w-11" aria-label="Odśwież Replay" disabled={history.isFetching} onClick={() => void history.refetch()}>
              <RefreshCw aria-hidden="true" />
            </Button>
          </header>
          <div className="replay-toolbar">
            <div className="replay-periods" role="group" aria-label="Zakres Replay">
              {(['7', '30', 'all'] as ReplayPeriod[]).map((value) => (
                <button type="button" key={value} aria-pressed={period === value} onClick={() => setPeriod(value)}>{PERIOD_LABELS[value]}</button>
              ))}
            </div>
            {model && <p className="replay-range">{model.rangeLabel}</p>}
          </div>
          {model?.limited && <p className="replay-notice" role="status">Najnowsze 200 kuponów — zakres jest częściowy.</p>}
          {history.isError && <div className="replay-notice" role="alert">
            <p>{model ? 'Nie udało się odświeżyć. Pokazujemy poprzedni zapis.' : 'Nie udało się wczytać Replay. Spróbuj ponownie.'}</p>
            <Button type="button" variant="outline" className="h-11" disabled={history.isFetching} onClick={() => void history.refetch()}>Spróbuj ponownie</Button>
          </div>}
          {!model && history.isPending && <div className="app-surface replay-skeleton" role="status" aria-label="Wczytywanie Replay"><span className="sr-only">Wczytywanie Replay…</span><i /><i /><i /></div>}
          {model && (model.coupons.length ? (
            <ReplayExperience key={`${user?.id}-${period}`} model={model} username={profile?.username ?? 'Gracz'} />
          ) : (
            <section className="app-surface replay-empty" aria-label="Pusty Replay">
              <h2>Brak kuponów w tym okresie</h2>
              <div className="replay-actions">
                {period !== 'all' && <Button type="button" className="h-11" onClick={() => setPeriod('all')}>Zobacz ostatnie kupony</Button>}
                <Button asChild variant="outline" className="h-11"><Link to="/profile">Wróć do profilu</Link></Button>
              </div>
            </section>
          ))}
          <details className="replay-method">
            <summary>Jak liczymy wynik?</summary>
            <p>Wynik netto to wypłaty minus stawki rozliczonych kuponów. Oczekujące są pomijane. Wypłata zawiera zwróconą stawkę. Trafność to wygrane / (wygrane + przegrane), bez oczekujących i zwrotów.</p>
            <p>Wykres pokazuje wyniki w kolejności postawienia kuponów, nie historię salda ani kolejność rozliczeń. Tylko sportsbook, za wirtualne zł. Maksymalnie 200 najnowszych kuponów.</p>
            <p>7 i 30 dni to okresy 7 × 24 i 30 × 24 godziny od pobrania danych, według daty postawienia. Daty wyświetlamy w strefie Europe/Warsaw.</p>
          </details>
        </div>
      </main>
    </div>
  );
}
