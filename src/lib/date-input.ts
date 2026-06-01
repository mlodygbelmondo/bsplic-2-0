export const toInputDateTime = (value: Date | string): string => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const offsetDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000,
  );
  return offsetDate.toISOString().slice(0, 16);
};

export const getTodayAt2359 = (now: Date = new Date()): Date => {
  const date = new Date(now);
  date.setHours(23, 59, 0, 0);
  return date;
};

export const getTomorrowAt2359 = (now: Date = new Date()): Date => {
  const date = new Date(now);
  date.setDate(date.getDate() + 1);
  return getTodayAt2359(date);
};
