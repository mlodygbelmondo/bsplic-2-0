import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CouponItem } from '@/types/database';

import { doubleStake, eventsLabel, normalizeStakeInput, submitCoupon, type SubmitCouponInput } from './placement';

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

function input(overrides: Partial<SubmitCouponInput>): SubmitCouponInput {
  return {
    userId: 'user-1',
    balance: 1000,
    activeTab: 'single',
    stake: '10',
    singleStakes: {},
    items: [],
    ...overrides,
  };
}

const placeCouponSecure = vi.fn();

describe('submitCoupon', () => {
  beforeEach(() => {
    placeCouponSecure.mockReset();
    placeCouponSecure.mockResolvedValue('coupon-1');
  });

  it('places multiple single-tab items as separate one-leg coupons', async () => {
    const result = await submitCoupon(
      input({
        items: [createCouponItem('bet-1', 1.8), createCouponItem('bet-2', 2.2)],
        singleStakes: { 'bet-1': '7', 'bet-2': '8' },
      }),
      placeCouponSecure,
    );

    expect(placeCouponSecure).toHaveBeenCalledTimes(2);
    expect(placeCouponSecure).toHaveBeenNthCalledWith(1, {
      userId: 'user-1',
      totalOdds: 1,
      stake: 7,
      items: [{ betId: 'bet-1', selectedOption: 'A', odds: 1.8, stake: 7 }],
    });
    expect(placeCouponSecure).toHaveBeenNthCalledWith(2, {
      userId: 'user-1',
      totalOdds: 1,
      stake: 8,
      items: [{ betId: 'bet-2', selectedOption: 'A', odds: 2.2, stake: 8 }],
    });
    expect(result).toEqual({ status: 'placed', chargedStake: 15 });
  });

  it('rejects over-precision single stakes before rounding', async () => {
    const result = await submitCoupon(
      input({ items: [createCouponItem('bet-1', 1.8)], singleStakes: { 'bet-1': '10.999' } }),
      placeCouponSecure,
    );

    expect(placeCouponSecure).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: 'invalid',
      message: 'Stawka może mieć maksymalnie 2 miejsca po przecinku',
    });
  });

  it('distributes AKO stakes so leg cents sum to the charged stake', async () => {
    await submitCoupon(
      input({
        activeTab: 'ako',
        stake: '10',
        items: [createCouponItem('bet-1', 1.5), createCouponItem('bet-2', 2), createCouponItem('bet-3', 2.5)],
      }),
      placeCouponSecure,
    );

    expect(placeCouponSecure).toHaveBeenCalledTimes(1);
    expect(placeCouponSecure).toHaveBeenCalledWith({
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

  it('blocks a stake above the balance without calling the server', async () => {
    const result = await submitCoupon(
      input({ balance: 12.5, activeTab: 'ako', stake: '15', items: [createCouponItem('bet-1', 2)] }),
      placeCouponSecure,
    );

    expect(placeCouponSecure).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'invalid', message: 'Niewystarczające środki (saldo: 12.50 zł)' });
  });

  it('reports singles placed before a server rejection with the server message', async () => {
    placeCouponSecure
      .mockResolvedValueOnce('coupon-1')
      .mockRejectedValueOnce(new Error('Zakład jest już zamknięty'));

    const result = await submitCoupon(
      input({
        items: [createCouponItem('bet-1', 1.8), createCouponItem('bet-2', 2.2), createCouponItem('bet-3', 3)],
        singleStakes: { 'bet-1': '7', 'bet-2': '8', 'bet-3': '9' },
      }),
      placeCouponSecure,
    );

    expect(placeCouponSecure).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      status: 'failed',
      message: 'Zakład jest już zamknięty',
      placedBetIds: ['bet-1'],
      chargedStake: 7,
    });
  });

  it('asks to check the history when a timeout leaves the outcome unknown', async () => {
    placeCouponSecure.mockRejectedValueOnce(new Error('Error: fetch failed: Fetch request has been canceled'));

    const result = await submitCoupon(
      input({ activeTab: 'ako', stake: '10', items: [createCouponItem('bet-1', 2), createCouponItem('bet-2', 3)] }),
      placeCouponSecure,
    );

    expect(result).toEqual({
      status: 'failed',
      message: 'Nie udało się potwierdzić kuponu. Sprawdź historię w profilu, zanim postawisz go ponownie.',
      placedBetIds: [],
      chargedStake: 0,
    });
  });

  it('reports a plain failure when the database never ran the placement', async () => {
    placeCouponSecure
      .mockRejectedValueOnce({ message: 'Timed out acquiring connection from connection pool.', code: 'PGRST003' })
      .mockRejectedValueOnce(new Error('Error: fetch failed: The Internet connection appears to be offline.'));
    const ako = input({ activeTab: 'ako', stake: '10', items: [createCouponItem('bet-1', 2), createCouponItem('bet-2', 3)] });

    const poolTimeout = await submitCoupon(ako, placeCouponSecure);
    const offline = await submitCoupon(ako, placeCouponSecure);

    expect(poolTimeout).toMatchObject({ status: 'failed', message: 'Nie udało się postawić kuponu' });
    expect(offline).toMatchObject({ status: 'failed', message: 'Nie udało się postawić kuponu' });
  });
});

describe('coupon stake helpers', () => {
  it('doubles the AKO stake and resets an unusable one to 10', () => {
    expect(doubleStake('10')).toBe('20');
    expect(doubleStake('12.5')).toBe('25');
    expect(doubleStake('1.25')).toBe('2.50');
    expect(doubleStake('')).toBe('10');
    expect(doubleStake('0')).toBe('10');
  });

  it('accepts the decimal comma from the Polish keypad', () => {
    expect(normalizeStakeInput('12,5')).toBe('12.5');
  });

  it('labels the event count like the web drawer header', () => {
    expect(eventsLabel(1)).toBe('zdarzenie');
    expect(eventsLabel(3)).toBe('zdarzenia');
    expect(eventsLabel(5)).toBe('zdarzeń');
  });
});
