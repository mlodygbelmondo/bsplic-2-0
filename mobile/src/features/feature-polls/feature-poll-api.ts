import { queryOptions } from '@tanstack/react-query';

import type { Database } from '@/lib/database.types';
import { PAGE_DATA_QUERY_OPTIONS } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';
import { toFeaturePollInsert } from './poll-availability';
import type {
  AdminFeaturePoll,
  AdminFeaturePollOption,
  AvailableFeaturePoll,
  FeaturePollForm,
  FeaturePollOption,
  FeaturePollVotePayload,
  FeaturePollVoteResult,
} from './types';
import { isRecord } from './types';

const toFeaturePollOption = (value: unknown): FeaturePollOption | null => {
  if (!isRecord(value)) {
    return null;
  }

  const { id, label, sort_order: sortOrder } = value;
  if (
    typeof id !== 'string' ||
    typeof label !== 'string' ||
    typeof sortOrder !== 'number'
  ) {
    return null;
  }

  return { id, label, sort_order: sortOrder };
};

const toAdminFeaturePollOption = (
  value: unknown,
): AdminFeaturePollOption | null => {
  const option = toFeaturePollOption(value);
  if (!option || !isRecord(value) || typeof value.vote_count !== 'number') {
    return null;
  }

  return { ...option, vote_count: value.vote_count };
};

const normalizeOptions = <T>(
  value: unknown,
  normalize: (item: unknown) => T | null,
): T[] => (Array.isArray(value) ? value.map(normalize).filter(Boolean) : []) as T[];

type Functions = Database['public']['Functions'];
type AvailablePollRow = Functions['get_available_feature_poll']['Returns'][number];
type AdminPollRow = Functions['admin_get_feature_polls']['Returns'][number];

const normalizeAvailablePoll = (
  poll: AvailablePollRow,
): AvailableFeaturePoll => ({
  ...poll,
  options: normalizeOptions(poll.options, toFeaturePollOption),
});

const normalizeAdminPoll = (
  poll: AdminPollRow,
): AdminFeaturePoll => ({
  ...poll,
  options: normalizeOptions(poll.options, toAdminFeaturePollOption),
  other_responses: Array.isArray(poll.other_responses)
    ? poll.other_responses.filter(
        (response): response is string => typeof response === 'string',
      )
    : [],
});

export const fetchAvailableFeaturePoll =
  async (): Promise<AvailableFeaturePoll | null> => {
    const { data, error } = await supabase.rpc('get_available_feature_poll');

    if (error) {
      throw error;
    }

    const poll = Array.isArray(data) ? data[0] : null;
    return poll ? normalizeAvailablePoll(poll) : null;
  };

export const submitFeaturePollVote = async ({
  pollId,
  optionId,
  otherText,
}: FeaturePollVotePayload): Promise<FeaturePollVoteResult> => {
  const { data, error } = await supabase.rpc('submit_feature_poll_vote', {
    p_poll_id: pollId,
    p_option_id: optionId,
    p_other_text: otherText,
  });

  if (error) {
    throw error;
  }

  const result = Array.isArray(data) ? data[0] : data;
  if (!result) {
    throw new Error('Nie udało się zapisać głosu');
  }

  return result;
};

export const fetchAdminFeaturePolls = async (): Promise<AdminFeaturePoll[]> => {
  const { data, error } = await supabase.rpc('admin_get_feature_polls');

  if (error) {
    throw error;
  }

  return (data ?? []).map(normalizeAdminPoll);
};

export const createFeaturePoll = async (
  form: FeaturePollForm,
): Promise<void> => {
  const { poll, options } = toFeaturePollInsert(form);

  const { data: pollRow, error: pollError } = await supabase
    .from('feature_polls')
    .insert(poll)
    .select('id')
    .single();

  if (pollError) {
    throw pollError;
  }

  const pollId = pollRow?.id;
  if (!pollId) {
    throw new Error('Nie udało się utworzyć głosowania');
  }

  const { error: optionsError } = await supabase
    .from('feature_poll_options')
    .insert(
      options.map((label, index) => ({
        poll_id: pollId,
        label,
        sort_order: index,
      })),
    );

  if (optionsError) {
    await supabase.from('feature_polls').delete().eq('id', pollId);
    throw optionsError;
  }
};

export const deactivateFeaturePoll = async (
  pollId: string,
): Promise<void> => {
  const { error } = await supabase
    .from('feature_polls')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', pollId);

  if (error) {
    throw error;
  }
};

/**
 * The poll the signed-in user still has to answer. Refetched on every mount
 * and app foreground; the surface ignores data restored from the persisted
 * cache until a fresh fetch lands (an answered poll must never reopen).
 */
export const featurePollQueries = {
  available: (userId: string) =>
    queryOptions({
      queryKey: ['feature-polls', userId, 'available'] as const,
      queryFn: fetchAvailableFeaturePoll,
      ...PAGE_DATA_QUERY_OPTIONS,
      staleTime: 0,
      retry: false,
      refetchOnWindowFocus: true,
    }),
};
