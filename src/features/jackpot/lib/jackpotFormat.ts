const WARSAW_TIME_ZONE = 'Europe/Warsaw';

function getWarsawDateKey(date: Date): string {
  return date.toLocaleDateString('sv-SE', { timeZone: WARSAW_TIME_ZONE });
}

export function formatJackpotAmount(amount: number): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const formatted = safeAmount
    .toLocaleString('pl-PL', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: false,
    })
    .replace(/\s/g, ' ');

  return `${formatted} zł`;
}

export function getDrawTimeLabel(
  drawScheduledAt: string,
  serverNow: string,
): string {
  const drawDate = new Date(drawScheduledAt);
  const nowDate = new Date(serverNow);

  if (getWarsawDateKey(drawDate) === getWarsawDateKey(nowDate)) {
    return 'Losowanie dziś o 20:00';
  }

  const dateLabel = new Intl.DateTimeFormat('pl-PL', {
    timeZone: WARSAW_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
  }).format(drawDate);

  return `Losowanie ${dateLabel} o 20:00`;
}

export function getParticipantProgressLabel(
  participantCount: number,
  minUniqueUsers: number,
): string {
  return `${participantCount}/${minUniqueUsers} graczy`;
}
