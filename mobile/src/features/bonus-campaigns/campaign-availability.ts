import type {
  BonusCampaignAdminStatus,
  BonusCampaignForm,
  BonusCampaignInsert,
} from './types';

type CampaignWindowInput = {
  is_active: boolean;
  starts_at: string;
  expires_at: string;
};

export const parseCampaignTimestamp = (value: string): Date | null => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};

export const getBonusCampaignAdminStatus = (
  campaign: CampaignWindowInput,
  now: Date = new Date(),
): BonusCampaignAdminStatus => {
  if (!campaign.is_active) {
    return 'disabled';
  }

  const startsAt = parseCampaignTimestamp(campaign.starts_at);
  const expiresAt = parseCampaignTimestamp(campaign.expires_at);

  if (!startsAt || !expiresAt) {
    return 'disabled';
  }

  if (now < startsAt) {
    return 'scheduled';
  }

  if (now >= expiresAt) {
    return 'expired';
  }

  return 'active';
};

export const isBonusCampaignInClaimWindow = (
  campaign: CampaignWindowInput,
  now: Date = new Date(),
): boolean => getBonusCampaignAdminStatus(campaign, now) === 'active';

export const pickFirstAvailableBonusCampaign = <T extends { id: string }>(
  campaigns: T[],
): T | null => (campaigns.length > 0 ? campaigns[0] : null);

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
  if (!title.trim()) {
    return 'Tytuł kampanii jest wymagany';
  }

  if (!description.trim()) {
    return 'Opis kampanii jest wymagany';
  }

  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return 'Kwota musi być większa od zera';
  }

  const startDate = startsAt ? new Date(startsAt) : new Date();
  const endDate = new Date(expiresAt);

  if (
    (startsAt && Number.isNaN(startDate.getTime())) ||
    Number.isNaN(endDate.getTime())
  ) {
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
  starts_at: startsAt
    ? new Date(startsAt).toISOString()
    : new Date().toISOString(),
  expires_at: new Date(expiresAt).toISOString(),
  is_active: true,
});
