import { useEffect, useState } from 'react';
import { Coins, Loader2, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

import { jackpotAudio } from '../lib/jackpotAudio';
import { formatJackpotAmount } from '../lib/jackpotFormat';

interface JackpotBuyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketPrice: number;
  prizeAmount: number;
  balance: number;
  currentTicketCount: number;
  maxTicketsPerPlayer: number;
  minUniqueUsers: number;
  drawTimeLabel: string;
  buying: boolean;
  onConfirm: (count: number) => Promise<boolean>;
}

function formatTicketCount(count: number) {
  return count === 1 ? '1 ticket' : `${count} tickety`;
}

export function JackpotBuyModal({
  open,
  onOpenChange,
  ticketPrice,
  prizeAmount,
  balance,
  currentTicketCount,
  maxTicketsPerPlayer,
  minUniqueUsers,
  drawTimeLabel,
  buying,
  onConfirm,
}: JackpotBuyModalProps) {
  const remainingSlots = Math.max(0, maxTicketsPerPlayer - currentTicketCount);
  const affordableCount =
    ticketPrice > 0 ? Math.floor(balance / ticketPrice) : remainingSlots;
  const maxCount = Math.min(remainingSlots, affordableCount);
  const quantityOptions = Array.from(
    { length: remainingSlots },
    (_, index) => index + 1,
  );
  const [requestedCount, setRequestedCount] = useState(1);
  // A finished purchase can lower the remaining slots while the modal is open.
  const count = Math.min(requestedCount, Math.max(remainingSlots, 1));
  const total = count * ticketPrice;
  const canConfirm = count <= maxCount && !buying;
  const confirmLabel =
    remainingSlots === 0
      ? 'Limit ticketów wykorzystany'
      : maxCount === 0
        ? 'Brak środków na ticket'
        : `Kupuję ${formatTicketCount(count)}`;

  useEffect(() => {
    if (open) {
      setRequestedCount(1);
    }
  }, [open]);

  const confirmPurchase = async () => {
    if (!canConfirm) {
      return;
    }

    jackpotAudio.unlock();
    const purchased = await onConfirm(count);
    if (purchased) {
      jackpotAudio.playCoinSound();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={buying ? undefined : onOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-md gap-0 overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-b from-zinc-950 via-zinc-900 to-black p-0 text-white shadow-2xl shadow-amber-950/40">
        <DialogHeader className="space-y-2 border-b border-white/10 bg-zinc-900/60 p-5 pr-12 text-left">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-amber-300">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Jackpot Dnia
            </span>
            <span className="text-xs font-semibold text-zinc-400">
              Saldo:{' '}
              <strong className="text-white">
                {formatJackpotAmount(balance)}
              </strong>
            </span>
          </div>
          <DialogTitle className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xl font-black tracking-tight text-white">
            <span>Kup ticket</span>
            <span className="text-lg font-extrabold text-amber-400">
              Pula {formatJackpotAmount(prizeAmount)}
            </span>
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-400">
            Cena ticketu{' '}
            <strong className="text-amber-300">
              {formatJackpotAmount(ticketPrice)}
            </strong>{' '}
            • Twoje tickety {currentTicketCount}/{maxTicketsPerPlayer}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 p-5">
          <div
            role="group"
            aria-label="Liczba ticketów"
            className={cn(
              'grid gap-3',
              quantityOptions.length > 1 ? 'grid-cols-2' : 'grid-cols-1',
            )}
          >
            {quantityOptions.map((option) => {
              const unaffordable = option > affordableCount;

              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={count === option}
                  disabled={unaffordable || buying}
                  onClick={() => {
                    jackpotAudio.playTick(700 + option * 100, 0.03, 0.1);
                    setRequestedCount(option);
                  }}
                  className={cn(
                    'rounded-xl border p-4 text-center transition',
                    count === option
                      ? 'border-amber-400 bg-amber-500/10'
                      : 'border-white/10 bg-zinc-900/50 hover:border-white/20',
                    unaffordable && 'cursor-not-allowed opacity-40',
                  )}
                >
                  <Coins
                    className="mx-auto mb-1 h-6 w-6 text-amber-400"
                    aria-hidden="true"
                  />
                  <span className="block text-sm font-black text-white">
                    {formatTicketCount(option)}
                  </span>
                  <span className="block text-xs font-bold text-amber-300">
                    {formatJackpotAmount(option * ticketPrice)}
                  </span>
                </button>
              );
            })}
          </div>

          <ul className="space-y-1.5 rounded-lg border border-white/10 bg-black/40 p-3 text-xs leading-5 text-zinc-400">
            <li>
              {drawTimeLabel}. Zwycięski ticket losujemy spośród wszystkich
              kupionych.
            </li>
            <li>Numery ticketów nadajemy po kolei w chwili zakupu.</li>
            <li>
              Jeśli zagra mniej niż {minUniqueUsers} graczy, ticket wraca na
              saldo, a pula przechodzi na kolejny dzień.
            </li>
          </ul>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-zinc-950 p-4">
          <div className="text-left">
            <span className="block text-[11px] text-zinc-400">Do zapłaty</span>
            <strong className="text-lg font-black text-white">
              {formatJackpotAmount(total)}
            </strong>
          </div>

          <Button
            type="button"
            disabled={!canConfirm}
            onClick={() => void confirmPurchase()}
            className="h-11 flex-1 bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 text-sm font-black text-black shadow-lg shadow-amber-500/20 hover:from-amber-300 hover:to-yellow-400"
          >
            {buying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Kupowanie…
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
