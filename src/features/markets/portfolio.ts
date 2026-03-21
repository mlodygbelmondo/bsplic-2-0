import {
  MarketAsset,
  MarketAssetPosition,
  MarketAssetQuote,
  MarketPortfolioSummary,
  MarketTransactionRecord,
} from '@/types/markets';
import { convertPriceToPln, roundAssetAmount, roundMoney } from '@/features/markets/pricing';

export interface BuildAssetPositionInput {
  asset: MarketAsset;
  transactions: MarketTransactionRecord[];
  quote: MarketAssetQuote | null | undefined;
  fxRatesToPln: Record<string, number>;
}

function sortTransactionsByDate(transactions: MarketTransactionRecord[]): MarketTransactionRecord[] {
  return [...transactions].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

export function buildAssetPosition({
  asset,
  transactions,
  quote,
  fxRatesToPln,
}: BuildAssetPositionInput): MarketAssetPosition | null {
  if (!quote) return null;

  const currentUnitPricePln = convertPriceToPln({
    price: quote.price,
    quoteCurrency: quote.quoteCurrency,
    fxRatesToPln,
  });

  if (!currentUnitPricePln) return null;

  const ordered = sortTransactionsByDate(transactions);

  let quantity = 0;
  let costBasis = 0;

  ordered.forEach((transaction) => {
    if (transaction.side === 'buy') {
      quantity += transaction.quantity;
      costBasis += transaction.net_value_pln;
      return;
    }

    if (transaction.side === 'bet_stake') {
      if (quantity <= 0) return;

      const stakeQty = Math.min(transaction.quantity, quantity);
      const averageCost = quantity > 0 ? costBasis / quantity : 0;
      quantity -= stakeQty;
      costBasis -= averageCost * stakeQty;
      return;
    }

    if (transaction.side === 'sell') {
      if (quantity <= 0) return;

      const sellQty = Math.min(transaction.quantity, quantity);
      const averageCost = quantity > 0 ? costBasis / quantity : 0;
      quantity -= sellQty;
      costBasis -= averageCost * sellQty;
      return;
    }
  });

  if (quantity <= 0) return null;

  const netQuantity = roundAssetAmount(quantity);
  const normalizedCostBasis = roundMoney(costBasis);
  const averageCostPln = quantity > 0 ? roundMoney(normalizedCostBasis / netQuantity) : 0;
  const marketValuePln = roundMoney(netQuantity * currentUnitPricePln);
  const unrealizedPnlPln = roundMoney(marketValuePln - normalizedCostBasis);

  return {
    asset,
    netQuantity,
    averageCostPln,
    currentUnitPricePln,
    marketValuePln,
    costBasisPln: normalizedCostBasis,
    unrealizedPnlPln,
  };
}

export function calculatePortfolioSummary(positions: MarketAssetPosition[]): MarketPortfolioSummary {
  const totalValuePln = roundMoney(
    positions.reduce((sum, position) => {
      return sum + position.marketValuePln;
    }, 0)
  );

  const totalCostBasisPln = roundMoney(
    positions.reduce((sum, position) => {
      return sum + position.costBasisPln;
    }, 0)
  );

  const totalUnrealizedPnlPln = roundMoney(totalValuePln - totalCostBasisPln);

  const unrealizedPnlPct =
    totalCostBasisPln > 0
      ? roundMoney((totalUnrealizedPnlPln / totalCostBasisPln) * 100)
      : 0;

  return {
    totalValuePln,
    totalCostBasisPln,
    totalUnrealizedPnlPln,
    unrealizedPnlPct,
  };
}
