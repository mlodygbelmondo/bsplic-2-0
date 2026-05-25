export const formatOdds = (value: number) =>
  value.toFixed(2).replace('.', ',');

export const formatBalance = (value: number) =>
  new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
