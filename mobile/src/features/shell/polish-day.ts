/**
 * Polish-day helper for the daily top-up (port of the web's
 * `src/features/social/polishDay.ts`). A user can claim the free 100 zł once
 * per calendar day in Europe/Warsaw, the same rule `secure_daily_topup`
 * enforces on the server.
 */

const WARSAW_TZ = 'Europe/Warsaw';

// formatToParts keeps the output independent of the device locale's date
// format (the web relies on the `sv-SE` locale printing YYYY-MM-DD).
const warsawDateFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: WARSAW_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Returns the date (YYYY-MM-DD) in the Europe/Warsaw timezone. */
export function getPolishDateString(now: Date = new Date()): string {
  const parts = warsawDateFormat.formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/**
 * True when the user has never claimed the top-up, or claimed it on an
 * earlier Polish calendar day than today.
 */
export function canClaimTopup(lastTopupAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!lastTopupAt) return true;

  const todayPl = getPolishDateString(now);
  const lastPl = getPolishDateString(new Date(lastTopupAt));

  return todayPl > lastPl;
}
