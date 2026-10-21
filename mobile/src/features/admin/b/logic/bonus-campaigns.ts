import type { Database } from '@/lib/database.types';
import { getTodayAt2359, toInputDateTime } from '@/lib/date-input';

/**
 * Admin subset of the web `features/bonus-campaigns` logic
 * (`campaign-availability.ts`, `constants.ts`, `types.ts`).
 */

type Tables = Database['public']['Tables'];

export type BonusCampaign = Tables['bonus_campaigns']['Row'];
export type BonusCampaignInsert = Tables['bonus_campaigns']['Insert'];
export type BonusCampaignWithClaimCount = BonusCampaign & { claim_count: number };

export type BonusCampaignForm = {
  title: string;
  description: string;
  amount: string;
  startsAt: string;
  expiresAt: string;
};

export type BonusCampaignAdminStatus = 'scheduled' | 'active' | 'expired' | 'disabled';

type CampaignWindowInput = {
  is_active: boolean;
  starts_at: string;
  expires_at: string;
};

const parseTimestamp = (value: string): Date | null => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const getBonusCampaignAdminStatus = (
  campaign: CampaignWindowInput,
  now: Date = new Date(),
): BonusCampaignAdminStatus => {
  if (!campaign.is_active) return 'disabled';

  const startsAt = parseTimestamp(campaign.starts_at);
  const expiresAt = parseTimestamp(campaign.expires_at);
  if (!startsAt || !expiresAt) return 'disabled';
  if (now < startsAt) return 'scheduled';
  if (now >= expiresAt) return 'expired';
  return 'active';
};

export const formatBonusAmount = (amount: number): string =>
  `${Number(amount).toLocaleString('pl-PL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} zł`;

export const validateBonusCampaignForm = ({
  title,
  description,
  amount,
  startsAt,
  expiresAt,
}: BonusCampaignForm): string | null => {
  if (!title.trim()) return 'Tytuł kampanii jest wymagany';
  if (!description.trim()) return 'Opis kampanii jest wymagany';

  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return 'Kwota musi być większa od zera';
  }

  const startDate = startsAt ? new Date(startsAt) : new Date();
  const endDate = new Date(expiresAt);
  if ((startsAt && Number.isNaN(startDate.getTime())) || Number.isNaN(endDate.getTime())) {
    return 'Podaj poprawne daty kampanii';
  }
  if (endDate <= startDate) {
    return 'Data wygaśnięcia musi być późniejsza niż data startu';
  }
  return null;
};

export const toBonusCampaignInsert = ({
  title,
  description,
  amount,
  startsAt,
  expiresAt,
}: BonusCampaignForm): BonusCampaignInsert => ({
  title: title.trim(),
  description: description.trim(),
  amount: Number(amount),
  starts_at: startsAt ? new Date(startsAt).toISOString() : new Date().toISOString(),
  expires_at: new Date(expiresAt).toISOString(),
  is_active: true,
});

export const createDefaultBonusCampaignForm = (now: Date = new Date()): BonusCampaignForm => ({
  title: '',
  description: '',
  amount: '',
  startsAt: toInputDateTime(now),
  expiresAt: toInputDateTime(getTodayAt2359(now)),
});

export type BonusCampaignAdminRow = BonusCampaign & {
  bonus_campaign_claims?: { count: number }[] | null;
};

export const toCampaignWithClaimCount = (
  row: BonusCampaignAdminRow,
): BonusCampaignWithClaimCount => {
  const { bonus_campaign_claims: claimRows, ...campaign } = row;
  return {
    ...campaign,
    claim_count: Array.isArray(claimRows) ? (claimRows[0]?.count ?? 0) : 0,
  };
};

export const sortNewestFirst = <T extends { created_at: string }>(rows: T[]): T[] =>
  [...rows].sort(
    (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
  );
