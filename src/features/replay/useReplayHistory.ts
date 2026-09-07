import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';

import { parseReplayHistory, REPLAY_LIMIT } from './model';

export function useReplayHistory(userId: string | null) {
  return useQuery({
    queryKey: ['replay-history', userId],
    enabled: Boolean(userId),
    staleTime: 60_000,
    gcTime: 0,
    retry: 1,
    refetchOnWindowFocus: false,
    queryFn: async ({ signal }) => {
      if (!userId) throw new Error('Zaloguj się, aby zobaczyć Replay.');
      // One snapshot avoids inconsistent offset pages while new coupons arrive.
      // The extra row is a sentinel, not an unlabelled all-time statistics claim.
      const { data, error } = await supabase.rpc('get_user_coupon_history', {
        p_user_id: userId,
        p_limit: REPLAY_LIMIT + 1,
        p_offset: 0,
      }).abortSignal(signal);
      if (error) throw error;
      return parseReplayHistory(data);
    },
  });
}
