import { MarketAsset, MarketAssetQuote } from '@/types/markets';
import { fetchTwelveDataQuotes } from '@/features/markets/provider.twelvedata';

export interface MarketQuotesResult {
  quotesBySymbol: Record<string, MarketAssetQuote>;
  missingSymbols: string[];
}

export async function fetchMarketQuotes(assets: MarketAsset[]): Promise<MarketQuotesResult> {
  const symbols = assets.map((asset) => asset.symbol.trim().toUpperCase()).filter(Boolean);

  if (symbols.length === 0) {
    return { quotesBySymbol: {}, missingSymbols: [] };
  }

  let quotesBySymbol: Record<string, MarketAssetQuote> = {};

  try {
    quotesBySymbol = await fetchTwelveDataQuotes(symbols);
  } catch {
    return {
      quotesBySymbol: {},
      missingSymbols: symbols,
    };
  }

  const missingSymbols = symbols.filter((symbol) => !quotesBySymbol[symbol]);

  return {
    quotesBySymbol,
    missingSymbols,
  };
}
