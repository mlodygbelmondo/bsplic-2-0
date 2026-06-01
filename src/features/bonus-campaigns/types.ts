import type { Database } from '@/integrations/supabase/types';

type PublicSchema = Database['public'];

export type BonusCampaign = PublicSchema['Tables']['bonus_campaigns']['Row'];
export type BonusCampaignInsert =
  PublicSchema['Tables']['bonus_campaigns']['Insert'];

export type BonusCampaignWithClaimCount = BonusCampaign & {
  claim_count: number;
};

export type BonusCampaignForm = {
  title: string;
  description: string;
  amount: string;
  startsAt: string;
  expiresAt: string;
};

export type AvailableBonusCampaign =
  PublicSchema['Functions']['get_available_bonus_campaigns']['Returns'][number];

export type BonusCampaignClaimResult =
  PublicSchema['Functions']['claim_bonus_campaign']['Returns'][number];

export type BonusCampaignAdminStatus =
  | 'scheduled'
  | 'active'
  | 'expired'
  | 'disabled';
