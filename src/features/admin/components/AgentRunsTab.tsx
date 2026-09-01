import { useCallback, useEffect, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  Clock3,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react';
import { toast } from 'sonner';

import { SectionLoader } from '@/components/SectionLoader';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';

interface AgentRun {
  id: string;
  kind: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  created_count: number;
  settled_count: number;
  held_count: number;
  summary: Json;
  report: string | null;
}

function numberFromSummary(summary: Json, keys: string[]): number {
  if (!summary || Array.isArray(summary) || typeof summary !== 'object')
    return 0;

  for (const key of keys) {
    const value = summary[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (Array.isArray(value)) return value.length;
  }
  return 0;
}

function formatDate(value: string | null): string {
  if (!value) return 'w toku';
  return new Intl.DateTimeFormat('pl-PL', {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(new Date(value));
}

const statusPresentation: Record<
  string,
  {
    label: string;
    badgeClassName: string;
    icon: typeof CheckCircle2;
    iconClassName: string;
  }
> = {
  running: {
    label: 'W toku',
    badgeClassName: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
    icon: Clock3,
    iconClassName: 'text-blue-600',
  },
  ok: {
    label: 'OK',
    badgeClassName: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    icon: CheckCircle2,
    iconClassName: 'text-emerald-600',
  },
  partial: {
    label: 'Częściowy',
    badgeClassName: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    icon: TriangleAlert,
    iconClassName: 'text-amber-600',
  },
  failed: {
    label: 'Błąd',
    badgeClassName: 'bg-red-500/10 text-red-700 dark:text-red-300',
    icon: TriangleAlert,
    iconClassName: 'text-red-600',
  },
};

function presentationFor(status: string) {
  return (
    statusPresentation[status] ?? {
      label: status,
      badgeClassName: 'bg-muted text-muted-foreground',
      icon: TriangleAlert,
      iconClassName: 'text-amber-600',
    }
  );
}

export default function AgentRunsTab() {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadRuns = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const { data, error } = await supabase
        .from('agent_runs')
        .select(
          'id, kind, status, started_at, finished_at, created_count, settled_count, held_count, summary, report',
        )
        .order('started_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setRuns(data ?? []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nieznany błąd';
      toast.error(`Nie udało się pobrać runów agenta: ${message}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  if (loading) return <SectionLoader label="Wczytywanie runów agenta..." />;

  const latest = runs[0];
  const latestSkipped = latest
    ? numberFromSummary(latest.summary, ['skipped', 'skipped_count'])
    : 0;
  const latestErrors = latest
    ? numberFromSummary(latest.summary, ['errors', 'error_count'])
    : 0;
  const latestPresentation = latest
    ? presentationFor(latest.status)
    : undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Automatyczny agent betów</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Codzienny run: rozliczenie zakończonych betów i dodanie nowych.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={refreshing}
          onClick={() => void loadRuns(true)}
        >
          <RefreshCw
            className={cn('mr-2 h-4 w-4', refreshing && 'animate-spin')}
          />
          Odśwież
        </Button>
      </div>

      {latest ? (
        <div className="rounded-xl bg-card p-4 card-shadow">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Bot className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">Ostatni run</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(latest.started_at)}
                </p>
              </div>
            </div>
            <span
              className={cn(
                'rounded-full px-2.5 py-1 text-xs font-semibold',
                latestPresentation?.badgeClassName,
              )}
            >
              {latestPresentation?.label}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              ['Dodane', latest.created_count],
              ['Rozliczone', latest.settled_count],
              ['Wstrzymane', latest.held_count],
              ['Pominięte', latestSkipped],
              ['Błędy', latestErrors],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 text-xl font-bold">{value}</p>
              </div>
            ))}
          </div>

          {latest.report && (
            <p className="mt-4 whitespace-pre-wrap rounded-lg border border-border p-3 text-sm">
              {latest.report}
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-xl bg-card p-8 text-center card-shadow">
          <Clock3 className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Agent nie wykonał jeszcze żadnego runu.
          </p>
        </div>
      )}

      {runs.length > 0 && (
        <div className="overflow-hidden rounded-xl bg-card card-shadow">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold">Historia</h3>
          </div>
          <ul className="divide-y divide-border">
            {runs.map((run) => {
              const presentation = presentationFor(run.status);
              const Icon = presentation.icon;
              const errors = numberFromSummary(run.summary, [
                'errors',
                'error_count',
              ]);
              return (
                <li key={run.id} className="flex items-center gap-3 px-4 py-3">
                  <Icon
                    className={cn(
                      'h-4 w-4 shrink-0',
                      presentation.iconClassName,
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {formatDate(run.started_at)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      +{run.created_count} dodanych, {run.settled_count}{' '}
                      rozliczonych, {run.held_count} wstrzymanych, {errors}{' '}
                      błędów
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {presentation.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
