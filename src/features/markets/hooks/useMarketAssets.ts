import { useQuery } from '@tanstack/react-query';

import { fetchMarketAssets } from '@/features/markets/api';

export function useMarketAssets() {
  return useQuery({
    queryKey: ['market-assets'],
    queryFn: fetchMarketAssets,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
