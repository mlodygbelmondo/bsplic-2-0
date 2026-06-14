import { describe, expect, it, vi } from 'vitest';

import { createDefaultFeaturePollForm } from './constants';

describe('createDefaultFeaturePollForm', () => {
  it('defaults to editable copy, two blank options, and a one-week end date', () => {
    vi.setSystemTime(new Date(2030, 5, 14, 10, 30));

    expect(createDefaultFeaturePollForm()).toEqual({
      title: 'Głosowanie',
      titleEnabled: true,
      description: 'Odpowiedz na jedno pytanie, żeby kontynuować.',
      descriptionEnabled: true,
      question: '',
      questionEnabled: true,
      options: ['', ''],
      allowOther: true,
      expiresAt: '2030-06-21T10:30',
    });

    vi.useRealTimers();
  });
});
