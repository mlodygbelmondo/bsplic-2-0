import { useEffect, useState } from 'react';
import { Bot, Loader2, RefreshCw, RotateCcw, Send } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  commandEniu,
  fetchEniuBotRuns,
  retryEniuResponse,
  type EniuBotRun,
  type EniuSourceType,
} from '@/features/social/api/eniuBot';
import { cn } from '@/lib/utils';

function formatRunDate(value: string) {
  return new Date(value).toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function runStatusLabel(status: EniuBotRun['status']) {
  if (status === 'success') return 'Sukces';
  if (status === 'skipped') return 'Pominięto';
  if (status === 'error') return 'Błąd';
  return 'W toku';
}

function diagnosticText(value: unknown, key: string) {
  return value && typeof value === 'object' && key in value
    ? String((value as Record<string, unknown>)[key] ?? '')
    : '';
}

function diagnosticBoolean(value: unknown, key: string) {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)[key] === true
    : false;
}

function diagnosticMaxTokens(value: unknown) {
  const raw =
    value && typeof value === 'object'
      ? (value as Record<string, unknown>).maxTokens
      : null;
  return typeof raw === 'number' && Number.isFinite(raw)
    ? `${Math.round(raw / 1000)}k`
    : '';
}

function isRetryableSourceType(value: string): value is EniuSourceType {
  return value === 'post' || value === 'comment';
}

export default function EniuBotTab() {
  const [command, setCommand] = useState('');
  const [preview, setPreview] = useState(false);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [runs, setRuns] = useState<EniuBotRun[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [retryingRunId, setRetryingRunId] = useState<string | null>(null);

  const loadRuns = async () => {
    setLoadingRuns(true);
    try {
      setRuns(await fetchEniuBotRuns(20));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Nie udało się pobrać logów Eniu';
      toast.error(message);
    } finally {
      setLoadingRuns(false);
    }
  };

  useEffect(() => {
    void loadRuns();
  }, []);

  const submitCommand = async () => {
    const trimmedCommand = command.trim();
    if (!trimmedCommand || submitting) return;

    setSubmitting(true);
    setPreviewText(null);
    try {
      const result = await commandEniu(trimmedCommand, preview);
      if (!result.ok) {
        throw new Error(result.error || 'Eniu nie wykonał komendy');
      }

      if (result.preview) {
        setPreviewText(result.text);
        toast.success('Eniu przygotował podgląd posta');
      } else {
        setCommand('');
        toast.success('Eniu opublikował post');
        await loadRuns();
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Nie udało się wykonać komendy';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const retryRun = async (run: EniuBotRun) => {
    if (!isRetryableSourceType(run.sourceType) || retryingRunId) return;

    setRetryingRunId(run.id);
    try {
      const result = await retryEniuResponse(run.sourceType, run.sourceId);
      if (!result.ok) {
        throw new Error(result.error || 'Eniu nie odpowiedział');
      }

      toast.success(
        result.text ? 'Eniu odpowiedział' : 'Ponowienie sprawdzone',
      );
      await loadRuns();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Nie udało się ponowić odpowiedzi Eniu';
      toast.error(message);
    } finally {
      setRetryingRunId(null);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
      <section className="rounded-lg border border-border bg-card p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Komenda dla Eniu</h2>
            <p className="text-sm text-muted-foreground">
              Domyślnie publikuje od razu jako Eniu Bukmacher.
            </p>
          </div>
        </div>

        <Textarea
          value={command}
          onChange={(event) => setCommand(event.target.value)}
          placeholder="Napisz post o dzisiejszych kuponach i trochę podkręć ekipę..."
          className="min-h-[150px] resize-y"
        />

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-3 text-sm font-medium">
            <Switch checked={preview} onCheckedChange={setPreview} />
            Tylko podgląd
          </label>

          <Button
            onClick={submitCommand}
            disabled={!command.trim() || submitting}
            className="min-h-11 w-full justify-center sm:w-auto"
          >
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            {preview ? 'Wygeneruj podgląd' : 'Wyślij Eniu'}
          </Button>
        </div>

        {previewText && (
          <div className="mt-5 rounded-md border border-border bg-muted/40 p-4">
            <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">
              Podgląd
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {previewText}
            </p>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Logi Eniu</h2>
            <p className="text-sm text-muted-foreground">
              Ostatnie odpowiedzi, komendy i błędy.
            </p>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="min-h-11 min-w-11"
            onClick={loadRuns}
            disabled={loadingRuns}
          >
            <RefreshCw
              className={cn('h-4 w-4', loadingRuns && 'animate-spin')}
            />
          </Button>
        </div>

        {loadingRuns ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Ładowanie logów...
          </div>
        ) : runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Brak logów Eniu.</p>
        ) : (
          <div className="space-y-3">
            {runs.map((run) => (
              <article
                key={run.id}
                className="rounded-md border border-border bg-background p-3"
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-bold',
                      run.status === 'success' &&
                        'bg-emerald-500/10 text-emerald-600',
                      run.status === 'skipped' &&
                        'bg-muted text-muted-foreground',
                      run.status === 'error' &&
                        'bg-destructive/10 text-destructive',
                      run.status === 'pending' && 'bg-primary/10 text-primary',
                    )}
                  >
                    {runStatusLabel(run.status)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatRunDate(run.createdAt)}
                  </span>
                </div>
                <p className="text-sm font-medium">{run.sourceType}</p>
                {run.providerDiagnostic && (
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-medium text-muted-foreground">
                    {diagnosticText(run.providerDiagnostic, 'model') && (
                      <span>
                        {diagnosticText(run.providerDiagnostic, 'model')}
                      </span>
                    )}
                    {diagnosticBoolean(run.providerDiagnostic, 'stream') && (
                      <span>stream</span>
                    )}
                    {diagnosticMaxTokens(run.providerDiagnostic) && (
                      <span>{diagnosticMaxTokens(run.providerDiagnostic)}</span>
                    )}
                    <span>
                      reasoning:{' '}
                      {diagnosticBoolean(
                        run.providerDiagnostic,
                        'reasoningPresent',
                      )
                        ? 'tak'
                        : 'nie'}
                    </span>
                    <span>
                      content:{' '}
                      {diagnosticBoolean(
                        run.providerDiagnostic,
                        'contentPresent',
                      )
                        ? 'tak'
                        : 'nie'}
                    </span>
                  </div>
                )}
                {run.error && (
                  <p className="mt-1 text-xs text-destructive">{run.error}</p>
                )}
                {run.status === 'error' &&
                  isRetryableSourceType(run.sourceType) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3 min-h-11 justify-center text-sm sm:min-h-0 sm:h-9"
                      aria-label="Ponów odpowiedź Eniu"
                      onClick={() => retryRun(run)}
                      disabled={retryingRunId !== null}
                    >
                      {retryingRunId === run.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RotateCcw className="mr-2 h-4 w-4" />
                      )}
                      Ponów
                    </Button>
                  )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
