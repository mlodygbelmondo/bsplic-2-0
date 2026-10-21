import { describe, expect, it } from 'vitest';

import { getSenderEligibility, getTransferValidationError, messageLengthOf, type TransferDraft } from './send-rules';
import type { MoneyTransferRules } from './types';

const eligibleRules: MoneyTransferRules = {
  min_amount: 1,
  max_message_length: 2000,
  max_transfers_per_hour: 5,
  min_account_age_days: 14,
  sender_eligible_at: '2025-01-15T00:00:00.000Z',
  sender_eligible: true,
  server_now: '2026-07-20T10:00:00.000Z',
};

const validDraft: TransferDraft = {
  rules: eligibleRules,
  rulesFailed: false,
  hasRecipient: true,
  amount: 25.5,
  balance: 125.5,
  messageLength: 7,
  tooNew: false,
};

describe('getTransferValidationError', () => {
  it('passes a complete draft', () => {
    expect(getTransferValidationError(validDraft)).toBeNull();
  });

  it('blocks until the authoritative rules load, with a retry hint after a failure', () => {
    expect(getTransferValidationError({ ...validDraft, rules: null })).toBe('Poczekaj na pobranie zasad transferów');
    expect(getTransferValidationError({ ...validDraft, rules: null, rulesFailed: true })).toBe(
      'Najpierw ponów pobieranie zasad transferów',
    );
  });

  it('requires a recipient picked from search', () => {
    expect(getTransferValidationError({ ...validDraft, hasRecipient: false })).toBe('Wybierz odbiorcę');
  });

  it('enforces the server minimum amount', () => {
    const rules = { ...eligibleRules, min_amount: 5 };
    expect(getTransferValidationError({ ...validDraft, rules, amount: 4.99 })).toBe('Wpisz kwotę co najmniej 5,00 zł');
    expect(getTransferValidationError({ ...validDraft, amount: null })).toBe('Wpisz kwotę co najmniej 1,00 zł');
  });

  it('rejects amounts above the balance but allows sending all of it', () => {
    expect(getTransferValidationError({ ...validDraft, amount: 125.51 })).toBe('Niewystarczające saldo');
    expect(getTransferValidationError({ ...validDraft, amount: 125.5 })).toBeNull();
  });

  it('limits the message to the server length', () => {
    const rules = { ...eligibleRules, max_message_length: 10 };
    expect(getTransferValidationError({ ...validDraft, rules, messageLength: 11 })).toBe(
      'Wiadomość może mieć maksymalnie 10 znaków',
    );
  });

  it('blocks accounts younger than the minimum age', () => {
    expect(getTransferValidationError({ ...validDraft, tooNew: true })).toBe(
      'Konto nadawcy musi istnieć od co najmniej 14 dni',
    );
  });

  it('reports the first failing rule only', () => {
    expect(getTransferValidationError({ ...validDraft, hasRecipient: false, amount: null, tooNew: true })).toBe(
      'Wybierz odbiorcę',
    );
  });
});

describe('getSenderEligibility', () => {
  const now = Date.parse('2026-07-20T10:00:00.000Z');

  it('trusts the server flag once rules load', () => {
    expect(getSenderEligibility(eligibleRules, '2026-07-19T00:00:00.000Z', now)).toEqual({
      eligibleAt: Date.parse('2025-01-15T00:00:00.000Z'),
      tooNew: false,
      refetchRulesInMs: null,
    });
  });

  it('schedules a rules refetch just after the server eligibility time', () => {
    const rules = {
      ...eligibleRules,
      sender_eligible: false,
      sender_eligible_at: '2026-07-20T10:00:00.100Z',
      server_now: '2026-07-20T10:00:00.000Z',
    };
    expect(getSenderEligibility(rules, '2026-07-06T10:00:00.100Z', now)).toEqual({
      eligibleAt: Date.parse('2026-07-20T10:00:00.100Z'),
      tooNew: true,
      refetchRulesInMs: 150,
    });
  });

  it('refetches immediately when the server says the time already passed', () => {
    const rules = {
      ...eligibleRules,
      sender_eligible: false,
      sender_eligible_at: '2026-07-20T09:00:00.000Z',
    };
    expect(getSenderEligibility(rules, '2026-07-06T09:00:00.000Z', now).refetchRulesInMs).toBe(50);
  });

  it('estimates fourteen days from account creation before rules load', () => {
    expect(getSenderEligibility(null, '2026-07-10T10:00:00.000Z', now)).toEqual({
      eligibleAt: Date.parse('2026-07-24T10:00:00.000Z'),
      tooNew: true,
      refetchRulesInMs: null,
    });
    expect(getSenderEligibility(null, '2026-07-01T10:00:00.000Z', now).tooNew).toBe(false);
  });
});

describe('messageLengthOf', () => {
  it('counts code points, so an emoji is one character', () => {
    expect(messageLengthOf('Dzięki 👍')).toBe(8);
  });
});
