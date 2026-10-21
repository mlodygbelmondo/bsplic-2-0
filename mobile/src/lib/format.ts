/** Formatting shared by many surfaces. Feature-specific formats live in their feature. */

/** Web navbar balance format: `Number(balance).toFixed(2)` + ` zł`. */
export function formatMoney(value: number | null | undefined): string {
  return `${Number(value ?? 0).toFixed(2)} zł`;
}

/** Odds with two decimals (web `odds.toFixed(2)`). */
export function formatOdds(value: number | null | undefined): string {
  return Number(value ?? 0).toFixed(2);
}

/**
 * Polish plural form picker: `pluralPl(n, ['zakład', 'zakłady', 'zakładów'])`.
 */
export function pluralPl(count: number, forms: readonly [one: string, few: string, many: string]): string {
  const abs = Math.abs(count);
  if (abs === 1) return forms[0];
  const lastTwo = abs % 100;
  const last = abs % 10;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return forms[1];
  return forms[2];
}
