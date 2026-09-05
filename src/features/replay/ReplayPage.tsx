import { useMemo, useState } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { cn } from '@/lib/utils';

import { buildReplay, PERIOD_LABELS, type ReplayPeriod } from './model';
import { ReplaySummary } from './ReplaySummary';
import { ReplayShare } from './ReplayShare';
import { useReplayHistory } from './useReplayHistory';
import './replay.css';

export default function ReplayPage() {
  usePageTitle('Replay');
  const { user, profile } = useAuth();
  const [period, setPeriod] = useState<ReplayPeriod>('30');
  const history = useReplayHistory(user?.id ?? null);
  const model = useMemo(
    () => history.data ? buildReplay(history.data, period) : null,
    [history.data, period],
  );

  return (
    <div className="h-safe-screen bg-background flex flex-col overflow-hidden">
      <Navbar />
      <main className="replay-page min-h-0 flex-1 overflow-y-auto" aria-label="Replay">
        <div className="replay-content mx-auto w-full max-w-5xl px-3 pt-4 sm:px-6 sm:pt-6">
          <Link to="/profile" className="mb-3 inline-flex min-h-11 items-center gap-2 rounded-md text-sm text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
            <ArrowLeft size={16} aria-hidden="true" /> Profil
          </Link>
          <header className="mb-5 flex items-center justify-between gap-3">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Replay</h1>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="icon" className="h-11 w-11" aria-label="Odśwież Replay" title="Odśwież" disabled={history.isFetching} onClick={() => void history.refetch()}>
                <RefreshCw aria-hidden="true" />
              </Button>
              {model && model.coupons.length > 0 && <ReplayShare key={user?.id} model={model} username={profile?.username ?? 'Gracz'} />}
            </div>
          </header>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <div className="app-subsurface inline-flex rounded-lg p-1" role="group" aria-label="Zakres Replay">
              {(['7', '30', 'all'] as ReplayPeriod[]).map((value) => (
                <button type="button" key={value} aria-pressed={period === value} onClick={() => setPeriod(value)} className={cn(
                  'min-h-11 rounded-md px-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring sm:px-4',
                  period === value ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}>{PERIOD_LABELS[value]}</button>
              ))}
            </div>
            {model && <p className="text-sm text-muted-foreground">{model.rangeLabel}</p>}
          </div>
          {model?.limited && <p className="mb-4 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm" role="status">Zakres jest częściowy: pokazujemy najnowsze 200 kuponów.</p>}
          {history.isError && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm" role="alert">
            <p>{model ? 'Nie udało się odświeżyć danych. Pokazujemy poprzedni zapis.' : 'Nie udało się wczytać Replay.'}</p>
            <Button type="button" variant="outline" disabled={history.isFetching} onClick={() => void history.refetch()}>Spróbuj ponownie</Button>
          </div>}
          {!model && history.isPending && <div className="app-surface rounded-xl p-6" role="status" aria-label="Wczytywanie Replay">
            <p className="text-sm text-muted-foreground">Wczytywanie…</p>
            <div aria-hidden="true" className="mt-4 h-12 w-48 rounded-lg bg-muted" />
            <div aria-hidden="true" className="mt-6 h-48 rounded-lg bg-muted/50" />
          </div>}
          {model && (model.coupons.length > 0 ? <ReplaySummary key={`${user?.id}-${period}`} model={model} /> : (
            <section className="app-surface rounded-xl px-5 py-12 text-center" aria-label="Pusty Replay">
              <h2 className="text-lg font-semibold">Brak kuponów w tym okresie</h2>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                {period !== 'all' && <Button type="button" variant="outline" onClick={() => setPeriod('all')}>Zobacz ostatnie kupony</Button>}
                <Button asChild variant="ghost"><Link to="/profile">Wróć do profilu</Link></Button>
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
