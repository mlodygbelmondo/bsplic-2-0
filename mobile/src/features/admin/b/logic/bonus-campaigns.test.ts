import { describe, expect, it } from 'vitest';

import {
  createDefaultBonusCampaignForm,
  getBonusCampaignAdminStatus,
  sortNewestFirst,
  toCampaignWithClaimCount,
  validateBonusCampaignForm,
  type BonusCampaignAdminRow,
} from './bonus-campaigns';

// Ported from the web `campaign-availability.test.ts` and `constants.test.ts`.
const baseCampaign = {
  is_active: true,
  starts_at: '2030-01-01T10:00:00.000Z',
  expires_at: '2030-01-02T10:00:00.000Z',
};

describe('campaign availability', () => {
  it('returns scheduled before start', () => {
    expect(getBonusCampaignAdminStatus(baseCampaign, new Date('2029-12-31T12:00:00.000Z'))).toBe(
      'scheduled',
    );
  });

  it('returns active inside claim window', () => {
    expect(getBonusCampaignAdminStatus(baseCampaign, new Date('2030-01-01T12:00:00.000Z'))).toBe(
      'active',
    );
  });

  it('returns expired at expiration timestamp', () => {
    expect(getBonusCampaignAdminStatus(baseCampaign, new Date('2030-01-02T10:00:00.000Z'))).toBe(
      'expired',
    );
  });

  it('returns disabled when campaign is inactive', () => {
    expect(
      getBonusCampaignAdminStatus(
        { ...baseCampaign, is_active: false },
        new Date('2030-01-01T12:00:00.000Z'),
      ),
    ).toBe('disabled');
  });

  it('returns disabled for malformed dates', () => {
    expect(
      getBonusCampaignAdminStatus(
        { ...baseCampaign, starts_at: 'invalid-date' },
        new Date('2030-01-01T12:00:00.000Z'),
      ),
    ).toBe('disabled');
  });

  it('validates admin form input', () => {
    const valid = {
      title: 'Bonus',
      description: 'Opis',
      amount: '100',
      startsAt: '2030-01-01T10:00',
      expiresAt: '2030-01-02T10:00',
    };
    expect(validateBonusCampaignForm({ ...valid, title: '' })).toBe('Tytuł kampanii jest wymagany');
    expect(validateBonusCampaignForm({ ...valid, description: ' ' })).toBe(
      'Opis kampanii jest wymagany',
    );
    expect(validateBonusCampaignForm({ ...valid, amount: '0' })).toBe(
      'Kwota musi być większa od zera',
    );
    expect(validateBonusCampaignForm({ ...valid, expiresAt: 'zła data' })).toBe(
      'Podaj poprawne daty kampanii',
    );
    expect(
      validateBonusCampaignForm({
        ...valid,
        startsAt: '2030-01-02T10:00',
        expiresAt: '2030-01-01T10:00',
      }),
    ).toBe('Data wygaśnięcia musi być późniejsza niż data startu');
    expect(validateBonusCampaignForm(valid)).toBeNull();
  });
});

describe('createDefaultBonusCampaignForm', () => {
  it('pre-fills start and current day expiration while leaving content fields empty', () => {
    expect(createDefaultBonusCampaignForm(new Date('2030-06-02T01:58:00'))).toEqual({
      title: '',
      description: '',
      amount: '',
      startsAt: '2030-06-02T01:58',
      expiresAt: '2030-06-02T23:59',
    });
  });
});

describe('admin campaign rows', () => {
  const row = (id: string, created_at: string, claims?: { count: number }[] | null): BonusCampaignAdminRow => ({
    id,
    created_at,
    title: id,
    description: 'Opis',
    amount: 50,
    starts_at: baseCampaign.starts_at,
    expires_at: baseCampaign.expires_at,
    is_active: true,
    updated_at: created_at,
    bonus_campaign_claims: claims,
  });

  it('flattens the embedded claim count, defaulting to zero', () => {
    expect(toCampaignWithClaimCount(row('a', '2030-01-01T00:00:00Z', [{ count: 7 }])).claim_count).toBe(7);
    expect(toCampaignWithClaimCount(row('b', '2030-01-01T00:00:00Z', null)).claim_count).toBe(0);
    expect(toCampaignWithClaimCount(row('c', '2030-01-01T00:00:00Z', []))).not.toHaveProperty(
      'bonus_campaign_claims',
    );
  });

  it('sorts newest first', () => {
    const sorted = sortNewestFirst([
      row('old', '2030-01-01T00:00:00Z'),
      row('new', '2030-03-01T00:00:00Z'),
      row('mid', '2030-02-01T00:00:00Z'),
    ]);
    expect(sorted.map((campaign) => campaign.id)).toEqual(['new', 'mid', 'old']);
  });
});
