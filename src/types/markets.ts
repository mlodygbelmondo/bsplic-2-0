export type MarketAssetType = 'stock' | 'etf' | 'crypto' | 'forex' | 'commodity';

export interface MarketAsset {
  id: string;
  symbol: string;
  display_name: string;
  type: MarketAssetType;
  quote_currency: string;
  is_active: boolean;
  min_bet_pln: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface MarketTransactionRecord {
  id: string;
  user_id: string;
  asset_id: string;
  side: 'buy' | 'sell' | 'bet_stake';
  quantity: number;
  unit_price_pln: number;
  quote_currency: string;
  fx_rate_to_pln: number;
  gross_value_pln: number;
  fee_pln: number;
  net_value_pln: number;
  created_at: string;
}

export interface MarketAssetQuote {
  symbol: string;
  quoteCurrency: string;
  price: number;
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  asOf: string;
  provider: 'twelvedata';
}

export interface MarketAssetPosition {
  asset: MarketAsset;
  netQuantity: number;
  averageCostPln: number;
  currentUnitPricePln: number;
  marketValuePln: number;
  costBasisPln: number;
  unrealizedPnlPln: number;
}

export interface MarketPortfolioSummary {
  totalValuePln: number;
  totalCostBasisPln: number;
  totalUnrealizedPnlPln: number;
  unrealizedPnlPct: number;
}

export interface CouponStakeAssetPayload {
  assetId: string;
  symbol: string;
  type: MarketAssetType;
  quantity: number;
  quoteCurrency: string;
  unitPricePln: number;
  fxRateToPln: number;
}
