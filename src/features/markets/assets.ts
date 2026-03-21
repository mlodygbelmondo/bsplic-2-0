import { MarketAssetType } from '@/types/markets';

export function parseAssetAmount(rawValue: string): number | null {
  const normalized = rawValue.trim().replace(',', '.');
  if (!normalized) return null;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;

  return parsed;
}

export function getAssetAmountStep(type: MarketAssetType): number {
  if (type === 'crypto') return 0.00000001;
  if (type === 'forex') return 0.01;
  return 0.0001;
}

export function getAssetSymbol(type: MarketAssetType): string {
  if (type === 'crypto') return 'BTC';
  if (type === 'etf') return 'udziału';
  if (type === 'forex') return 'jedn.';
  return 'akcji';
}

export function validateCashStake({
  amountInPln,
  minStakePln,
}: {
  amountInPln: number;
  minStakePln: number;
}): string | null {
  if (amountInPln < minStakePln) {
    return `Minimalna wartość transakcji to ${minStakePln.toFixed(2)} zł`;
  }

  return null;
}

export function validateAssetAmount({
  type,
  amount,
}: {
  type: MarketAssetType;
  amount: number;
}): string | null {
  if (!Number.isFinite(amount) || amount <= 0) {
    return 'Ilość musi być większa od 0';
  }

  const minAmount = getAssetAmountStep(type);
  if (amount < minAmount) {
    return `Minimalna ilość to ${minAmount}`;
  }

  return null;
}
