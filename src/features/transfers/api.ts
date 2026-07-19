import { supabase } from '@/integrations/supabase/client';
import type {
  MoneyTransferHistoryEntry,
  MoneyTransferRecipient,
  MoneyTransferResult,
} from '@/features/transfers/types';

const rpc = supabase.rpc.bind(supabase) as (...args: unknown[]) => ReturnType<typeof supabase.rpc>;

export async function searchMoneyTransferRecipients(
  query: string,
): Promise<MoneyTransferRecipient[]> {
  const { data, error } = await rpc('search_money_transfer_recipients', {
    p_query: query,
    p_limit: 8,
  });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as MoneyTransferRecipient[];
}

export async function createMoneyTransfer(input: {
  recipientId: string;
  amount: number;
  message: string;
  idempotencyKey: string;
}): Promise<MoneyTransferResult> {
  const { data, error } = await rpc('create_money_transfer', {
    p_recipient_id: input.recipientId,
    p_amount: input.amount,
    p_message: input.message,
    p_idempotency_key: input.idempotencyKey,
  });

  if (error) throw new Error(error.message);
  return data as unknown as MoneyTransferResult;
}

export async function fetchMoneyTransferHistory(
  limit = 20,
  offset = 0,
): Promise<MoneyTransferHistoryEntry[]> {
  const { data, error } = await rpc('get_money_transfer_history', {
    p_limit: limit,
    p_offset: offset,
  });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as MoneyTransferHistoryEntry[];
}
