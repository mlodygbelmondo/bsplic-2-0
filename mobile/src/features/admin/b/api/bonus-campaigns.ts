import { queryOptions } from '@tanstack/react-query';

import { PAGE_DATA_QUERY_OPTIONS } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';
import {
  sortNewestFirst,
  toBonusCampaignInsert,
  toCampaignWithClaimCount,
  type BonusCampaignAdminRow,
  type BonusCampaignForm,
  type BonusCampaignWithClaimCount,
} from '../logic/bonus-campaigns';

/** Admin calls of the web `features/bonus-campaigns/bonus-campaign-api.ts`. */

export const ADMIN_BONUS_CAMPAIGNS_QUERY_KEY = ['admin', 'bonus-campaigns'] as const;

async function fetchAdminBonusCampaigns(): Promise<BonusCampaignWithClaimCount[]> {
  const { data, error } = await supabase
    .from('bonus_campaigns')
    .select('*, bonus_campaign_claims(count)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return sortNewestFirst(
    ((data ?? []) as BonusCampaignAdminRow[]).map(toCampaignWithClaimCount),
  );
}

export const adminBonusCampaignsQueryOptions = () =>
  queryOptions({
    queryKey: ADMIN_BONUS_CAMPAIGNS_QUERY_KEY,
    queryFn: fetchAdminBonusCampaigns,
    ...PAGE_DATA_QUERY_OPTIONS,
  });

export async function createBonusCampaign(form: BonusCampaignForm): Promise<void> {
  const { error } = await supabase.from('bonus_campaigns').insert(toBonusCampaignInsert(form));
  if (error) throw error;
}

export async function deactivateBonusCampaign(campaignId: string): Promise<void> {
  const { error } = await supabase
    .from('bonus_campaigns')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', campaignId);
  if (error) throw error;
}
