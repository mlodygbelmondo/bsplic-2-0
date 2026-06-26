import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Clock3,
  Info,
  Loader2,
  Ticket,
  Users,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

import {
  formatJackpotAmount,
  getDrawTimeLabel,
} from '../lib/jackpotFormat';
import type { DailyJackpotSnapshot } from '../types';
import '../styles/dailyJackpotCard.css';

function formatJackpotHeroAmount(amount: number) {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const hasCents = Math.round(safeAmount) !== safeAmount;

  return `${safeAmount.toLocaleString('pl-PL', {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  })} zł`;
}

function formatCountdown(totalMilliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(totalMilliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

interface DailyJackpotCardProps {
  snapshot: DailyJackpotSnapshot | null;
  loading: boolean;
  buying: boolean;
  balance: number;
  onBuy: () => void;
  onOpenDraw?: (poolId: string) => void;
}

export function DailyJackpotCard({
  snapshot,
  loading,
  buying,
  balance,
  onBuy,
  onOpenDraw,
}: DailyJackpotCardProps) {
  const snapshotStatus = snapshot?.status;
  const drawScheduledAt = snapshot?.drawScheduledAt;
  const serverNow = snapshot?.serverNow;
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    setElapsedSeconds(0);

    if (snapshotStatus !== 'collecting') {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [drawScheduledAt, serverNow, snapshotStatus]);

  const countdownLabel = useMemo(() => {
    if (!drawScheduledAt || !serverNow) {
      return '00:00:00';
    }

    const drawTime = new Date(drawScheduledAt).getTime();
    const currentServerNow = new Date(serverNow).getTime();

    if (!Number.isFinite(drawTime) || !Number.isFinite(currentServerNow)) {
      return '00:00:00';
    }

    return formatCountdown(drawTime - currentServerNow - elapsedSeconds * 1000);
  }, [drawScheduledAt, elapsedSeconds, serverNow]);

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

  if (!snapshot.poolId) {
    return null;
  }

  const userTicketCount = Math.min(
    snapshot.currentUserTicketCount,
    snapshot.maxTicketsPerPlayer,
  );
  const currentUserTicketNumbers =
    snapshot.currentUserTicketNumbers.length > 0
      ? snapshot.currentUserTicketNumbers
      : snapshot.currentUserTicketNumber !== null
        ? [snapshot.currentUserTicketNumber]
        : [];
  const currentUserTicketLabel =
    currentUserTicketNumbers.length > 0
      ? currentUserTicketNumbers
          .map((ticketNumber) => `#${String(ticketNumber).padStart(2, '0')}`)
          .join(' ')
      : null;
  const ticketLimitReached = userTicketCount >= snapshot.maxTicketsPerPlayer;
  const hasEnoughBalance = balance >= snapshot.ticketPrice;
  const canOpenDraw =
    Boolean(snapshot.poolId) &&
    (snapshot.status === 'drawn' ||
      (snapshot.status === 'rolled_over' && snapshot.currentUserHasTicket));
  const canBuy =
    snapshot.status === 'collecting' &&
    !ticketLimitReached &&
    hasEnoughBalance &&
    !buying;
  const actionIsDraw = canOpenDraw;
  const actionEnabled = actionIsDraw || canBuy;

  const statusLabel = (() => {
    if (snapshot.status === 'collecting') {
      return userTicketCount > 0 ? 'Jesteś w grze' : 'Zbieramy tickety';
    }

    if (snapshot.status === 'locked') {
      return 'Losowanie trwa';
    }

    if (snapshot.status === 'drawn') {
      return snapshot.currentUserHasTicket
        ? 'Wynik gotowy do obejrzenia'
        : 'Losowanie zakończone';
    }

    if (snapshot.status === 'rolled_over') {
      return 'Pula przechodzi dalej';
    }

    return 'Pula anulowana';
  })();

  const handlePrimaryAction = () => {
    if (actionIsDraw && snapshot.poolId) {
      if (onOpenDraw) {
        onOpenDraw(snapshot.poolId);
        return;
      }

      window.location.assign(`/jackpot/draw/${snapshot.poolId}`);
      return;
    }

    if (canBuy) {
      onBuy();
    }
  };

  const buttonLabel = (() => {
    if (actionIsDraw) {
      if (snapshot.status === 'rolled_over') {
        return 'Zobacz rozliczenie';
      }

      return snapshot.currentUserHasTicket
        ? 'Przejdź do losowania'
        : 'Obejrzyj losowanie';
    }

    if (snapshot.status === 'locked') {
      return 'Losowanie trwa';
    }

    if (snapshot.status === 'drawn') {
      return 'Finał zakończony';
    }

    if (snapshot.status === 'rolled_over') {
      return 'Pula przechodzi dalej';
    }

    if (snapshot.status === 'cancelled') {
      return 'Pula anulowana';
    }

    if (ticketLimitReached) {
      return 'Limit ticketów wykorzystany';
    }

    if (!hasEnoughBalance) {
      return 'Brak środków na ticket';
    }

    return userTicketCount === 1
      ? `Kup drugi ticket`
      : `Kup ticket`;
  })();
  const legacyLimitLabel = `Limit ticketów ${snapshot.maxTicketsPerPlayer}/${snapshot.maxTicketsPerPlayer}`;
  const drawTimeLabel = getDrawTimeLabel(
    snapshot.drawScheduledAt,
    snapshot.serverNow,
  );

  return (
    <section
      aria-label="Jackpot Dnia"
      className="daily-jackpot-card mb-4"
    >
      <div className="daily-jackpot-card__shine" aria-hidden="true" />
      <div className="daily-jackpot-card__embers" aria-hidden="true" />

      <div className="daily-jackpot-card__copy">
        <div className="daily-jackpot-card__amount-heading">
          <span className="daily-jackpot-card__amount-label">Pula</span>
          <Dialog>
            <DialogTrigger asChild>
              <button
                type="button"
                className="daily-jackpot-card__info-trigger"
                aria-label="Skąd bierze się Jackpot?"
              >
                <Info className="h-3 w-3" aria-hidden="true" />
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-md border-red-500/40 bg-zinc-950 text-white shadow-2xl">
              <DialogHeader>
                <DialogTitle>Skąd bierze się Jackpot?</DialogTitle>
                <DialogDescription className="text-sm leading-6 text-zinc-200">
                  Pula Jackpotu bierze się z 20% stawek przegranych kuponów z
                  poprzedniego dnia oraz z kupionych ticketów w aktualnym
                  losowaniu. Im większy ruch w grze, tym większa pula do
                  zgarnięcia.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="secondary">
                    Zamknij
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <p className="daily-jackpot-card__amount">
          {formatJackpotHeroAmount(snapshot.prizeAmount)}
          <span className="sr-only">
            Jackpot Dnia.{' '}
            {formatJackpotAmount(snapshot.prizeAmount)}
          </span>
        </p>
      </div>

      <div
        className={cn(
          'daily-jackpot-card__state',
          snapshot.status === 'collecting' &&
            'daily-jackpot-card__state--countdown',
        )}
        aria-live="polite"
      >
        <Clock3 className="h-4 w-4" />
        <span className="daily-jackpot-card__state-label">
          {snapshot.status === 'collecting' ? drawTimeLabel : statusLabel}
        </span>
        {snapshot.status === 'collecting' && (
          <>
            <span className="daily-jackpot-card__state-dot" aria-hidden="true">
              •
            </span>
            <strong>{countdownLabel}</strong>
          </>
        )}
      </div>

      <img
        className="daily-jackpot-card__art"
        src="/jackpot/daily-jackpot-prizes.png"
        alt=""
        aria-hidden="true"
      />

      <div className="daily-jackpot-card__stats" aria-label="Dane jackpotu">
        <div className="daily-jackpot-card__stat">
          <Ticket className="h-6 w-6" />
          <span className="daily-jackpot-card__price-label-desktop">
            Cena ticketu
          </span>
          <span className="daily-jackpot-card__price-label-mobile">
            Cena
          </span>
          <strong>{formatJackpotHeroAmount(snapshot.ticketPrice)}</strong>
        </div>
        <div className="daily-jackpot-card__stat">
          <Users className="h-6 w-6" />
          <span>Twoje tickety</span>
          <strong>
            {currentUserTicketLabel ?? `${userTicketCount} / ${snapshot.maxTicketsPerPlayer}`}
          </strong>
          {userTicketCount > 0 && (
            <span className="sr-only">
              Masz {userTicketCount}/{snapshot.maxTicketsPerPlayer} ticketów
            </span>
          )}
        </div>
        <div className="daily-jackpot-card__stat">
          <Ticket className="h-6 w-6" />
          <span>Limit</span>
          <strong>Maks. {snapshot.maxTicketsPerPlayer}</strong>
        </div>
      </div>

      <span className="sr-only">Minimum {snapshot.minUniqueUsers} graczy</span>

      {snapshot.status === 'rolled_over' && (
        <p className="daily-jackpot-card__note">
          Za mało uczestników. Ticket zwrócony, pula przechodzi na jutro.
        </p>
      )}

      <Button
        type="button"
        variant={null}
        size={null}
        onClick={handlePrimaryAction}
        disabled={!actionEnabled}
        className={cn(
          'daily-jackpot-card__button',
          actionEnabled
            ? 'daily-jackpot-card__button--hot'
            : 'daily-jackpot-card__button--disabled',
        )}
      >
        {buying && !actionIsDraw && (
          <Loader2 className="h-4 w-4 animate-spin" />
        )}
        <span>{buttonLabel}</span>
        {ticketLimitReached && <span className="sr-only">{legacyLimitLabel}</span>}
        {actionIsDraw && <ArrowRight className="h-4 w-4" />}
      </Button>
    </section>
  );
}
