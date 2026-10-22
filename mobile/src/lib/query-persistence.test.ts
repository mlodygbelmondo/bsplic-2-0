import { dehydrate, hydrate, QueryClient } from '@tanstack/react-query';
import type { PersistedClient } from '@tanstack/react-query-persist-client';
import { describe, expect, it } from 'vitest';

import { serializeQueryCache, shouldPersistQuery } from './query-persistence';

const BETS = [{ id: 'bet-1', title: 'Legia - Lech' }];

function persist(client: QueryClient): PersistedClient {
  return {
    timestamp: Date.now(),
    buster: 'test',
    clientState: dehydrate(client, { shouldDehydrateQuery: shouldPersistQuery }),
  };
}

function restore(serialized: string): QueryClient {
  const client = new QueryClient();
  hydrate(client, (JSON.parse(serialized) as PersistedClient).clientState);
  return client;
}

describe('query cache persistence', () => {
  it('keeps the last good data when the latest background refresh failed', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(['bets', 'all'], BETS);
    await client
      .fetchQuery({ queryKey: ['bets', 'all'], queryFn: () => Promise.reject(new Error('fetch failed')), staleTime: 0 })
      .catch(() => undefined);
    expect(client.getQueryState(['bets', 'all'])?.status).toBe('error');

    const restored = restore(serializeQueryCache(persist(client)));

    expect(restored.getQueryData(['bets', 'all'])).toEqual(BETS);
    expect(restored.getQueryState(['bets', 'all'])?.status).toBe('success');
    expect(restored.getQueryState(['bets', 'all'])?.error).toBeNull();
  });

  it('skips queries without data and never-persisted live roots', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await client
      .fetchQuery({ queryKey: ['profile', 'u1'], queryFn: () => Promise.reject(new Error('fetch failed')) })
      .catch(() => undefined);
    client.setQueryData(['roulette-live', 'table'], { roundId: 'r1' });
    client.setQueryData(['admin', 'bets'], [{ id: 'b1' }]);

    const restored = restore(serializeQueryCache(persist(client)));

    expect(restored.getQueryState(['profile', 'u1'])).toBeUndefined();
    expect(restored.getQueryState(['roulette-live', 'table'])).toBeUndefined();
    expect(restored.getQueryState(['admin', 'bets'])).toBeUndefined();
  });
});
