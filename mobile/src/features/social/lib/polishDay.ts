/**
 * Polish-day helper for daily topup.
 * Determines if a user can claim their daily free 100 zł
 * based on the Polish calendar day (Europe/Warsaw timezone).
 */

const WARSAW_TZ = 'Europe/Warsaw';

/**
 * Returns the current date string (YYYY-MM-DD) in Europe/Warsaw timezone.
 */
export function getPolishDateString(now: Date = new Date()): string {
  return now.toLocaleDateString('sv-SE', { timeZone: WARSAW_TZ });
}

/**
 * Determines if the user can claim the daily topup.
 * Returns true when:
 *  - lastTopupAt is null/undefined (never claimed), OR
 *  - the Polish calendar day of lastTopupAt is earlier than today's Polish day
 */
export function canClaimTopup(lastTopupAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!lastTopupAt) return true;

  const todayPl = getPolishDateString(now);
  const lastPl = getPolishDateString(new Date(lastTopupAt));

  return todayPl > lastPl;
}
