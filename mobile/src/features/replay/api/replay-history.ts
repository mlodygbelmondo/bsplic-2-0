import { queryOptions } from '@tanstack/react-query';

import { PAGE_DATA_QUERY_OPTIONS } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';
import { parseReplayHistory, REPLAY_LIMIT } from '../model';

/**
 * One bounded snapshot of the user's coupons (web `useReplayHistory`). The
 * extra row is a sentinel that only detects truncation. Persisted like other
 * page data, so the last snapshot shows instantly and offline.
 */
export const replayHistoryQuery = (userId: string | null) =>
  queryOptions({
    queryKey: ['replay-history', userId],
    enabled: Boolean(userId),
    queryFn: async ({ signal }) => {
      if (!userId) throw new Error('Zaloguj się, aby zobaczyć Replay.');
      const { data, error } = await supabase
        .rpc('get_user_coupon_history', { p_user_id: userId, p_limit: REPLAY_LIMIT + 1, p_offset: 0 })
        .abortSignal(signal);
      if (error) throw error;
      return parseReplayHistory(data);
    },
    ...PAGE_DATA_QUERY_OPTIONS,
  });
