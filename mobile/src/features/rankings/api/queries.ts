import { queryOptions } from '@tanstack/react-query';

import { PAGE_DATA_QUERY_OPTIONS } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';
import { normalizeRankingRows, type RankingType } from '../ranking-logic';

export const rankingsQuery = (rankingType: RankingType) =>
  queryOptions({
    queryKey: ['rankings', rankingType],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        rankingType === 'sportsbook' ? 'get_user_rankings' : 'get_casino_rankings',
      );
      if (error) throw error;
      return normalizeRankingRows(data);
    },
    ...PAGE_DATA_QUERY_OPTIONS,
  });
