import { queryOptions } from '@tanstack/react-query';
import {
  getBlackjackTableInfo,
  getCurrentBlackjackGame,
} from '@/features/casino/api/blackjack';
import { getRouletteTableSnapshot } from '@/features/casino/api/roulette';
import { PAGE_DATA_QUERY_OPTIONS } from '@/lib/query-client';

// 50 spins of history feed the hot/cold + color distribution stats.
export const ROULETTE_RECENT_SPINS_LIMIT = 50;

export const rouletteSnapshotQuery = () =>
  queryOptions({
    queryKey: ['casino', 'roulette', 'snapshot'],
    queryFn: () =>
      getRouletteTableSnapshot('main', ROULETTE_RECENT_SPINS_LIMIT),
    ...PAGE_DATA_QUERY_OPTIONS,
  });

export const blackjackSnapshotQuery = (userId: string) =>
  queryOptions({
    queryKey: ['casino', 'blackjack', userId],
    queryFn: async () => {
      const [tableInfo, currentGame] = await Promise.all([
        getBlackjackTableInfo({ userId }),
        getCurrentBlackjackGame({ userId }),
      ]);
      return { tableInfo, currentGame };
    },
    ...PAGE_DATA_QUERY_OPTIONS,
  });
