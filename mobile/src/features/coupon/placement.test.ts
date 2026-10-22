import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CouponItem } from '@/types/database';

import {
  createRequestIdStore,
  doubleStake,
  eventsLabel,
  maxStakeFor,
  normalizeStakeInput,
  submitCoupon,
  type RequestIdStore,
  type SubmitCouponInput,
} from './placement';

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
let requestIds: RequestIdStore;
const deps = () => ({ place: placeCouponSecure, requestIds });
const UNCONFIRMED = 'Nie udało się potwierdzić kuponu. Postaw go jeszcze raz bez zmian: nie zostanie przyjęty dwa razy.';
const connectionAbort = () => new Error("fetch failed: The operation couldn't be completed. Software caused connection abort");

describe('submitCoupon', () => {
  beforeEach(() => {
    placeCouponSecure.mockReset();
    placeCouponSecure.mockResolvedValue('coupon-1');
    let next = 0;
    requestIds = createRequestIdStore(() => `req-${++next}`);
  });

  it('places multiple single-tab items as separate one-leg coupons', async () => {
    const result = await submitCoupon(
      input({
        items: [createCouponItem('bet-1', 1.8), createCouponItem('bet-2', 2.2)],
        singleStakes: { 'bet-1': '7', 'bet-2': '8' },
      }),
      deps(),
    );

    expect(placeCouponSecure).toHaveBeenCalledTimes(2);
    expect(placeCouponSecure).toHaveBeenNthCalledWith(1, {
      userId: 'user-1',
      totalOdds: 1,
      stake: 7,
      items: [{ betId: 'bet-1', selectedOption: 'A', odds: 1.8, stake: 7 }],
      requestId: 'req-1',
    });
    expect(placeCouponSecure).toHaveBeenNthCalledWith(2, {
      userId: 'user-1',
      totalOdds: 1,
      stake: 8,
      items: [{ betId: 'bet-2', selectedOption: 'A', odds: 2.2, stake: 8 }],
      requestId: 'req-2',
    });
    expect(result).toEqual({ status: 'placed', chargedStake: 15 });
  });

  it('rejects over-precision single stakes before rounding', async () => {
    const result = await submitCoupon(
      input({ items: [createCouponItem('bet-1', 1.8)], singleStakes: { 'bet-1': '10.999' } }),
      deps(),
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
      deps(),
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
      requestId: 'req-1',
    });
  });

  it('blocks a stake above the balance without calling the server', async () => {
    const result = await submitCoupon(
      input({ balance: 12.5, activeTab: 'ako', stake: '15', items: [createCouponItem('bet-1', 2)] }),
      deps(),
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
      deps(),
    );

    expect(placeCouponSecure).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      status: 'failed',
      message: 'Zakład jest już zamknięty',
      placedBetIds: ['bet-1'],
      chargedStake: 7,
      oddsChanged: false,
    });
  });

  it('retries a lost response once under the same request id', async () => {
    placeCouponSecure.mockRejectedValueOnce(connectionAbort()).mockResolvedValueOnce('coupon-1');

    const result = await submitCoupon(
      input({ activeTab: 'ako', stake: '10', items: [createCouponItem('bet-1', 2), createCouponItem('bet-2', 3)] }),
      deps(),
    );

    expect(result).toEqual({ status: 'placed', chargedStake: 10 });
    expect(placeCouponSecure.mock.calls.map(([params]) => params.requestId)).toEqual(['req-1', 'req-1']);
  });

  it('keeps the request id of an unconfirmed coupon for the next attempt at the same coupon', async () => {
    placeCouponSecure.mockRejectedValueOnce(connectionAbort()).mockRejectedValueOnce(new Error('Error: fetch failed: Fetch request has been canceled'));
    const ako = input({ activeTab: 'ako', stake: '10', items: [createCouponItem('bet-1', 2), createCouponItem('bet-2', 3)] });

    const unconfirmed = await submitCoupon(ako, deps());
    await submitCoupon(ako, deps());
    await submitCoupon({ ...ako, stake: '12' }, deps());

    expect(unconfirmed).toEqual({ status: 'failed', message: UNCONFIRMED, placedBetIds: [], chargedStake: 0, oddsChanged: false });
    expect(placeCouponSecure.mock.calls.map(([params]) => params.requestId)).toEqual(['req-1', 'req-1', 'req-1', 'req-2']);
  });

  it('flags a coupon refused because its odds changed', async () => {
    placeCouponSecure.mockRejectedValueOnce({
      message: 'Kurs zakładu się zmienił. Sprawdź kupon i postaw go ponownie.',
      code: 'P0001',
      hint: 'odds_changed',
    });

    const result = await submitCoupon(
      input({ items: [createCouponItem('bet-1', 2)], singleStakes: { 'bet-1': '5' } }),
      deps(),
    );

    expect(result).toEqual({
      status: 'failed',
      message: 'Kurs zakładu się zmienił. Sprawdź kupon i postaw go ponownie.',
      placedBetIds: [],
      chargedStake: 0,
      oddsChanged: true,
    });
  });

  it('reports a plain failure when the database never ran the placement', async () => {
    placeCouponSecure
      .mockRejectedValueOnce({ message: 'Timed out acquiring connection from connection pool.', code: 'PGRST003' })
      .mockRejectedValueOnce(new Error('Error: fetch failed: The Internet connection appears to be offline.'));
    const ako = input({ activeTab: 'ako', stake: '10', items: [createCouponItem('bet-1', 2), createCouponItem('bet-2', 3)] });

    const poolTimeout = await submitCoupon(ako, deps());
    const offline = await submitCoupon(ako, deps());

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
    expect(eventsLabel(12)).toBe('zdarzeń');
    expect(eventsLabel(22)).toBe('zdarzenia');
  });
});

describe('maxStakeFor', () => {
  it('stakes the whole balance when it is whole cents', () => {
    expect(maxStakeFor(0.29)).toBe('0.29');
    expect(maxStakeFor(4.35)).toBe('4.35');
  });
});
