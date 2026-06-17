import { Crown, Loader2, Ticket, Trophy } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import {
  formatJackpotAmount,
  getDrawTimeLabel,
  getParticipantProgressLabel,
} from '../lib/jackpotFormat';
import type { DailyJackpotSnapshot } from '../types';

interface DailyJackpotCardProps {
  snapshot: DailyJackpotSnapshot | null;
  loading: boolean;
  buying: boolean;
  balance: number;
  onBuy: () => void;
}

export function DailyJackpotCard({
  snapshot,
  loading,
  buying,
  balance,
  onBuy,
}: DailyJackpotCardProps) {
  if (loading && !snapshot) {
    return (
      <section className="mb-3 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="h-5 w-32 animate-pulse rounded bg-muted" />
        <div className="mt-3 h-8 w-44 animate-pulse rounded bg-muted" />
      </section>
    );
  }

  if (!snapshot) {
    return null;
  }

  const hasPrize = snapshot.prizeAmount > 0;
  const hasEnoughBalance = balance >= snapshot.ticketPrice;
  const canBuy =
    snapshot.status === 'collecting' &&
    hasPrize &&
    !snapshot.currentUserHasTicket &&
    hasEnoughBalance &&
    !buying;

  const buttonLabel = snapshot.currentUserHasTicket
    ? `Masz ticket #${snapshot.currentUserTicketNumber ?? '?'}`
    : hasEnoughBalance
      ? `Kup ticket za ${formatJackpotAmount(snapshot.ticketPrice)}`
      : 'Brak środków na ticket';

  return (
    <section className="mb-3 overflow-hidden rounded-xl border border-amber-400/25 bg-[linear-gradient(135deg,hsl(var(--card))_0%,rgba(120,53,15,0.22)_52%,hsl(var(--card))_100%)] shadow-[0_12px_36px_rgba(0,0,0,0.22)]">
      <div className="border-b border-amber-300/15 bg-black/10 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-300" />
              <h2 className="text-sm font-black uppercase tracking-wide">
                Jackpot Dnia
              </h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {snapshot.status === 'collecting'
                ? getDrawTimeLabel(
                    snapshot.drawScheduledAt,
                    snapshot.serverNow,
                  )
                : 'Dzisiejszy finał puli'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-200/80">
              Pula
            </p>
            <p className="font-mono text-xl font-black text-amber-200">
              {formatJackpotAmount(snapshot.prizeAmount)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center">
        <div className="space-y-2">
          {snapshot.status === 'collecting' && (
            <>
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-1 text-amber-100">
                  <Ticket className="h-3.5 w-3.5" />
                  {getParticipantProgressLabel(
                    snapshot.participantCount,
                    snapshot.minUniqueUsers,
                  )}
                </span>
                <span>{snapshot.ticketCount} ticketów w puli</span>
              </div>
              {!hasPrize && (
                <p className="text-xs text-muted-foreground">
                  Brak aktywnej puli — wróć jutro.
                </p>
              )}
            </>
          )}

          {snapshot.status === 'locked' && (
            <p className="text-sm font-semibold text-amber-200">
              Losowanie trwa…
            </p>
          )}

          {snapshot.status === 'drawn' && (
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Trophy className="h-4 w-4 text-amber-300" />
              <span>
                Wygrał {snapshot.winnerUsername ?? 'zwycięzca'}
              </span>
              {snapshot.winningTicketNumber !== null && (
                <span className="rounded-md bg-amber-300/10 px-2 py-0.5 text-xs text-amber-100">
                  Ticket #{snapshot.winningTicketNumber}
                </span>
              )}
            </div>
          )}

          {snapshot.status === 'rolled_over' && (
            <p className="text-sm font-semibold text-muted-foreground">
              Za mało uczestników — ticket zwrócony, pula przechodzi na jutro.
            </p>
          )}
        </div>

        <Button
          type="button"
          onClick={onBuy}
          disabled={!canBuy}
          className={cn(
            'min-h-11 justify-center rounded-xl px-4 font-bold',
            canBuy
              ? 'bg-amber-400 text-black hover:bg-amber-300'
              : 'bg-muted text-muted-foreground',
          )}
        >
          {buying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {buttonLabel}
        </Button>
      </div>
    </section>
  );
}
