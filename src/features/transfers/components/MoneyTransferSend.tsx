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
  searchMoneyTransferRecipients,
} from '@/features/transfers/api';
import {
  formatMoney,
  formatTransferDate,
  MONEY_TRANSFER_MESSAGE_LIMIT,
  parseMoney,
} from '@/features/transfers/format';
import type { MoneyTransferRecipient } from '@/features/transfers/types';
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

  const amount = useMemo(() => parseMoney(amountInput), [amountInput]);
  const messageLength = useMemo(() => Array.from(message).length, [message]);
  const balance = Number(profile.balance);
  const balanceAfter = amount === null ? balance : balance - amount;
  const accountEligibleAt = useMemo(() => {
    const createdAt = new Date(profile.created_at).getTime();
    if (!Number.isFinite(createdAt)) return null;
    return createdAt + 14 * 24 * 60 * 60 * 1000;
  }, [profile.created_at]);
  const accountIsTooNew =
    accountEligibleAt !== null && accountEligibleAt > Date.now();

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

  const handleContinue = () => {
    if (!selectedRecipient) {
      toast.error('Wybierz odbiorcę');
      return;
    }
    if (amount === null || amount < 1) {
      toast.error('Wpisz kwotę co najmniej 1,00 zł');
      return;
    }
    if (amount > balance) {
      toast.error('Niewystarczające saldo');
      return;
    }
    if (messageLength > MONEY_TRANSFER_MESSAGE_LIMIT) {
      toast.error('Wiadomość może mieć maksymalnie 2000 znaków');
      return;
    }
    if (accountIsTooNew) {
      toast.error('Konto nadawcy musi istnieć od co najmniej 14 dni');
      return;
    }

    setIdempotencyKey(makeIdempotencyKey());
    setConfirming(true);
  };

  const handleSubmit = async () => {
    if (!selectedRecipient || amount === null || !idempotencyKey) return;

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
          Minimum 1,00 zł · maksymalnie 5 transferów w ciągu godziny
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
          {messageLength >= 1800 && (
            <span className="text-xs text-muted-foreground">
              {messageLength}/{MONEY_TRANSFER_MESSAGE_LIMIT}
            </span>
          )}
        </div>
        <Textarea
          id="transfer-message"
          value={message}
          onChange={(event) => {
            if (
              Array.from(event.target.value).length <=
              MONEY_TRANSFER_MESSAGE_LIMIT
            ) {
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
            {formatTransferDate(new Date(accountEligibleAt).toISOString())}, po
            14 dniach od utworzenia konta.
          </p>
        </div>
      )}

      <Button
        type="button"
        onClick={handleContinue}
        disabled={accountIsTooNew}
        className="h-11 w-full gradient-primary font-bold text-primary-foreground"
      >
        <Send className="mr-2 h-4 w-4" /> Dalej
      </Button>
    </div>
  );
}
