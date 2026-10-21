import { queryOptions } from '@tanstack/react-query';

import { PAGE_DATA_QUERY_OPTIONS } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';
import { sortNewestFirst } from '../logic/bonus-campaigns';
import {
  normalizeAdminPoll,
  toFeaturePollInsert,
  type AdminFeaturePoll,
  type FeaturePollForm,
} from '../logic/feature-polls';

/** Admin calls of the web `features/feature-polls/feature-poll-api.ts`. */

export const ADMIN_FEATURE_POLLS_QUERY_KEY = ['admin', 'feature-polls'] as const;

async function fetchAdminFeaturePolls(): Promise<AdminFeaturePoll[]> {
  const { data, error } = await supabase.rpc('admin_get_feature_polls');
  if (error) throw error;
  return sortNewestFirst((data ?? []).map(normalizeAdminPoll));
}

export const adminFeaturePollsQueryOptions = () =>
  queryOptions({
    queryKey: ADMIN_FEATURE_POLLS_QUERY_KEY,
    queryFn: fetchAdminFeaturePolls,
    ...PAGE_DATA_QUERY_OPTIONS,
  });

export async function createFeaturePoll(form: FeaturePollForm): Promise<void> {
  const { poll, options } = toFeaturePollInsert(form);

  const { data: pollRow, error: pollError } = await supabase
    .from('feature_polls')
    .insert(poll)
    .select('id')
    .single();
  if (pollError) throw pollError;

  const pollId = pollRow?.id;
  if (!pollId) throw new Error('Nie udało się utworzyć głosowania');

  const { error: optionsError } = await supabase.from('feature_poll_options').insert(
    options.map((label, index) => ({ poll_id: pollId, label, sort_order: index })),
  );
  if (optionsError) {
    await supabase.from('feature_polls').delete().eq('id', pollId);
    throw optionsError;
  }
}

export async function deactivateFeaturePoll(pollId: string): Promise<void> {
  const { error } = await supabase
    .from('feature_polls')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', pollId);
  if (error) throw error;
}
