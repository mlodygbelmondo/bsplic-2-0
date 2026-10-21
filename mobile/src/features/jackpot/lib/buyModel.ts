/** `1 ticket` / `2 tickety` (web `formatTicketCount`, the limit is two per player). */
export function formatTicketCount(count: number): string {
  return count === 1 ? '1 ticket' : `${count} tickety`;
}

export interface JackpotBuyModelInput {
  ticketPrice: number;
  balance: number;
  currentTicketCount: number;
  maxTicketsPerPlayer: number;
  requestedCount: number;
  buying: boolean;
}

export interface JackpotBuyModel {
  /** One option per remaining ticket slot. */
  quantityOptions: number[];
  /** Options above this count cost more than the balance. */
  affordableCount: number;
  count: number;
  total: number;
  canConfirm: boolean;
  confirmLabel: string;
}

/** Web `JackpotBuyModal`: what the purchase confirmation offers and allows. */
export function getJackpotBuyModel({
  ticketPrice,
  balance,
  currentTicketCount,
  maxTicketsPerPlayer,
  requestedCount,
  buying,
}: JackpotBuyModelInput): JackpotBuyModel {
  const remainingSlots = Math.max(0, maxTicketsPerPlayer - currentTicketCount);
  const affordableCount = ticketPrice > 0 ? Math.floor(balance / ticketPrice) : remainingSlots;
  const maxCount = Math.min(remainingSlots, affordableCount);
  // A finished purchase can lower the remaining slots while the dialog is open.
  const count = Math.min(requestedCount, Math.max(remainingSlots, 1));
  const confirmLabel =
    remainingSlots === 0
      ? 'Limit ticketów wykorzystany'
      : maxCount === 0
        ? 'Brak środków na ticket'
        : `Kupuję ${formatTicketCount(count)}`;

  return {
    quantityOptions: Array.from({ length: remainingSlots }, (_, index) => index + 1),
    affordableCount,
    count,
    total: count * ticketPrice,
    canConfirm: count <= maxCount && !buying,
    confirmLabel,
  };
}

/** Web `getPurchaseToastMessage`: names the bought tickets when every label is known. */
export function getPurchaseToastMessage(ticketLabels: string[], purchasedCount: number): string {
  if (purchasedCount === 1) {
    return ticketLabels.length > 0 ? `Ticket ${ticketLabels[0]} kupiony!` : 'Ticket kupiony!';
  }
  return ticketLabels.length === purchasedCount ? `Tickety ${ticketLabels.join(' ')} kupione!` : 'Tickety kupione!';
}
