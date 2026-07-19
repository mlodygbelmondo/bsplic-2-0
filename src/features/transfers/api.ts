import { supabase } from '@/integrations/supabase/client';
import type {
  MoneyTransferHistoryEntry,
  MoneyTransferRecipient,
  MoneyTransferResult,
} from '@/features/transfers/types';

function parseMoneyTransferResult(value: unknown): MoneyTransferResult {
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

export async function searchMoneyTransferRecipients(
  query: string,
): Promise<MoneyTransferRecipient[]> {
  const { data, error } = await supabase.rpc('search_money_transfer_recipients', {
    p_query: query,
    p_limit: 8,
  });

  if (error) throw new Error(error.message);
  return (data ?? []) satisfies MoneyTransferRecipient[];
}

export async function createMoneyTransfer(input: {
  recipientId: string;
  amount: number;
  message: string;
  idempotencyKey: string;
}): Promise<MoneyTransferResult> {
  const { data, error } = await supabase.rpc('create_money_transfer', {
    p_recipient_id: input.recipientId,
    p_amount: input.amount,
    p_message: input.message,
    p_idempotency_key: input.idempotencyKey,
  });

  if (error) throw new Error(error.message);
  return parseMoneyTransferResult(data);
}

export async function fetchMoneyTransferHistory(
  limit = 20,
  offset = 0,
): Promise<MoneyTransferHistoryEntry[]> {
  const { data, error } = await supabase.rpc('get_money_transfer_history', {
    p_limit: limit,
    p_offset: offset,
  });

  if (error) throw new Error(error.message);
  return (data ?? []).map((entry): MoneyTransferHistoryEntry => {
    if (entry.direction !== 'sent' && entry.direction !== 'received') {
      throw new Error('Serwer zwrócił nieprawidłową historię transferów');
    }

    return {
      ...entry,
      direction: entry.direction,
    };
  });
}
