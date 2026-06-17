import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Bet } from '@/types/database';

import type { BetAkoExclusionDraft } from '../api/akoExclusions';

interface AkoExclusionsEditorProps {
  availableBets: Bet[];
  value: BetAkoExclusionDraft[];
  onChange: (value: BetAkoExclusionDraft[]) => void;
  currentBetId?: string;
  disabled?: boolean;
  loading?: boolean;
}

export function AkoExclusionsEditor({
  availableBets,
  value,
  onChange,
  currentBetId,
  disabled = false,
  loading = false,
}: AkoExclusionsEditorProps) {
  const [search, setSearch] = useState('');

  const selectedIds = useMemo(
    () => new Set(value.map((exclusion) => exclusion.betId)),
    [value],
  );

  const matches = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (normalizedSearch.length < 2) {
      return [];
    }

    return availableBets
      .filter((bet) => bet.id !== currentBetId)
      .filter((bet) => !selectedIds.has(bet.id))
      .filter((bet) => bet.title.toLowerCase().includes(normalizedSearch))
      .slice(0, 5);
  }, [availableBets, currentBetId, search, selectedIds]);

  const addBet = (bet: Bet) => {
    onChange([
      ...value,
      {
        betId: bet.id,
        title: bet.title,
        reason: null,
      },
    ]);
    setSearch('');
  };

  const updateReason = (betId: string, reason: string) => {
    onChange(
      value.map((exclusion) =>
        exclusion.betId === betId ? { ...exclusion, reason } : exclusion,
      ),
    );
  };

  const removeBet = (betId: string) => {
    onChange(value.filter((exclusion) => exclusion.betId !== betId));
  };

  return (
    <section className="rounded-xl border border-border bg-background/60 p-4 space-y-3">
      <div className="space-y-1">
        <h4 className="text-sm font-semibold">Wykluczenia AKO</h4>
        <p className="text-xs text-muted-foreground">
          Nie pozwalaj łączyć tego zakładu z wybranymi zdarzeniami na kuponie
          AKO.
        </p>
      </div>

      <div className="space-y-2">
        <Label
          htmlFor="ako-exclusion-search"
          className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
        >
          Szukaj wykluczenia AKO
        </Label>
        <Input
          id="ako-exclusion-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Wpisz tytuł zakładu"
          disabled={disabled}
          className="bg-card"
        />
      </div>

      {loading && (
        <p className="text-xs text-muted-foreground">Wczytywanie wykluczeń…</p>
      )}

      {matches.length > 0 && (
        <div className="space-y-1.5">
          {matches.map((bet) => (
            <button
              key={bet.id}
              type="button"
              onClick={() => addBet(bet)}
              disabled={disabled}
              aria-label={`Dodaj ${bet.title}`}
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="line-clamp-2">{bet.title}</span>
              <Plus className="h-3.5 w-3.5 shrink-0" />
            </button>
          ))}
        </div>
      )}

      {value.length > 0 ? (
        <div className="space-y-2">
          {value.map((exclusion) => (
            <div
              key={exclusion.betId}
              className="rounded-lg border border-border bg-card p-2.5 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-semibold leading-snug">
                  {exclusion.title}
                </p>
                <button
                  type="button"
                  onClick={() => removeBet(exclusion.betId)}
                  disabled={disabled}
                  aria-label={`Usuń ${exclusion.title}`}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <Input
                value={exclusion.reason ?? ''}
                onChange={(event) =>
                  updateReason(exclusion.betId, event.target.value)
                }
                disabled={disabled}
                aria-label={`Powód dla ${exclusion.title}`}
                placeholder="Powód (opcjonalnie)"
                className="h-8 bg-background text-xs"
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Brak wykluczeń dla tego zakładu.
        </p>
      )}
    </section>
  );
}
