import { useQuery } from '@tanstack/react-query';

import { fetchUserMarketTransactions } from '@/features/markets/api';

export function useMarketTransactions(userId: string | undefined) {
  return useQuery({
    queryKey: ['market-transactions', userId],
    queryFn: () => fetchUserMarketTransactions(userId as string),
    enabled: Boolean(userId),
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });
}
