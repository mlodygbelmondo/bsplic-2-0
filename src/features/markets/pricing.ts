export interface ConvertPriceToPlnInput {
  price: number;
  quoteCurrency: string;
  fxRatesToPln: Record<string, number>;
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function roundAssetAmount(value: number): number {
  return Math.round(value * 100000000) / 100000000;
}

export function convertPriceToPln({
  price,
  quoteCurrency,
  fxRatesToPln,
}: ConvertPriceToPlnInput): number | null {
  if (!Number.isFinite(price) || price <= 0) return null;

  const normalizedQuote = quoteCurrency.toUpperCase();
  if (normalizedQuote === 'PLN') return roundMoney(price);

  const fx = fxRatesToPln[normalizedQuote];
  if (!Number.isFinite(fx) || fx <= 0) return null;

  return roundMoney(price * fx);
}
