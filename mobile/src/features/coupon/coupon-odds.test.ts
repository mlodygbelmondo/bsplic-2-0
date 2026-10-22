import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CouponItem } from '@/types/database';

import { applyCouponOdds, toBetOdds } from './coupon-odds';
import { couponSheetActions } from './coupon-sheet-store';
import { useCouponStore } from './coupon-store';

const toastWarning = vi.hoisted(() => vi.fn());

vi.mock('@/lib/storage', () => ({
  kv: { getString: () => undefined, set: vi.fn(), remove: vi.fn() },
  readJson: () => null,
}));
vi.mock('@/lib/toast', () => ({ toast: { warning: toastWarning, success: vi.fn() } }));
vi.mock('@/lib/supabase', () => ({ supabase: {} }));

function pick(betId: string, selectedOption: string, odds: number): CouponItem {
  return {
    bet: {
      id: betId,
      title: `Mecz ${betId}`,
      category_id: null,
      bet_type: '12',
      options: [
        { name: 'Gospodarze', odds },
        { name: 'Goście', odds: 1.8 },
      ],
      ends_at: '2030-01-01T12:00:00.000Z',
      is_live: false,
      is_active: true,
      winning_option: null,
      bet_count: 0,
      created_at: '2030-01-01T10:00:00.000Z',
    },
    selectedOption,
    odds,
  };
}

describe('coupon odds sync', () => {
  beforeEach(() => {
    toastWarning.mockReset();
    couponSheetActions.setPlacing(false);
    useCouponStore.setState({ items: [pick('bet-1', 'Gospodarze', 2.05), pick('bet-2', 'Gospodarze', 1.5)] });
  });

  it('moves a pick to its new odds and tells the player', () => {
    const changes = applyCouponOdds([
      { id: 'bet-1', options: [{ name: 'Gospodarze', odds: 1.95 }, { name: 'Goście', odds: 1.9 }] },
      { id: 'bet-2', options: [{ name: 'Gospodarze', odds: 1.5 }, { name: 'Goście', odds: 2.4 }] },
    ]);

    const [first, second] = useCouponStore.getState().items;
    expect(first.odds).toBe(1.95);
    expect(second.odds).toBe(1.5);
    expect(changes).toEqual([{ betId: 'bet-1', title: 'Mecz bet-1', option: 'Gospodarze', from: 2.05, to: 1.95 }]);
    expect(toastWarning).toHaveBeenCalledWith('Kurs się zmienił', {
      id: 'coupon-odds',
      description: 'Gospodarze: 2.05 → 1.95',
    });
  });

  it('leaves the coupon alone while a placement is in flight', () => {
    couponSheetActions.setPlacing(true);

    const changes = applyCouponOdds([{ id: 'bet-1', options: [{ name: 'Gospodarze', odds: 3 }] }]);

    expect(changes).toEqual([]);
    expect(useCouponStore.getState().items[0].odds).toBe(2.05);
    expect(toastWarning).not.toHaveBeenCalled();
  });

  it('reads odds from bets rows and skips malformed ones', () => {
    expect(
      toBetOdds([
        { id: 'bet-1', options: [{ name: 'Gospodarze', odds: '1.95' }] },
        { id: 'bet-2', options: 'not a list' },
        { id: 'bet-3', options: [{ odds: 2 }] },
      ]),
    ).toEqual([{ id: 'bet-1', options: [{ name: 'Gospodarze', odds: 1.95 }] }]);
  });
});
