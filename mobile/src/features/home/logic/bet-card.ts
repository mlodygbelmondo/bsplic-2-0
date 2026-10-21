import type { Bet, BetOption } from '@/types/database';

/** Pure rules behind the web `BetCard` (`src/components/BetCard.tsx`). */

export const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

export function formatTimeRemaining(remainingMs: number): string {
  const totalMinutes = Math.floor(remainingMs / 60_000);
  if (totalMinutes < 1) return 'za chwilę';
  if (totalMinutes < 60) return `za ${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `za ${hours} godz. ${minutes} min` : `za ${hours} godz.`;
}

const pad2 = (value: number) => String(value).padStart(2, '0');

/**
 * Web: `Intl.DateTimeFormat('pl-PL', { day, month, hour, minute: '2-digit' })`
 * without the comma, i.e. `05.01 09:07` in local time. Formatted by hand so the
 * output does not depend on the Hermes Intl implementation.
 */
export function formatBetDate(endsAt: string): string {
  const date = new Date(endsAt);
  if (Number.isNaN(date.getTime())) {
    return '--.-- --:--';
  }
  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export interface BetClockState {
  isExpired: boolean;
  remainingMs: number;
  /** Countdown is shown: active bet ending within 24 h. */
  endsSoon: boolean;
  /** `W trakcie`: expired and not settled yet. */
  isInProgress: boolean;
  /** Options cannot be picked. */
  isLocked: boolean;
}

export function getBetClockState(
  bet: Pick<Bet, 'ends_at' | 'is_active' | 'winning_option'>,
  now: number,
): BetClockState {
  const endTimestamp = new Date(bet.ends_at).getTime();
  const valid = Number.isFinite(endTimestamp);
  const isExpired = valid && endTimestamp <= now;
  const remainingMs = endTimestamp - now;
  const endsSoon = valid && bet.is_active && remainingMs > 0 && remainingMs <= DAY_MS;
  return {
    isExpired,
    remainingMs,
    endsSoon,
    isInProgress: isExpired && bet.winning_option === null,
    isLocked: isExpired || !bet.is_active,
  };
}

/** One grid row of odds chips; `null` cells keep the column width of a CSS grid. */
export interface OddsRow {
  cells: (BetOption | null)[];
  /** `col-span-2 justify-self-center w-[48%]` for the odd last multi option. */
  centered: boolean;
}

/** Column count of the odds grid at phone width (web `grid-cols-*` rules). */
export function getOddsColumns(betType: Bet['bet_type'], count: number): number {
  if (betType === 'multi' && (count === 4 || count === 5)) return 2;
  if (betType === 'multi' && count >= 6) return 3;
  if (count === 1) return 1;
  if (count === 3) return 3;
  return 2;
}

export function buildOddsRows(betType: Bet['bet_type'], options: BetOption[]): OddsRow[] {
  const columns = getOddsColumns(betType, options.length);
  const centerLast = betType === 'multi' && (options.length === 4 || options.length === 5) && options.length % 2 === 1;
  const rows: OddsRow[] = [];
  for (let start = 0; start < options.length; start += columns) {
    const slice = options.slice(start, start + columns);
    if (centerLast && slice.length === 1 && start + 1 === options.length) {
      rows.push({ cells: slice, centered: true });
      continue;
    }
    const cells: (BetOption | null)[] = [...slice];
    while (cells.length < columns) cells.push(null);
    rows.push({ cells, centered: false });
  }
  return rows;
}

/** Implied probability of each option: (1 / odds) normalized over the card. */
export function getOptionProbabilities(options: BetOption[]): number[] {
  const isUsable = (odds: number) => Number.isFinite(odds) && odds > 0;
  const denominator = options.reduce((sum, option) => (isUsable(option.odds) ? sum + 1 / option.odds : sum), 0);
  return options.map((option) =>
    denominator > 0 && isUsable(option.odds) ? 1 / option.odds / denominator : 0,
  );
}

export type OddsChipState = 'selected' | 'locked' | 'default';

/** Visual state; selected wins over locked like the web class order. */
export function getOddsChipState(isSelected: boolean, isLocked: boolean): OddsChipState {
  if (isSelected) return 'selected';
  if (isLocked) return 'locked';
  return 'default';
}

/** Web `aria-label`; locked wins over selected. */
export function getOddsAccessibilityLabel(title: string, option: BetOption, isSelected: boolean, isLocked: boolean) {
  const odds = option.odds.toFixed(2);
  if (isLocked) return `${title}: ${option.name} zablokowane, kurs ${odds}`;
  if (isSelected) return `${title}: ${option.name} wybrane, kurs ${odds}`;
  return `${title}: wybierz ${option.name}, kurs ${odds}`;
}

export type OddsPressAction = 'ignore' | 'remove' | 'add';

/** Tapping the picked option removes the bet from the coupon, any other option replaces it. */
export function getOddsPressAction(optionName: string, selectedOption: string | null, isLocked: boolean): OddsPressAction {
  if (isLocked) return 'ignore';
  return selectedOption === optionName ? 'remove' : 'add';
}
