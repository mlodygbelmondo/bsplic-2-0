import { describe, expect, it } from 'vitest';

import { parseMoneyTransferHistory, parseMoneyTransferResult, parseMoneyTransferRules } from './parsers';

const rulesPayload = {
  min_amount: 1,
  max_message_length: 2000,
  max_transfers_per_hour: 5,
  min_account_age_days: 14,
  sender_eligible_at: null,
  sender_eligible: true,
  server_now: '2026-07-20T10:00:00.000Z',
  extra: 'ignored',
};

describe('parseMoneyTransferRules', () => {
  it('keeps the known fields of a valid snapshot', () => {
    expect(parseMoneyTransferRules(rulesPayload)).toEqual({
      min_amount: 1,
      max_message_length: 2000,
      max_transfers_per_hour: 5,
      min_account_age_days: 14,
      sender_eligible_at: null,
      sender_eligible: true,
      server_now: '2026-07-20T10:00:00.000Z',
    });
  });

  it.each([
    ['a null payload', null],
    ['a string minimum', { ...rulesPayload, min_amount: '1' }],
    ['a missing eligibility flag', { ...rulesPayload, sender_eligible: undefined }],
    ['a numeric eligibility date', { ...rulesPayload, sender_eligible_at: 123 }],
  ])('rejects %s', (_label, payload) => {
    expect(() => parseMoneyTransferRules(payload)).toThrow('Serwer zwrócił nieprawidłowe zasady transferów');
  });
});

describe('parseMoneyTransferResult', () => {
  it('accepts the transfer receipt and rejects a malformed one', () => {
    const receipt = {
      id: 'transfer-1',
      amount: 25.5,
      recipient_username: 'Odbiorca',
      balance_after: 100,
      created_at: '2026-07-20T10:00:00.000Z',
    };
    expect(parseMoneyTransferResult(receipt)).toEqual(receipt);
    expect(() => parseMoneyTransferResult({ ...receipt, balance_after: '100' })).toThrow(
      'Serwer zwrócił nieprawidłowy wynik transferu',
    );
  });
});

describe('parseMoneyTransferHistory', () => {
  const row = {
    id: 'transfer-2',
    direction: 'received',
    counterparty_id: 'user-2',
    counterparty_username: 'Ala',
    counterparty_avatar_url: null,
    counterparty_deleted: false,
    amount: 12,
    message: null,
    created_at: '2026-07-20T10:00:00.000Z',
  };

  it('maps rows and treats null as no history', () => {
    expect(parseMoneyTransferHistory([row])).toEqual([row]);
    expect(parseMoneyTransferHistory(null)).toEqual([]);
  });

  it('rejects an unknown direction', () => {
    expect(() => parseMoneyTransferHistory([{ ...row, direction: 'refund' }])).toThrow(
      'Serwer zwrócił nieprawidłową historię transferów',
    );
  });
});
