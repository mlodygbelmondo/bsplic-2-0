import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Clock3,
  Search,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  createMoneyTransfer,
  fetchMoneyTransferRules,
  searchMoneyTransferRecipients,
} from '@/features/transfers/api';
import {
  FALLBACK_MONEY_TRANSFER_RULES,
  formatMoney,
  formatTransferDate,
  parseMoney,
} from '@/features/transfers/format';
import type {
  MoneyTransferRecipient,
  MoneyTransferRules,
} from '@/features/transfers/types';
import { getErrorMessage } from '@/lib/errors';
import type { Profile } from '@/types/database';

interface MoneyTransferSendProps {
  profile: Profile;
  refreshProfile: () => Promise<void>;
  updateProfileBalance: (balance: number) => void;
  onCompleted: () => void;
  onSubmittingChange: (submitting: boolean) => void;
}

function makeIdempotencyKey(): string {
  return globalThis.crypto.randomUUID();
}

export function MoneyTransferSend({
  profile,
  refreshProfile,
  updateProfileBalance,
  onCompleted,
  onSubmittingChange,
}: MoneyTransferSendProps) {
  const [query, setQuery] = useState('');
  const [recipients, setRecipients] = useState<MoneyTransferRecipient[]>([]);
  const [selectedRecipient, setSelectedRecipient] =
    useState<MoneyTransferRecipient | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [amountInput, setAmountInput] = useState('');
  const [message, setMessage] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [rules, setRules] = useState<MoneyTransferRules | null>(null);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [rulesRequest, setRulesRequest] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setRulesError(null);
    fetchMoneyTransferRules()
      .then((next) => {
        if (!cancelled) {
          setRules(next);
        }
      })
      .catch((error) => {
        if (cancelled) return;
        setRules(null);
        const message = getErrorMessage(
          error,
          'Nie udało się pobrać zasad transferów',
        );
        setRulesError(message);
        toast.error(message);
      });
    return () => {
      cancelled = true;
    };
  }, [rulesRequest]);

  const minAmount = rules?.min_amount ?? FALLBACK_MONEY_TRANSFER_RULES.min_amount;
  const messageLimit =
    rules?.max_message_length ??
    FALLBACK_MONEY_TRANSFER_RULES.max_message_length;
  const maxTransfersPerHour =
    rules?.max_transfers_per_hour ??
    FALLBACK_MONEY_TRANSFER_RULES.max_transfers_per_hour;
  const minAccountAgeDays =
    rules?.min_account_age_days ??
    FALLBACK_MONEY_TRANSFER_RULES.min_account_age_days;

  const amount = useMemo(() => parseMoney(amountInput), [amountInput]);
  const messageLength = useMemo(() => Array.from(message).length, [message]);
  const balance = Number(profile.balance);
  const balanceAfter = amount === null ? balance : balance - amount;
  const accountEligibleAt = useMemo(() => {
    if (rules) {
      if (!rules.sender_eligible_at) return null;
      const eligibleAt = new Date(rules.sender_eligible_at).getTime();
      return Number.isFinite(eligibleAt) ? eligibleAt : null;
    }
    const createdAt = new Date(profile.created_at).getTime();
    if (!Number.isFinite(createdAt)) return null;
    return createdAt + minAccountAgeDays * 24 * 60 * 60 * 1000;
  }, [minAccountAgeDays, profile.created_at, rules]);
  const accountIsTooNew = rules
    ? !rules.sender_eligible
    : accountEligibleAt !== null && accountEligibleAt > Date.now();

  useEffect(() => {
    if (!rules || rules.sender_eligible || accountEligibleAt === null) return;

    const serverNow = new Date(rules.server_now).getTime();
    if (!Number.isFinite(serverNow)) return;

    const timeoutId = window.setTimeout(
      () => setRulesRequest((current) => current + 1),
      Math.max(accountEligibleAt - serverNow, 0) + 50,
    );
    return () => window.clearTimeout(timeoutId);
  }, [accountEligibleAt, rules]);

  useEffect(() => {
    if (selectedRecipient) return;

    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      setRecipients([]);
      setSearchError(null);
      setSearching(false);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const results = await searchMoneyTransferRecipients(normalizedQuery);
        if (!cancelled) setRecipients(results);
      } catch (error) {
        if (!cancelled) {
          setRecipients([]);
          setSearchError(
            getErrorMessage(error, 'Nie udało się wyszukać użytkowników'),
          );
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [query, selectedRecipient]);

  const getValidationError = () => {
    if (!rules) {
      return rulesError
        ? 'Najpierw ponów pobieranie zasad transferów'
        : 'Poczekaj na pobranie zasad transferów';
    }
    if (!selectedRecipient) {
      return 'Wybierz odbiorcę';
    }
    if (amount === null || amount < minAmount) {
      return `Wpisz kwotę co najmniej ${formatMoney(minAmount)} zł`;
    }
    if (amount > balance) {
      return 'Niewystarczające saldo';
    }
    if (messageLength > messageLimit) {
      return `Wiadomość może mieć maksymalnie ${messageLimit} znaków`;
    }
    if (accountIsTooNew) {
      return `Konto nadawcy musi istnieć od co najmniej ${minAccountAgeDays} dni`;
    }
    return null;
  };

  const handleContinue = () => {
    const validationError = getValidationError();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIdempotencyKey(makeIdempotencyKey());
    setConfirming(true);
  };

  const handleSubmit = async () => {
    if (!selectedRecipient || amount === null || !idempotencyKey) return;
    const validationError = getValidationError();
    if (validationError) {
      setConfirming(false);
      setIdempotencyKey(null);
      toast.error(validationError);
      return;
    }

    setSubmitting(true);
    onSubmittingChange(true);
    try {
      const transfer = await createMoneyTransfer({
        recipientId: selectedRecipient.id,
        amount,
        message,
        idempotencyKey,
      });

      updateProfileBalance(transfer.balance_after);
      toast.success(
        `Wysłano ${formatMoney(amount)} zł do @${selectedRecipient.username}`,
      );
      onCompleted();
      void refreshProfile().catch((error) => {
        console.error('Post-transfer profile refresh failed:', error);
      });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Nie udało się wykonać transferu'));
    } finally {
      setSubmitting(false);
      onSubmittingChange(false);
    }
  };

  if (confirming && selectedRecipient && amount !== null) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setIdempotencyKey(null);
          }}
          disabled={submitting}
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Wróć
        </button>

        <div className="app-subsurface rounded-xl border border-border/60 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Sprawdź transfer
          </p>
          <div className="flex items-center gap-3">
            <Avatar className="h-11 w-11">
              <AvatarImage src={selectedRecipient.avatar_url ?? undefined} />
              <AvatarFallback>
                {selectedRecipient.username.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">
                @{selectedRecipient.username}
              </p>
              <p className="text-xs text-muted-foreground">Odbiorca</p>
            </div>
            <p className="text-lg font-black text-primary">
              {formatMoney(amount)} zł
            </p>
          </div>
          {message.trim() && (
            <p className="mt-4 whitespace-pre-wrap break-words rounded-lg bg-background/80 p-3 text-sm text-muted-foreground">
              {message.trim()}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2.5 text-sm">
          <span className="text-muted-foreground">Saldo po transferze</span>
          <strong>{formatMoney(balanceAfter)} zł</strong>
        </div>

        <div className="flex gap-2 rounded-lg bg-amber-500/10 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-300">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Transfer zostanie wykonany natychmiast i nie można go cofnąć.</p>
        </div>

        <Button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={submitting}
          className="h-11 w-full gradient-primary font-bold text-primary-foreground"
        >
          {submitting ? 'Wysyłanie...' : `Wyślij ${formatMoney(amount)} zł`}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {rulesError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          <p>{rulesError}</p>
          <button
            type="button"
            onClick={() => setRulesRequest((current) => current + 1)}
            className="mt-1 font-semibold underline underline-offset-2"
          >
            Spróbuj ponownie
          </button>
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="transfer-recipient" className="text-sm font-semibold">
          Odbiorca
        </label>
        {selectedRecipient ? (
          <div className="flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/5 p-3">
            <Avatar className="h-9 w-9">
              <AvatarImage src={selectedRecipient.avatar_url ?? undefined} />
              <AvatarFallback>
                {selectedRecipient.username.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                @{selectedRecipient.username}
              </p>
              <p className="text-xs text-muted-foreground">
                Wybrany odbiorca
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedRecipient(null);
                setQuery('');
              }}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Zmień
            </button>
          </div>
        ) : (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="transfer-recipient"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Wpisz nazwę użytkownika"
              autoComplete="off"
              className="pl-9"
            />
            {query.trim().length >= 2 && (
              <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border bg-popover p-1 shadow-lg">
                {searching ? (
                  <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                    Szukam...
                  </p>
                ) : searchError ? (
                  <p className="px-3 py-4 text-center text-sm text-destructive">
                    {searchError}
                  </p>
                ) : recipients.length === 0 ? (
                  <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                    Brak dostępnych użytkowników
                  </p>
                ) : (
                  recipients.map((recipient) => (
                    <button
                      key={recipient.id}
                      type="button"
                      onClick={() => setSelectedRecipient(recipient)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-muted"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={recipient.avatar_url ?? undefined} />
                        <AvatarFallback>
                          {recipient.username.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">
                        @{recipient.username}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="transfer-amount" className="text-sm font-semibold">
            Kwota
          </label>
          <button
            type="button"
            onClick={() => setAmountInput(balance.toFixed(2))}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Wyślij całe saldo
          </button>
        </div>
        <div className="relative">
          <Input
            id="transfer-amount"
            inputMode="decimal"
            value={amountInput}
            onChange={(event) => setAmountInput(event.target.value)}
            placeholder="0,00"
            className="pr-12 text-lg font-bold"
          />
          <span className="pointer-events-none absolute right-3 top-2.5 text-sm font-semibold text-muted-foreground">
            zł
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Minimum {formatMoney(minAmount)} zł · maksymalnie{' '}
          {maxTransfersPerHour} transferów w ciągu godziny
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="transfer-message" className="text-sm font-semibold">
            Wiadomość{' '}
            <span className="font-normal text-muted-foreground">
              (opcjonalnie)
            </span>
          </label>
          {messageLength >= messageLimit - 200 && (
            <span className="text-xs text-muted-foreground">
              {messageLength}/{messageLimit}
            </span>
          )}
        </div>
        <Textarea
          id="transfer-message"
          value={message}
          onChange={(event) => {
            if (Array.from(event.target.value).length <= messageLimit) {
              setMessage(event.target.value);
            }
          }}
          rows={3}
          placeholder="Dodaj krótką wiadomość..."
          className="resize-none"
        />
      </div>

      {accountIsTooNew && accountEligibleAt !== null && (
        <div className="flex gap-2 rounded-lg bg-muted px-3 py-2.5 text-xs text-muted-foreground">
          <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Transfery będą dostępne{' '}
            {formatTransferDate(new Date(accountEligibleAt).toISOString())}, po{' '}
            {minAccountAgeDays} dniach od utworzenia konta.
          </p>
        </div>
      )}

      <Button
        type="button"
        onClick={handleContinue}
        disabled={!rules || accountIsTooNew}
        className="h-11 w-full gradient-primary font-bold text-primary-foreground"
      >
        <Send className="mr-2 h-4 w-4" />
        {rules ? 'Dalej' : rulesError ? 'Zasady niedostępne' : 'Ładowanie zasad...'}
      </Button>
    </div>
  );
}
