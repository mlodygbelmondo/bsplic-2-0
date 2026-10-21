import { queryOptions } from '@tanstack/react-query';

import { PAGE_DATA_QUERY_OPTIONS } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';
import {
  normalizeProposalRow,
  type AcceptProposalParams,
  type ProposalRow,
} from '../logic/proposal-review';

export const ADMIN_PROPOSALS_QUERY_KEY = ['admin', 'proposals'] as const;

async function fetchPendingProposals(): Promise<ProposalRow[]> {
  const { data, error } = await supabase
    .from('bet_proposals')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;

  const rows = data ?? [];
  const userIds = [...new Set(rows.map((row) => row.user_id))];
  const usernames = new Map<string, string>();
  if (userIds.length > 0) {
    // The web ignores profile lookup failures and falls back to "Użytkownik".
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', userIds);
    (profiles ?? []).forEach((profile) => usernames.set(profile.id, profile.username));
  }

  return rows.map((row) => normalizeProposalRow(row, usernames.get(row.user_id)));
}

export const adminProposalsQueryOptions = () =>
  queryOptions({
    queryKey: ADMIN_PROPOSALS_QUERY_KEY,
    queryFn: fetchPendingProposals,
    ...PAGE_DATA_QUERY_OPTIONS,
  });

export async function acceptProposal(params: AcceptProposalParams): Promise<void> {
  const { error } = await supabase.rpc('review_bet_proposal', params);
  if (error) throw error;
}

export async function rejectProposal(proposalId: string): Promise<void> {
  const { error } = await supabase.rpc('review_bet_proposal', {
    p_proposal_id: proposalId,
    p_status: 'rejected',
  });
  if (error) throw error;
}
