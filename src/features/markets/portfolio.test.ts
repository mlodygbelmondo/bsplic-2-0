import { describe, expect, it } from 'vitest';

import {
  buildAssetPosition,
  calculatePortfolioSummary,
} from '@/features/markets/portfolio';
import { MarketAsset, MarketAssetQuote } from '@/types/markets';

const stockAsset: MarketAsset = {
  id: 'asset-tsla',
  symbol: 'TSLA.US',
  display_name: 'Tesla',
  type: 'stock',
  quote_currency: 'USD',
  is_active: true,
  min_bet_pln: 5,
  sort_order: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const stockQuote: MarketAssetQuote = {
  symbol: 'TSLA.US',
  quoteCurrency: 'USD',
  price: 200,
  open: 198,
  high: 201,
  low: 197,
  volume: 1000,
  asOf: '2026-03-17T10:00:00Z',
  provider: 'twelvedata',
};

describe('market portfolio calculations', () => {
  it('builds position metrics for mixed buy/sell history', () => {
    const position = buildAssetPosition({
      asset: stockAsset,
      transactions: [
        {
          id: 'tx-1',
          user_id: 'u1',
          asset_id: 'asset-tsla',
          side: 'buy',
          quantity: 2,
          unit_price_pln: 780,
          quote_currency: 'USD',
          fx_rate_to_pln: 3.9,
          gross_value_pln: 1560,
          fee_pln: 0,
          net_value_pln: 1560,
          created_at: '2026-03-16T10:00:00Z',
        },
        {
          id: 'tx-2',
          user_id: 'u1',
          asset_id: 'asset-tsla',
          side: 'sell',
          quantity: 0.5,
          unit_price_pln: 820,
          quote_currency: 'USD',
          fx_rate_to_pln: 4.1,
          gross_value_pln: 410,
          fee_pln: 0,
          net_value_pln: 410,
          created_at: '2026-03-17T09:00:00Z',
        },
      ],
      quote: stockQuote,
      fxRatesToPln: { USD: 4 },
    });

    expect(position?.netQuantity).toBe(1.5);
    expect(position?.currentUnitPricePln).toBe(800);
    expect(position?.marketValuePln).toBe(1200);
    expect(position?.averageCostPln).toBe(780);
    expect(position?.unrealizedPnlPln).toBe(30);
  });

  it('aggregates portfolio summary', () => {
    const positions = [
      {
        asset: stockAsset,
        netQuantity: 1,
        averageCostPln: 100,
        marketValuePln: 130,
        costBasisPln: 100,
        currentUnitPricePln: 130,
        unrealizedPnlPln: 30,
      },
      {
        asset: { ...stockAsset, id: 'asset-2', symbol: 'SPY.US' },
        netQuantity: 2,
        averageCostPln: 50,
        marketValuePln: 90,
        costBasisPln: 100,
        currentUnitPricePln: 45,
        unrealizedPnlPln: -10,
      },
    ];

    const summary = calculatePortfolioSummary(positions);
    expect(summary.totalValuePln).toBe(220);
    expect(summary.totalCostBasisPln).toBe(200);
    expect(summary.totalUnrealizedPnlPln).toBe(20);
    expect(summary.unrealizedPnlPct).toBe(10);
  });

  it('subtracts staked asset quantity from portfolio position', () => {
    const position = buildAssetPosition({
      asset: stockAsset,
      transactions: [
        {
          id: 'tx-buy',
          user_id: 'u1',
          asset_id: 'asset-tsla',
          side: 'buy',
          quantity: 0.2,
          unit_price_pln: 50000,
          quote_currency: 'USD',
          fx_rate_to_pln: 4,
          gross_value_pln: 10000,
          fee_pln: 0,
          net_value_pln: 10000,
          created_at: '2026-03-16T10:00:00Z',
        },
        {
          id: 'tx-stake',
          user_id: 'u1',
          asset_id: 'asset-tsla',
          side: 'bet_stake',
          quantity: 0.1,
          unit_price_pln: 55000,
          quote_currency: 'USD',
          fx_rate_to_pln: 4,
          gross_value_pln: 5500,
          fee_pln: 0,
          net_value_pln: 5500,
          created_at: '2026-03-16T11:00:00Z',
        },
      ],
      quote: {
        ...stockQuote,
        price: 1375,
      },
      fxRatesToPln: { USD: 4 },
    });

    expect(position?.netQuantity).toBe(0.1);
    expect(position?.marketValuePln).toBe(550);
  });
});
