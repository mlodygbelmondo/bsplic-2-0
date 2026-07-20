import type { Database, Json } from '@/integrations/supabase/types';

type PublicSchema = Database['public'];

export type FeaturePoll = PublicSchema['Tables']['feature_polls']['Row'];
export type FeaturePollInsert =
  PublicSchema['Tables']['feature_polls']['Insert'];
export type FeaturePollOptionInsert =
  PublicSchema['Tables']['feature_poll_options']['Insert'];

export type FeaturePollAdminStatus = 'active' | 'expired' | 'disabled';

export type FeaturePollForm = {
  title: string;
  titleEnabled: boolean;
  description: string;
  descriptionEnabled: boolean;
  question: string;
  questionEnabled: boolean;
  options: string[];
  allowOther: boolean;
  expiresAt: string;
};

export type FeaturePollOption = {
  id: string;
  label: string;
  sort_order: number;
};

export type AvailableFeaturePoll = Omit<
  PublicSchema['Functions']['get_available_feature_poll']['Returns'][number],
  'options'
> & {
  options: FeaturePollOption[];
};

export type FeaturePollVotePayload = {
  pollId: string;
  optionId: string | null;
  otherText: string | null;
};

export type FeaturePollVoteResult =
  PublicSchema['Functions']['submit_feature_poll_vote']['Returns'][number];

export type AdminFeaturePollOption = FeaturePollOption & {
  vote_count: number;
};

export type AdminFeaturePoll = Omit<
  PublicSchema['Functions']['admin_get_feature_polls']['Returns'][number],
  'options' | 'other_responses'
> & {
  options: AdminFeaturePollOption[];
  other_responses: string[];
};

export const isRecord = (value: Json | unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
