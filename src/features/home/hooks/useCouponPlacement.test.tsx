import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CouponItem } from '@/types/database';

import { useCouponPlacement } from './useCouponPlacement';

const mocks = vi.hoisted(() => ({
  clearCoupon: vi.fn(),
  errorToast: vi.fn(),
  items: [] as CouponItem[],
  placeCouponSecure: vi.fn(),
  refreshProfile: vi.fn(),
  removeItem: vi.fn(),
  successToast: vi.fn(),
}));

vi.mock('@/contexts/CouponContext', () => ({
  useCoupon: () => ({
    items: mocks.items,
    clearCoupon: mocks.clearCoupon,
    removeItem: mocks.removeItem,
    totalOdds: mocks.items.reduce((product, item) => product * item.odds, 1),
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    profile: { balance: 1000 },
    refreshProfile: mocks.refreshProfile,
  }),
}));

vi.mock('@/features/home/api/coupons', () => ({
  placeCouponSecure: (...args: unknown[]) => mocks.placeCouponSecure(...args),
}));

vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => mocks.errorToast(...args),
    success: (...args: unknown[]) => mocks.successToast(...args),
  },
}));

function createCouponItem(id: string, odds: number): CouponItem {
  return {
    bet: {
      id,
      title: `Bet ${id}`,
      category_id: null,
      bet_type: '12',
      options: [
        { name: 'A', odds },
        { name: 'B', odds: 2 },
      ],
      ends_at: '2030-01-01T12:00:00.000Z',
      is_live: false,
      is_active: true,
      winning_option: null,
      bet_count: 0,
      created_at: '2030-01-01T10:00:00.000Z',
    },
    selectedOption: 'A',
    odds,
  };
}

describe('useCouponPlacement', () => {
  beforeEach(() => {
    mocks.items = [];
    mocks.clearCoupon.mockReset();
    mocks.errorToast.mockReset();
    mocks.placeCouponSecure.mockReset();
    mocks.placeCouponSecure.mockResolvedValue('coupon-1');
    mocks.refreshProfile.mockReset();
    mocks.removeItem.mockReset();
    mocks.successToast.mockReset();
  });

  it('places multiple single-tab items as separate one-leg coupons', async () => {
    mocks.items = [
      createCouponItem('bet-1', 1.8),
      createCouponItem('bet-2', 2.2),
    ];
    const onSuccess = vi.fn();

    const { result } = renderHook(() =>
      useCouponPlacement(
        'single',
        '10',
        { 'bet-1': '7', 'bet-2': '8' },
        onSuccess,
      ),
    );

    await act(async () => {
      await result.current.placeBet();
    });

    expect(mocks.placeCouponSecure).toHaveBeenCalledTimes(2);
    expect(mocks.placeCouponSecure).toHaveBeenNthCalledWith(1, {
      userId: 'user-1',
      totalOdds: 1,
      stake: 7,
      items: [{ betId: 'bet-1', selectedOption: 'A', odds: 1.8, stake: 7 }],
    });
    expect(mocks.placeCouponSecure).toHaveBeenNthCalledWith(2, {
      userId: 'user-1',
      totalOdds: 1,
      stake: 8,
      items: [{ betId: 'bet-2', selectedOption: 'A', odds: 2.2, stake: 8 }],
    });
    expect(mocks.refreshProfile).toHaveBeenCalledTimes(1);
    expect(mocks.clearCoupon).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('rejects over-precision single stakes before rounding', async () => {
    mocks.items = [createCouponItem('bet-1', 1.8)];

    const { result } = renderHook(() =>
      useCouponPlacement('single', '10', { 'bet-1': '10.999' }, vi.fn()),
    );

    await act(async () => {
      await result.current.placeBet();
    });

    expect(mocks.placeCouponSecure).not.toHaveBeenCalled();
    expect(mocks.errorToast).toHaveBeenCalledWith(
      'Stawka może mieć maksymalnie 2 miejsca po przecinku',
    );
  });

  it('distributes AKO stakes so leg cents sum to the charged stake', async () => {
    mocks.items = [
      createCouponItem('bet-1', 1.5),
      createCouponItem('bet-2', 2),
      createCouponItem('bet-3', 2.5),
    ];

    const { result } = renderHook(() =>
      useCouponPlacement('ako', '10', {}, vi.fn()),
    );

    await act(async () => {
      await result.current.placeBet();
    });

    expect(mocks.placeCouponSecure).toHaveBeenCalledTimes(1);
    expect(mocks.placeCouponSecure).toHaveBeenCalledWith({
      userId: 'user-1',
      totalOdds: 7.5,
      stake: 10,
      items: [
        { betId: 'bet-1', selectedOption: 'A', odds: 1.5, stake: 3.34 },
        { betId: 'bet-2', selectedOption: 'A', odds: 2, stake: 3.33 },
        { betId: 'bet-3', selectedOption: 'A', odds: 2.5, stake: 3.33 },
      ],
    });
  });
});
