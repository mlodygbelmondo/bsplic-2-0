import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const client = vi.hoisted(() => ({ current: null as QueryClient | null }));
const fetched = vi.hoisted(() => [] as string[]);
/** Section requests stay open until released, like a slow backend. */
const pending = vi.hoisted(() => [] as (() => void)[]);

vi.mock('@/lib/query-client', () => ({
  get queryClient() {
    return client.current;
  },
}));
vi.mock('@/lib/connectivity', () => ({ isOffline: () => false }));
vi.mock('@/features/social/api/cache', () => ({ trimFeedCache: vi.fn() }));

function section(name: string) {
  return () => ({
    queryKey: [name],
    queryFn: () =>
      new Promise<string>((resolve) => {
        fetched.push(name);
        pending.push(() => resolve(`${name}-data`));
      }),
  });
}

vi.mock('@/features/casino/blackjack/api/queries', () => ({ blackjackSnapshotQuery: section('blackjack') }));
vi.mock('@/features/casino/roulette/api/queries', () => ({ rouletteHistoryQuery: section('roulette') }));
vi.mock('@/features/profile/api/profileQueries', () => ({
  casinoHistoryPreviewQueryOptions: section('casino-history'),
  profileBadgesQueryOptions: section('badges'),
  profileStatsQueryOptions: section('stats'),
  sportsbookHistoryPreviewQueryOptions: section('sportsbook-history'),
}));
vi.mock('@/features/rankings/api/queries', () => ({ rankingsQuery: section('rankings') }));
vi.mock('@/features/social/api/queries', () => ({
  socialFeedQuery: () => ({
    queryKey: ['feed'],
    queryFn: () => {
      fetched.push('feed');
      return Promise.resolve([]);
    },
    initialPageParam: 0,
    getNextPageParam: () => undefined,
  }),
  socialStoriesQuery: section('stories'),
}));

const { prefetchPageData } = await import('./preload');

/** Resolves to 'held' when the promise is still open after the pending requests started. */
async function settleState(promise: Promise<unknown>): Promise<'resolved' | 'held'> {
  const marker = Symbol('held');
  const result = await Promise.race([promise.then(() => 'resolved' as const), new Promise((r) => setTimeout(() => r(marker), 20))]);
  return result === marker ? 'held' : 'resolved';
}

describe('prefetchPageData', () => {
  beforeEach(() => {
    client.current = new QueryClient();
    fetched.length = 0;
    pending.length = 0;
  });

  it('holds the overlay for the first screens after a sign-in with nothing cached', async () => {
    const run = prefetchPageData('user-1', () => undefined);

    expect(await settleState(run)).toBe('held');
    expect(fetched).toEqual(
      expect.arrayContaining(['feed', 'stories', 'stats', 'badges', 'rankings', 'roulette', 'blackjack']),
    );

    for (const release of pending) release();
    expect(await settleState(run)).toBe('resolved');
  });

  it('loads the sections missing from a restored cache without holding the overlay', async () => {
    client.current!.setQueryData(['feed'], { pages: [[]], pageParams: [0] });
    client.current!.setQueryData(['stats'], 'cached-stats');

    const run = prefetchPageData('user-1', () => undefined);

    expect(await settleState(run)).toBe('resolved');
    expect(fetched).toContain('rankings');
    expect(fetched).not.toContain('feed');
    expect(fetched).not.toContain('stats');
  });
});
