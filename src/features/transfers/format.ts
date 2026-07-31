export const MONEY_TRANSFER_MESSAGE_LIMIT = 2000;

// Used only until (or unless) the server rules snapshot loads; SQL is the
// authority either way — see public.get_money_transfer_rules().
export const FALLBACK_MONEY_TRANSFER_RULES = {
  min_amount: 1,
  max_message_length: MONEY_TRANSFER_MESSAGE_LIMIT,
  max_transfers_per_hour: 5,
  min_account_age_days: 14,
} as const;

export function formatMoney(value: number): string {
  return new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatTransferDate(value: string): string {
  return new Intl.DateTimeFormat('pl-PL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function parseMoney(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;

  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}
