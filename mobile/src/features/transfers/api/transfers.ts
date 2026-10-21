import { infiniteQueryOptions } from '@tanstack/react-query';

import { PAGE_DATA_QUERY_OPTIONS } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';
import { parseMoneyTransferHistory, parseMoneyTransferResult, parseMoneyTransferRules } from '../parsers';
import type {
  MoneyTransferHistoryEntry,
  MoneyTransferRecipient,
  MoneyTransferResult,
  MoneyTransferRules,
} from '../types';

export const HISTORY_PAGE_SIZE = 20;

export async function fetchMoneyTransferRules(): Promise<MoneyTransferRules> {
  const { data, error } = await supabase.rpc('get_money_transfer_rules');
  if (error) throw new Error(error.message);
  return parseMoneyTransferRules(data);
}

export async function searchMoneyTransferRecipients(query: string): Promise<MoneyTransferRecipient[]> {
  const { data, error } = await supabase.rpc('search_money_transfer_recipients', {
    p_query: query,
    p_limit: 8,
  });
  if (error) throw new Error(error.message);
  return data ?? [];
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
  limit = HISTORY_PAGE_SIZE,
  offset = 0,
): Promise<MoneyTransferHistoryEntry[]> {
  const { data, error } = await supabase.rpc('get_money_transfer_history', {
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw new Error(error.message);
  return parseMoneyTransferHistory(data);
}

/** Wallet history, 20 per page; "Pokaż starsze" appears while a page comes back full. */
export const moneyTransferHistoryQuery = () =>
  infiniteQueryOptions({
    queryKey: ['money-transfer-history'],
    queryFn: ({ pageParam }) => fetchMoneyTransferHistory(HISTORY_PAGE_SIZE, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) =>
      lastPage.length === HISTORY_PAGE_SIZE ? pages.reduce((count, page) => count + page.length, 0) : undefined,
    ...PAGE_DATA_QUERY_OPTIONS,
  });

/**
 * Preselects a recipient passed by id (e.g. from a public profile). Only an
 * account the transfer search returns is selectable, so agents, restricted
 * accounts and the caller stay excluded. Returns the username when the account
 * exists but is not a valid recipient, so the search field can explain it.
 */
export async function resolveTransferRecipient(
  userId: string,
): Promise<{ recipient: MoneyTransferRecipient | null; username: string | null }> {
  const { data, error } = await supabase.rpc('get_public_profile', { p_user_id: userId });
  if (error) throw new Error(error.message);
  const username =
    typeof data === 'object' && data !== null && !Array.isArray(data) && typeof data.username === 'string'
      ? data.username
      : null;
  if (!username) return { recipient: null, username: null };
  const matches = await searchMoneyTransferRecipients(username);
  return { recipient: matches.find((match) => match.id === userId) ?? null, username };
}
