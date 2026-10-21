import type { MoneyTransferHistoryEntry, MoneyTransferResult, MoneyTransferRules } from './types';

/** Response validators ported from the web `transfers/api.ts`. */

export function parseMoneyTransferRules(value: unknown): MoneyTransferRules {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Serwer zwrócił nieprawidłowe zasady transferów');
  }

  const {
    min_amount,
    max_message_length,
    max_transfers_per_hour,
    min_account_age_days,
    sender_eligible_at,
    sender_eligible,
    server_now,
  } = value as Record<string, unknown>;

  if (
    typeof min_amount !== 'number' ||
    typeof max_message_length !== 'number' ||
    typeof max_transfers_per_hour !== 'number' ||
    typeof min_account_age_days !== 'number' ||
    typeof sender_eligible !== 'boolean' ||
    typeof server_now !== 'string'
  ) {
    throw new Error('Serwer zwrócił nieprawidłowe zasady transferów');
  }

  if (sender_eligible_at !== null && typeof sender_eligible_at !== 'string') {
    throw new Error('Serwer zwrócił nieprawidłowe zasady transferów');
  }

  return {
    min_amount,
    max_message_length,
    max_transfers_per_hour,
    min_account_age_days,
    sender_eligible_at: typeof sender_eligible_at === 'string' ? sender_eligible_at : null,
    sender_eligible,
    server_now,
  };
}

export function parseMoneyTransferResult(value: unknown): MoneyTransferResult {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('id' in value) ||
    typeof value.id !== 'string' ||
    !('amount' in value) ||
    typeof value.amount !== 'number' ||
    !('recipient_username' in value) ||
    typeof value.recipient_username !== 'string' ||
    !('balance_after' in value) ||
    typeof value.balance_after !== 'number' ||
    !('created_at' in value) ||
    typeof value.created_at !== 'string'
  ) {
    throw new Error('Serwer zwrócił nieprawidłowy wynik transferu');
  }

  return {
    id: value.id,
    amount: value.amount,
    recipient_username: value.recipient_username,
    balance_after: value.balance_after,
    created_at: value.created_at,
  };
}

type RawHistoryEntry = Omit<MoneyTransferHistoryEntry, 'direction'> & { direction: string };

export function parseMoneyTransferHistory(rows: readonly RawHistoryEntry[] | null): MoneyTransferHistoryEntry[] {
  return (rows ?? []).map((entry): MoneyTransferHistoryEntry => {
    if (entry.direction !== 'sent' && entry.direction !== 'received') {
      throw new Error('Serwer zwrócił nieprawidłową historię transferów');
    }
    return { ...entry, direction: entry.direction };
  });
}
