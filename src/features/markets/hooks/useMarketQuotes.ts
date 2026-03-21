import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { fetchMarketQuotes } from '@/features/markets/provider';
import { MarketAsset } from '@/types/markets';

interface UseMarketQuotesOptions {
  refetchIntervalMs?: number;
  staleTimeMs?: number;
  refetchOnWindowFocus?: boolean;
}

export function useMarketQuotes(assets: MarketAsset[], options: UseMarketQuotesOptions = {}) {
  const activeAssets = useMemo(() => {
    return assets.filter((asset) => asset.is_active);
  }, [assets]);

  const refetchIntervalMs = options.refetchIntervalMs ?? 60_000;
  const staleTimeMs = options.staleTimeMs ?? 60_000;
  const shouldRefetchOnWindowFocus = options.refetchOnWindowFocus ?? true;

  return useQuery({
    queryKey: ['market-quotes', activeAssets.map((asset) => asset.symbol).join(',')],
    queryFn: () => fetchMarketQuotes(activeAssets),
    enabled: activeAssets.length > 0,
    staleTime: staleTimeMs,
    refetchInterval: refetchIntervalMs,
    refetchOnWindowFocus: shouldRefetchOnWindowFocus,
  });
}
