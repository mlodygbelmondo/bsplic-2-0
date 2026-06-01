import { describe, expect, it } from 'vitest';

import {
  getBonusCampaignAdminStatus,
  isBonusCampaignInClaimWindow,
  pickFirstAvailableBonusCampaign,
  validateBonusCampaignForm,
} from './campaign-availability';

const baseCampaign = {
  is_active: true,
  starts_at: '2030-01-01T10:00:00.000Z',
  expires_at: '2030-01-02T10:00:00.000Z',
};

describe('campaign availability', () => {
  it('returns scheduled before start', () => {
    const status = getBonusCampaignAdminStatus(baseCampaign, new Date('2029-12-31T12:00:00.000Z'));
    expect(status).toBe('scheduled');
  });

  it('returns active inside claim window', () => {
    const status = getBonusCampaignAdminStatus(baseCampaign, new Date('2030-01-01T12:00:00.000Z'));
    expect(status).toBe('active');
    expect(isBonusCampaignInClaimWindow(baseCampaign, new Date('2030-01-01T12:00:00.000Z'))).toBe(true);
  });

  it('returns expired at expiration timestamp', () => {
    const status = getBonusCampaignAdminStatus(baseCampaign, new Date('2030-01-02T10:00:00.000Z'));
    expect(status).toBe('expired');
    expect(isBonusCampaignInClaimWindow(baseCampaign, new Date('2030-01-02T10:00:00.000Z'))).toBe(false);
  });

  it('returns disabled when campaign is inactive', () => {
    const status = getBonusCampaignAdminStatus(
      { ...baseCampaign, is_active: false },
      new Date('2030-01-01T12:00:00.000Z'),
    );
    expect(status).toBe('disabled');
  });

  it('returns disabled for malformed dates', () => {
    const status = getBonusCampaignAdminStatus(
      { ...baseCampaign, starts_at: 'invalid-date' },
      new Date('2030-01-01T12:00:00.000Z'),
    );
    expect(status).toBe('disabled');
  });

  it('picks the first available campaign', () => {
    expect(pickFirstAvailableBonusCampaign([])).toBeNull();
    expect(pickFirstAvailableBonusCampaign([{ id: 'a' }, { id: 'b' }])?.id).toBe('a');
  });

  it('validates admin form input', () => {
    expect(
      validateBonusCampaignForm({
        title: '',
        description: 'Opis',
        amount: '100',
        startsAt: '2030-01-01T10:00',
        expiresAt: '2030-01-02T10:00',
      }),
    ).toBe('Tytuł kampanii jest wymagany');

    expect(
      validateBonusCampaignForm({
        title: 'Bonus',
        description: 'Opis',
        amount: '0',
        startsAt: '2030-01-01T10:00',
        expiresAt: '2030-01-02T10:00',
      }),
    ).toBe('Kwota musi być większa od zera');

    expect(
      validateBonusCampaignForm({
        title: 'Bonus',
        description: 'Opis',
        amount: '100',
        startsAt: '2030-01-02T10:00',
        expiresAt: '2030-01-01T10:00',
      }),
    ).toBe('Data wygaśnięcia musi być późniejsza niż data startu');

    expect(
      validateBonusCampaignForm({
        title: 'Bonus',
        description: 'Opis',
        amount: '100',
        startsAt: '2030-01-01T10:00',
        expiresAt: '2030-01-02T10:00',
      }),
    ).toBeNull();
  });
});
