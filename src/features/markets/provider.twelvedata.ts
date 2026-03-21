import { supabase } from '@/integrations/supabase/client';
import { MarketAssetType, MarketAssetQuote } from '@/types/markets';

interface SearchMarketDataResult {
  symbol: string;
  displayName: string;
  quoteCurrency: string;
  type: MarketAssetType;
}

interface SearchMarketDataResponse {
  results?: SearchMarketDataResult[];
}

const functionClient = supabase as never as {
  functions: {
    invoke: <T>(
      functionName: string,
      options?: { body?: unknown }
    ) => Promise<{ data: T | null; error: { message: string } | null }>;
  };
};

export async function fetchTwelveDataQuotes(symbols: string[]): Promise<Record<string, MarketAssetQuote>> {
  const normalizedSymbols = symbols
    .map((symbol) => symbol.trim().toUpperCase())
    .filter((symbol) => symbol.length > 0);

  if (normalizedSymbols.length === 0) {
    return {};
  }

  const queryQuotes = async () => {
    return (supabase as never as {
      from: (table: string) => {
        select: (fields: string) => {
          in: (column: string, values: string[]) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
        };
      };
    })
      .from('market_quotes')
      .select('symbol, quote_currency, price, open, high, low, volume, as_of, provider')
      .in('symbol', normalizedSymbols);
  };

  const { data, error } = await queryQuotes();

  if (error) {
    throw new Error(error.message);
  }

  const mappedFromRows = (rows: unknown[] | null | undefined) => {
    const quotesBySymbol: Record<string, MarketAssetQuote> = {};
    (rows ?? []).forEach((row) => {
      const quote = row as {
        symbol: string;
        quote_currency: string;
        price: number;
        open: number | null;
        high: number | null;
        low: number | null;
        volume: number | null;
        as_of: string;
      };

      const symbol = quote.symbol.toUpperCase();
      quotesBySymbol[symbol] = {
        symbol,
        quoteCurrency: quote.quote_currency,
        price: Number(quote.price),
        open: quote.open === null ? null : Number(quote.open),
        high: quote.high === null ? null : Number(quote.high),
        low: quote.low === null ? null : Number(quote.low),
        volume: quote.volume === null ? null : Number(quote.volume),
        asOf: quote.as_of,
        provider: 'twelvedata',
      };
    });

    return quotesBySymbol;
  };

  return mappedFromRows(data);
}

export async function searchTwelveDataSymbols(query: string): Promise<SearchMarketDataResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const { data, error } = await functionClient.functions.invoke<SearchMarketDataResponse>('market-data', {
    body: {
      action: 'search',
      query: trimmed,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  return data?.results ?? [];
}
