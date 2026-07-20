import { useCallback, useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Check } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { fetchMoneyTransferHistory } from '@/features/transfers/api';
import { formatMoney, formatTransferDate } from '@/features/transfers/format';
import type { MoneyTransferHistoryEntry } from '@/features/transfers/types';
import { getErrorMessage } from '@/lib/errors';

const HISTORY_PAGE_SIZE = 20;

export function MoneyTransferHistory() {
  const [history, setHistory] = useState<MoneyTransferHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const loadHistory = useCallback(async (append: boolean, offset = 0) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const entries = await fetchMoneyTransferHistory(HISTORY_PAGE_SIZE, offset);
      setHistory((current) => (append ? [...current, ...entries] : entries));
      setHasMore(entries.length === HISTORY_PAGE_SIZE);
    } catch (loadError) {
      setError(
        getErrorMessage(loadError, 'Nie udało się pobrać historii transferów'),
      );
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadHistory(false, 0);
  }, [loadHistory]);

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Ładowanie historii...
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3 py-10 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <Button
          type="button"
          variant="outline"
          onClick={() => void loadHistory(false, 0)}
        >
          Spróbuj ponownie
        </Button>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="py-12 text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Check className="h-5 w-5" />
        </div>
        <p className="font-semibold">Brak transferów</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Wysłane i otrzymane środki pojawią się tutaj.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 pr-1">
      {history.map((entry) => {
        const sent = entry.direction === 'sent';
        return (
          <article
            key={entry.id}
            className="rounded-xl border border-border/60 p-3"
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                  sent
                    ? 'bg-muted text-muted-foreground'
                    : 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {sent ? (
                  <ArrowUpRight className="h-4 w-4" />
                ) : (
                  <ArrowDownLeft className="h-4 w-4" />
                )}
              </div>
              <Avatar className="h-9 w-9">
                <AvatarImage
                  src={entry.counterparty_avatar_url ?? undefined}
                />
                <AvatarFallback>
                  {entry.counterparty_username.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {sent ? 'Wysłano do' : 'Otrzymano od'} @
                  {entry.counterparty_username}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {formatTransferDate(entry.created_at)}
                  {entry.counterparty_deleted ? ' · konto usunięte' : ''}
                </p>
              </div>
              <p
                className={`shrink-0 font-black ${
                  sent
                    ? 'text-foreground'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {sent ? '−' : '+'}
                {formatMoney(Number(entry.amount))} zł
              </p>
            </div>
            {entry.message && (
              <p className="mt-2 whitespace-pre-wrap break-words border-t border-border/60 pt-2 text-xs text-muted-foreground">
                {entry.message}
              </p>
            )}
          </article>
        );
      })}
      {hasMore && (
        <Button
          type="button"
          variant="ghost"
          disabled={loadingMore}
          onClick={() => void loadHistory(true, history.length)}
          className="w-full"
        >
          {loadingMore ? 'Ładowanie...' : 'Pokaż starsze'}
        </Button>
      )}
    </div>
  );
}
