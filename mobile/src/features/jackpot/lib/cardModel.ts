import type { DailyJackpotSnapshot, DailyJackpotStatus } from '../types';
import { formatTicketLabel } from './jackpotFormat';

/** Everything the card renders, derived from a snapshot (web `DailyJackpotCard` logic). */
export interface DailyJackpotCardModel {
  userTicketCount: number;
  /** `#12 #18`, or null when the user has no ticket yet. */
  currentUserTicketLabel: string | null;
  ticketLimitReached: boolean;
  hasEnoughBalance: boolean;
  /** The primary action opens the draw instead of buying. */
  actionIsDraw: boolean;
  canBuy: boolean;
  actionEnabled: boolean;
  statusLabel: string;
  buttonLabel: string;
  /** Screen-reader-only label the web adds once the limit is reached. */
  legacyLimitLabel: string;
}

export function isLiveJackpotStatus(status: DailyJackpotStatus | undefined): boolean {
  return status === 'collecting' || status === 'locked';
}

export function getDailyJackpotCardModel(
  snapshot: DailyJackpotSnapshot,
  balance: number,
  buying: boolean,
): DailyJackpotCardModel {
  const userTicketCount = Math.min(snapshot.currentUserTicketCount, snapshot.maxTicketsPerPlayer);
  const currentUserTicketNumbers =
    snapshot.currentUserTicketNumbers.length > 0
      ? snapshot.currentUserTicketNumbers
      : snapshot.currentUserTicketNumber !== null
        ? [snapshot.currentUserTicketNumber]
        : [];
  const currentUserTicketLabel =
    currentUserTicketNumbers.length > 0 ? currentUserTicketNumbers.map(formatTicketLabel).join(' ') : null;
  const ticketLimitReached = userTicketCount >= snapshot.maxTicketsPerPlayer;
  const hasEnoughBalance = balance >= snapshot.ticketPrice;
  const actionIsDraw =
    Boolean(snapshot.poolId) &&
    (snapshot.status === 'drawn' || (snapshot.status === 'rolled_over' && snapshot.currentUserHasTicket));
  const canBuy = snapshot.status === 'collecting' && !ticketLimitReached && hasEnoughBalance && !buying;

  return {
    userTicketCount,
    currentUserTicketLabel,
    ticketLimitReached,
    hasEnoughBalance,
    actionIsDraw,
    canBuy,
    actionEnabled: actionIsDraw || canBuy,
    statusLabel: getStatusLabel(snapshot, userTicketCount),
    buttonLabel: getButtonLabel(snapshot, {
      actionIsDraw,
      ticketLimitReached,
      hasEnoughBalance,
      userTicketCount,
    }),
    legacyLimitLabel: `Limit ticketów ${snapshot.maxTicketsPerPlayer}/${snapshot.maxTicketsPerPlayer}`,
  };
}

function getStatusLabel(snapshot: DailyJackpotSnapshot, userTicketCount: number): string {
  switch (snapshot.status) {
    case 'collecting':
      return userTicketCount > 0 ? 'Jesteś w grze' : 'Zbieramy tickety';
    case 'locked':
      return 'Losowanie trwa';
    case 'drawn':
      return snapshot.currentUserHasTicket ? 'Wynik gotowy do obejrzenia' : 'Losowanie zakończone';
    case 'rolled_over':
      return 'Pula przechodzi dalej';
    default:
      return 'Pula anulowana';
  }
}

function getButtonLabel(
  snapshot: DailyJackpotSnapshot,
  state: { actionIsDraw: boolean; ticketLimitReached: boolean; hasEnoughBalance: boolean; userTicketCount: number },
): string {
  if (state.actionIsDraw) {
    if (snapshot.status === 'rolled_over') return 'Zobacz rozliczenie';
    return snapshot.currentUserHasTicket ? 'Przejdź do losowania' : 'Obejrzyj losowanie';
  }
  if (snapshot.status === 'locked') return 'Losowanie trwa';
  if (snapshot.status === 'drawn') return 'Finał zakończony';
  if (snapshot.status === 'rolled_over') return 'Pula przechodzi dalej';
  if (snapshot.status === 'cancelled') return 'Pula anulowana';
  if (state.ticketLimitReached) return 'Limit ticketów wykorzystany';
  if (!state.hasEnoughBalance) return 'Brak środków na ticket';
  return state.userTicketCount === 1 ? 'Kup drugi ticket' : 'Kup ticket';
}

/** Label of the ticket a purchase added (`#22`), for the success toast (web `useDailyJackpot`). */
export function getPurchasedTicketLabel(
  previousSnapshot: DailyJackpotSnapshot,
  nextSnapshot: DailyJackpotSnapshot,
): string | null {
  const previousTicketNumbers = new Set(previousSnapshot.currentUserTicketNumbers);
  const newTicketNumber =
    nextSnapshot.currentUserTicketNumbers.find((ticketNumber) => !previousTicketNumbers.has(ticketNumber)) ??
    nextSnapshot.currentUserTicketNumber;
  return newTicketNumber === null ? null : formatTicketLabel(newTicketNumber);
}

/** Milliseconds left until the draw, from the server clock plus time elapsed locally since it was read. */
export function getCountdownMs(
  snapshot: Pick<DailyJackpotSnapshot, 'drawScheduledAt' | 'serverNow'>,
  receivedAt: number,
  now: number,
): number | null {
  if (!snapshot.drawScheduledAt || !snapshot.serverNow) return null;
  const drawTime = new Date(snapshot.drawScheduledAt).getTime();
  const serverNow = new Date(snapshot.serverNow).getTime();
  if (!Number.isFinite(drawTime) || !Number.isFinite(serverNow)) return null;
  // The web counts whole seconds since the snapshot arrived.
  const elapsedSeconds = Math.max(0, Math.floor((now - receivedAt) / 1000));
  return drawTime - serverNow - elapsedSeconds * 1000;
}
