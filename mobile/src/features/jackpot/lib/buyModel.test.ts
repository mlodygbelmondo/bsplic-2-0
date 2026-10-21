import { describe, expect, it } from 'vitest';

import { getJackpotBuyModel, getPurchaseToastMessage } from './buyModel';

const base = {
  ticketPrice: 100,
  balance: 250,
  currentTicketCount: 0,
  maxTicketsPerPlayer: 2,
  requestedCount: 1,
  buying: false,
};

describe('jackpot buy confirmation', () => {
  it('offers both tickets when the balance covers them and confirms the chosen count', () => {
    const one = getJackpotBuyModel(base);
    expect(one.quantityOptions).toEqual([1, 2]);
    expect(one.confirmLabel).toBe('Kupuję 1 ticket');
    expect(one.canConfirm).toBe(true);

    const two = getJackpotBuyModel({ ...base, requestedCount: 2 });
    expect(two.confirmLabel).toBe('Kupuję 2 tickety');
    expect(two.total).toBe(200);
    expect(two.canConfirm).toBe(true);
  });

  it('only lets the balance pay for as many tickets as it covers', () => {
    const model = getJackpotBuyModel({ ...base, balance: 150 });
    expect(model.affordableCount).toBe(1);
    expect(model.confirmLabel).toBe('Kupuję 1 ticket');
    expect(model.canConfirm).toBe(true);
    expect(getJackpotBuyModel({ ...base, balance: 150, requestedCount: 2 }).canConfirm).toBe(false);
  });

  it('offers only the remaining slot after the first ticket', () => {
    const model = getJackpotBuyModel({ ...base, currentTicketCount: 1, requestedCount: 2 });
    expect(model.quantityOptions).toEqual([1]);
    expect(model.count).toBe(1);
    expect(model.confirmLabel).toBe('Kupuję 1 ticket');
  });

  it('explains why nothing can be bought', () => {
    expect(getJackpotBuyModel({ ...base, balance: 40 }).confirmLabel).toBe('Brak środków na ticket');
    expect(getJackpotBuyModel({ ...base, balance: 40 }).canConfirm).toBe(false);
    const full = getJackpotBuyModel({ ...base, currentTicketCount: 2 });
    expect(full.confirmLabel).toBe('Limit ticketów wykorzystany');
    expect(full.quantityOptions).toEqual([]);
    expect(full.canConfirm).toBe(false);
  });

  it('blocks a second confirmation while buying', () => {
    expect(getJackpotBuyModel({ ...base, buying: true }).canConfirm).toBe(false);
  });

  it('names the bought tickets in the toast', () => {
    expect(getPurchaseToastMessage(['#03'], 1)).toBe('Ticket #03 kupiony!');
    expect(getPurchaseToastMessage([], 1)).toBe('Ticket kupiony!');
    expect(getPurchaseToastMessage(['#03', '#04'], 2)).toBe('Tickety #03 #04 kupione!');
    expect(getPurchaseToastMessage(['#03'], 2)).toBe('Tickety kupione!');
  });
});
