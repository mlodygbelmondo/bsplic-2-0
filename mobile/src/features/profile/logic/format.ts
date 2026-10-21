const pad2 = (value: number) => value.toString().padStart(2, '0');

/** `new Date(value).toLocaleDateString('pl-PL')`: day without padding, e.g. `5.01.2026`. */
export function formatJoinDate(value: string): string {
  const date = new Date(value);
  return `${date.getDate()}.${pad2(date.getMonth() + 1)}.${date.getFullYear()}`;
}

/** `Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })`, e.g. `01.05.2026`. */
export function formatBadgeDate(value: string): string {
  const date = new Date(value);
  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${date.getFullYear()}`;
}
