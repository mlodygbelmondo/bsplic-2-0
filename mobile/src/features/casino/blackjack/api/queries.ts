import { queryOptions } from '@tanstack/react-query';

import { PAGE_DATA_QUERY_OPTIONS } from '@/lib/query-client';
import { getBlackjackTableInfo, getCurrentBlackjackGame } from './blackjack';

/**
 * Table info plus the game in progress (web `blackjackSnapshotQuery`). The key
 * lives under `blackjack-live`, so it is never persisted to disk: a cold start
 * always loads the table fresh, and a game in progress is never shown from the
 * cache. Within a session the screen seeds an idle table from it instantly.
 */
export const blackjackSnapshotQuery = (userId: string) =>
  queryOptions({
    queryKey: ['blackjack-live', 'snapshot', userId],
    queryFn: async () => {
      const [tableInfo, currentGame] = await Promise.all([
        getBlackjackTableInfo({ userId }),
        getCurrentBlackjackGame({ userId }),
      ]);
      return { tableInfo, currentGame };
    },
    ...PAGE_DATA_QUERY_OPTIONS,
  });
