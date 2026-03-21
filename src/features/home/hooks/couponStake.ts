import { CouponStakeAssetPayload } from '@/types/markets';

interface CouponItemInput {
  betId: string;
  selectedOption: string;
  odds: number;
}

interface BuildCouponPlacementPayloadInput {
  activeTab: 'single' | 'ako';
  totalStakePln: number;
  effectiveTotalOdds: number;
  items: CouponItemInput[];
  singleStakeByBetId: Record<string, number>;
  stakeAsset: CouponStakeAssetPayload | null;
}

interface CouponPlacementPayload {
  totalOdds: number;
  stake: number;
  items: Array<{
    betId: string;
    selectedOption: string;
    odds: number;
    stake: number;
  }>;
  stakeAsset: CouponStakeAssetPayload | null;
}

interface ValidateCouponStakeSelectionInput {
  useAssetStake: boolean;
  totalStakePln: number;
  totalBalancePln: number;
  stakeAssetQuantity: number | null;
  stakeAssetMinBetPln: number | null;
}

const roundMoney = (value: number) => Math.round(value * 100) / 100;

export function validateCouponStakeSelection({
  useAssetStake,
  totalStakePln,
  totalBalancePln,
  stakeAssetQuantity,
  stakeAssetMinBetPln,
}: ValidateCouponStakeSelectionInput): string | null {
  if (useAssetStake) {
    if (!stakeAssetQuantity || stakeAssetQuantity <= 0) {
      return 'Podaj ilość aktywa do obstawienia';
    }

    if (stakeAssetMinBetPln && totalStakePln < stakeAssetMinBetPln) {
      return `Minimalna wartość stawki dla tego aktywa to ${stakeAssetMinBetPln.toFixed(2)} zł`;
    }

    return null;
  }

  if (totalStakePln < 1) {
    return 'Minimalna stawka to 1.00 zł';
  }

  if (totalStakePln > totalBalancePln) {
    return `Niewystarczające środki (saldo: ${totalBalancePln.toFixed(2)} zł)`;
  }

  return null;
}

export function buildCouponPlacementPayload({
  activeTab,
  totalStakePln,
  effectiveTotalOdds,
  items,
  singleStakeByBetId,
  stakeAsset,
}: BuildCouponPlacementPayloadInput): CouponPlacementPayload {
  const normalizedTotalStake = roundMoney(totalStakePln);

  const normalizedItems = items.map((item) => {
    const stake =
      activeTab === 'single'
        ? roundMoney(singleStakeByBetId[item.betId] ?? 0)
        : roundMoney(normalizedTotalStake / items.length);

    return {
      betId: item.betId,
      selectedOption: item.selectedOption,
      odds: item.odds,
      stake,
    };
  });

  return {
    totalOdds: activeTab === 'ako' ? effectiveTotalOdds : 1,
    stake: normalizedTotalStake,
    items: normalizedItems,
    stakeAsset,
  };
}
