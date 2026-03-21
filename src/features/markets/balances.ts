import { MarketTransactionRecord } from '@/types/markets';
import { roundAssetAmount } from '@/features/markets/pricing';

export function buildAssetBalancesById(transactions: MarketTransactionRecord[]): Record<string, number> {
  return transactions.reduce<Record<string, number>>((acc, transaction) => {
    const previous = acc[transaction.asset_id] ?? 0;
    const delta = transaction.side === 'buy' ? transaction.quantity : -transaction.quantity;
    acc[transaction.asset_id] = roundAssetAmount(previous + delta);
    return acc;
  }, {});
}
