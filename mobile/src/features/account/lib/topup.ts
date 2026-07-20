export function canClaimTopup(lastTopupAt: string | null | undefined, now = new Date()): boolean {
  if (!lastTopupAt) return true;
  const date = (value: Date) => value.toLocaleDateString('sv-SE', { timeZone: 'Europe/Warsaw' });
  return date(new Date(lastTopupAt)) < date(now);
}
