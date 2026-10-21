/**
 * Jackpot formatting, ported from the web (`jackpotFormat.ts` plus the
 * helpers duplicated in `DailyJackpotCard.tsx` and `JackpotDrawPage.tsx`).
 *
 * The web formats with `Intl` (`pl-PL`, `Europe/Warsaw`). These versions
 * produce the same strings without depending on the Hermes Intl build: Polish
 * number grouping (narrow no-break space, only from five integer digits) and
 * the EU daylight-saving rule that Europe/Warsaw follows.
 */

const NBSP = ' ';
const HOUR_MS = 3_600_000;

const POLISH_MONTHS_GENITIVE = [
  'stycznia',
  'lutego',
  'marca',
  'kwietnia',
  'maja',
  'czerwca',
  'lipca',
  'sierpnia',
  'września',
  'października',
  'listopada',
  'grudnia',
] as const;

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** UTC timestamp of the last Sunday of `month` (0-based) at 01:00 UTC. */
function lastSundayAtOneUtc(year: number, month: number): number {
  const lastDay = new Date(Date.UTC(year, month + 1, 0, 1));
  return lastDay.getTime() - lastDay.getUTCDay() * 24 * HOUR_MS;
}

/** Europe/Warsaw offset from UTC in ms (CET +1 h, CEST +2 h, EU rule). */
export function getWarsawOffsetMs(date: Date): number {
  const time = date.getTime();
  const year = date.getUTCFullYear();
  const summerStart = lastSundayAtOneUtc(year, 2);
  const summerEnd = lastSundayAtOneUtc(year, 9);
  return time >= summerStart && time < summerEnd ? 2 * HOUR_MS : HOUR_MS;
}

/** `YYYY-MM-DD` of the calendar day in Europe/Warsaw (web: `sv-SE` date string). */
export function getWarsawDateKey(date: Date): string {
  const local = new Date(date.getTime() + getWarsawOffsetMs(date));
  return `${local.getUTCFullYear()}-${pad2(local.getUTCMonth() + 1)}-${pad2(local.getUTCDate())}`;
}

function groupPolish(integerDigits: string): string {
  // pl-PL groups thousands only when the integer part has at least 5 digits.
  if (integerDigits.length < 5) return integerDigits;
  return integerDigits.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

function formatPolishNumber(value: number, fractionDigits: number, grouping: boolean): string {
  const fixed = Math.abs(value).toFixed(fractionDigits);
  const [integerPart, fractionPart] = fixed.split('.');
  const sign = value < 0 && Number(fixed) !== 0 ? '-' : '';
  const integer = grouping ? groupPolish(integerPart) : integerPart;
  return `${sign}${integer}${fractionPart ? `,${fractionPart}` : ''}`;
}

/** Toast/accessibility amount: always 2 decimals, no grouping (`1234,50 zł`). */
export function formatJackpotAmount(amount: number): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return `${formatPolishNumber(safeAmount, 2, false)} zł`;
}

/** Hero amount: grouped, decimals only when the value has cents (`15 000 zł`, `2480,75 zł`). */
export function formatJackpotHeroAmount(amount: number): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const hasCents = Math.round(safeAmount) !== safeAmount;
  return `${formatPolishNumber(safeAmount, hasCents ? 2 : 0, true)} zł`;
}

export function getDrawTimeLabel(drawScheduledAt: string, serverNow: string): string {
  const drawDate = new Date(drawScheduledAt);
  const nowDate = new Date(serverNow);

  if (getWarsawDateKey(drawDate) === getWarsawDateKey(nowDate)) {
    return 'Losowanie dziś o 20:00';
  }

  const [, month, day] = getWarsawDateKey(drawDate).split('-');
  return `Losowanie ${day}.${month} o 20:00`;
}

export function getParticipantProgressLabel(participantCount: number, minUniqueUsers: number): string {
  return `${participantCount}/${minUniqueUsers} graczy`;
}

/** `HH:MM:SS` countdown, clamped at zero. */
export function formatCountdown(totalMilliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(totalMilliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map(pad2).join(':');
}

/** Zero-padded ticket number (`5` → `05`). */
export function formatTicketNumber(ticket: number): string {
  return String(ticket).padStart(2, '0');
}

/** `#05` label used on the card, the draw summary and the flying tickets. */
export function formatTicketLabel(ticket: number): string {
  return `#${formatTicketNumber(ticket)}`;
}

/** `3 gracze`, `5 losów`: count plus the matching Polish plural form. */
export function formatPolishCount(count: number, singular: string, few: string, many: string): string {
  const absoluteCount = Math.abs(count);
  const lastDigit = absoluteCount % 10;
  const lastTwoDigits = absoluteCount % 100;

  if (absoluteCount === 1) {
    return `${count} ${singular}`;
  }
  if (lastDigit >= 2 && lastDigit <= 4 && !(lastTwoDigits >= 12 && lastTwoDigits <= 14)) {
    return `${count} ${few}`;
  }
  return `${count} ${many}`;
}

function parsePoolDate(poolDate: string): { year: number; month: number; day: number } {
  // The web anchors the pool date at 12:00 UTC, which is the same calendar day in Warsaw.
  const date = new Date(`${poolDate}T12:00:00.000Z`);
  const local = new Date(date.getTime() + getWarsawOffsetMs(date));
  return { year: local.getUTCFullYear(), month: local.getUTCMonth(), day: local.getUTCDate() };
}

/** `17 czerwca` (web: Intl pl-PL, day 2-digit, month long). */
export function formatDrawDate(poolDate: string): string {
  const { month, day } = parsePoolDate(poolDate);
  return `${pad2(day)} ${POLISH_MONTHS_GENITIVE[month]}`;
}

/** `17.06.2026` (web: Intl pl-PL, day/month 2-digit, year numeric). */
export function formatDrawDateNumeric(poolDate: string): string {
  const { year, month, day } = parsePoolDate(poolDate);
  return `${pad2(day)}.${pad2(month + 1)}.${year}`;
}

/** Avatar fallback: first two characters, uppercased (`??` when empty). */
export function getInitials(username: string): string {
  return username.trim().slice(0, 2).toUpperCase() || '??';
}
