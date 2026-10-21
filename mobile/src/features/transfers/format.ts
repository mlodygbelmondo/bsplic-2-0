export const MONEY_TRANSFER_MESSAGE_LIMIT = 2000;

// Used only until (or unless) the server rules snapshot loads; SQL is the
// authority either way — see public.get_money_transfer_rules().
export const FALLBACK_MONEY_TRANSFER_RULES = {
  min_amount: 1,
  max_message_length: MONEY_TRANSFER_MESSAGE_LIMIT,
  max_transfers_per_hour: 5,
  min_account_age_days: 14,
} as const;

const NBSP = ' ';
const MONTHS_SHORT = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];

/**
 * Same output as the web's `Intl.NumberFormat('pl-PL', { 2 fraction digits })`
 * (CLDR pl: comma decimals, no-break-space grouping from five integer digits,
 * half-up rounding of the shortest decimal), without depending on Hermes Intl.
 */
export function formatMoney(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  const cents = Math.round(Number((Math.abs(value) * 100).toPrecision(15)));
  const integer = Math.floor(cents / 100).toString();
  const fraction = (cents % 100).toString().padStart(2, '0');
  const grouped = integer.length >= 5 ? integer.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP) : integer;
  const sign = value < 0 && cents > 0 ? '-' : '';
  return `${sign}${grouped},${fraction}`;
}

/**
 * Same output as the web's `Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium',
 * timeStyle: 'short' })` in the device time zone, e.g. `15 sty 2026, 19:07`.
 */
export function formatTransferDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}, ${hours}:${minutes}`;
}

export function parseMoney(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;

  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

/** "Wyślij całe saldo": the balance as a comma-decimal field value (`1234,50`). */
export function toAmountInput(balance: number): string {
  return balance.toFixed(2).replace('.', ',');
}
