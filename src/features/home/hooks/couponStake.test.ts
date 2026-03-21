import { describe, expect, it } from 'vitest';

import {
  buildCouponPlacementPayload,
  validateCouponStakeSelection,
} from '@/features/home/hooks/couponStake';

describe('coupon stake helpers', () => {
  it('builds placement payload for asset-backed stake', () => {
    const payload = buildCouponPlacementPayload({
      activeTab: 'ako',
      totalStakePln: 780,
      effectiveTotalOdds: 2.1,
      items: [
        { betId: 'b1', selectedOption: '1', odds: 1.8 },
        { betId: 'b2', selectedOption: '2', odds: 2.4 },
      ],
      singleStakeByBetId: {},
      stakeAsset: {
        assetId: 'asset-tsla',
        symbol: 'TSLA.US',
        type: 'stock',
        quantity: 2,
        quoteCurrency: 'USD',
        unitPricePln: 390,
        fxRateToPln: 3.9,
      },
    });

    expect(payload.totalOdds).toBe(2.1);
    expect(payload.stake).toBe(780);
    expect(payload.stakeAsset?.assetId).toBe('asset-tsla');
    expect(payload.items).toHaveLength(2);
  });

  it('keeps per-bet stakes for single coupons in asset mode', () => {
    const payload = buildCouponPlacementPayload({
      activeTab: 'single',
      totalStakePln: 37,
      effectiveTotalOdds: 1,
      items: [
        { betId: 'b1', selectedOption: '1', odds: 2 },
        { betId: 'b2', selectedOption: '2', odds: 3 },
      ],
      singleStakeByBetId: {
        b1: 12,
        b2: 25,
      },
      stakeAsset: {
        assetId: 'asset-btc',
        symbol: 'BTC/USD',
        type: 'crypto',
        quantity: 0.001,
        quoteCurrency: 'USD',
        unitPricePln: 37000,
        fxRateToPln: 4,
      },
    });

    expect(payload.stake).toBe(37);
    expect(payload.items).toEqual([
      { betId: 'b1', selectedOption: '1', odds: 2, stake: 12 },
      { betId: 'b2', selectedOption: '2', odds: 3, stake: 25 },
    ]);
  });

  it('rejects missing asset quantity in asset mode', () => {
    const error = validateCouponStakeSelection({
      useAssetStake: true,
      totalStakePln: 0,
      totalBalancePln: 500,
      stakeAssetQuantity: null,
      stakeAssetMinBetPln: 5,
    });

    expect(error).toBe('Podaj ilość aktywa do obstawienia');
  });

  it('rejects cash stake below minimum in PLN mode', () => {
    const error = validateCouponStakeSelection({
      useAssetStake: false,
      totalStakePln: 0.5,
      totalBalancePln: 500,
      stakeAssetQuantity: null,
      stakeAssetMinBetPln: null,
    });

    expect(error).toBe('Minimalna stawka to 1.00 zł');
  });
});
