import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

const { inMock } = vi.hoisted(() => ({
  inMock: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: invokeMock,
    },
    from: () => ({
      select: () => ({
        in: inMock,
      }),
    }),
  },
}));

import {
  fetchTwelveDataQuotes,
  searchTwelveDataSymbols,
} from '@/features/markets/provider.twelvedata';

describe('provider.twelvedata edge proxy client', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    inMock.mockReset();
  });

  it('fetches quotes through edge function and returns normalized map', async () => {
    inMock.mockResolvedValue({
      data: [
        {
          symbol: 'AAPL',
          quote_currency: 'USD',
          price: 250.1,
          open: 248,
          high: 251,
          low: 247,
          volume: 1000,
          as_of: '2026-03-18T00:00:00.000Z',
          provider: 'twelvedata',
        },
      ],
      error: null,
    });

    const result = await fetchTwelveDataQuotes(['AAPL']);

    expect(inMock).toHaveBeenCalledWith('symbol', ['AAPL']);
    expect(result.AAPL.price).toBe(250.1);
  });

  it('fetches symbol search results through edge function', async () => {
    invokeMock.mockResolvedValue({
      data: {
        results: [
          {
            symbol: 'TSLA',
            displayName: 'Tesla, Inc.',
            quoteCurrency: 'USD',
            type: 'stock',
          },
        ],
      },
      error: null,
    });

    const result = await searchTwelveDataSymbols('tesla');

    expect(invokeMock).toHaveBeenCalledWith('market-data', {
      body: {
        action: 'search',
        query: 'tesla',
      },
    });
    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe('TSLA');
  });

  it('returns empty map when cache table has no symbols yet', async () => {
    inMock.mockResolvedValue({ data: [], error: null });

    const result = await fetchTwelveDataQuotes(['MSFT']);

    expect(result).toEqual({});
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
