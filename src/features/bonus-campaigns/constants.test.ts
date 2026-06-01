import { describe, expect, it } from 'vitest';

import { createDefaultBonusCampaignForm } from './constants';

describe('createDefaultBonusCampaignForm', () => {
  it('pre-fills start and current day expiration while leaving content fields empty', () => {
    expect(
      createDefaultBonusCampaignForm(new Date('2030-06-02T01:58:00')),
    ).toEqual({
      title: '',
      description: '',
      amount: '',
      startsAt: '2030-06-02T01:58',
      expiresAt: '2030-06-02T23:59',
    });
  });
});
