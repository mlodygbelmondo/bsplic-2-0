import { useQuery } from '@tanstack/react-query';

interface ErApiResponse {
  base_code?: string;
  rates?: Record<string, number>;
}

async function fetchFxRatesToPln(): Promise<Record<string, number>> {
  const response = await fetch('https://open.er-api.com/v6/latest/PLN');
  if (!response.ok) {
    throw new Error(`FX API error: ${response.status}`);
  }

  const payload = (await response.json()) as ErApiResponse;
  const rates = payload.rates ?? {};

  const normalized: Record<string, number> = { PLN: 1 };
  Object.entries(rates).forEach(([currency, plnToCurrencyRate]) => {
    if (!Number.isFinite(plnToCurrencyRate) || plnToCurrencyRate <= 0) return;
    normalized[currency.toUpperCase()] = 1 / plnToCurrencyRate;
  });

  return normalized;
}

export function useFxRatesToPln() {
  return useQuery({
    queryKey: ['fx-rates-to-pln'],
    queryFn: fetchFxRatesToPln,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}
