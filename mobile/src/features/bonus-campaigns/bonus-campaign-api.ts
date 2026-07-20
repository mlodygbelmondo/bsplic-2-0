import { supabase } from '@/integrations/supabase/client';
import { toBonusCampaignInsert } from './campaign-availability';
import type {
  AvailableBonusCampaign,
  BonusCampaignClaimResult,
  BonusCampaignForm,
  BonusCampaignWithClaimCount,
} from './types';

type BonusCampaignAdminRow = Omit<
  BonusCampaignWithClaimCount,
  'claim_count'
> & {
  bonus_campaign_claims?: Array<{ count: number }> | null;
};

const toCampaignWithClaimCount = (
  row: BonusCampaignAdminRow,
): BonusCampaignWithClaimCount => {
  const { bonus_campaign_claims: claimRows, ...campaign } = row;

  return {
    ...campaign,
    claim_count: Array.isArray(claimRows) ? (claimRows[0]?.count ?? 0) : 0,
  };
};

export const fetchAvailableBonusCampaigns = async (): Promise<
  AvailableBonusCampaign[]
> => {
  const { data, error } = await supabase.rpc('get_available_bonus_campaigns');

  if (error) {
    throw error;
  }

  return data ?? [];
};

export const fetchAdminBonusCampaigns = async (): Promise<
  BonusCampaignWithClaimCount[]
> => {
  const { data, error } = await supabase
    .from('bonus_campaigns')
    .select('*, bonus_campaign_claims(count)')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as BonusCampaignAdminRow[]).map(
    toCampaignWithClaimCount,
  );
};

export const createBonusCampaign = async (
  form: BonusCampaignForm,
): Promise<void> => {
  const { error } = await supabase
    .from('bonus_campaigns')
    .insert(toBonusCampaignInsert(form));

  if (error) {
    throw error;
  }
};

export const deactivateBonusCampaign = async (
  campaignId: string,
): Promise<void> => {
  const { error } = await supabase
    .from('bonus_campaigns')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', campaignId);

  if (error) {
    throw error;
  }
};

export const claimBonusCampaign = async (
  campaignId: string,
): Promise<BonusCampaignClaimResult> => {
  const { data, error } = await supabase.rpc('claim_bonus_campaign', {
    p_campaign_id: campaignId,
  });

  if (error) {
    throw error;
  }

  const result = Array.isArray(data) ? data[0] : data;

  if (!result) {
    throw new Error('Nie udało się odebrać bonusu');
  }

  return result;
};
