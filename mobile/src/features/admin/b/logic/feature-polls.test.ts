import { describe, expect, it } from 'vitest';

import {
  createDefaultFeaturePollForm,
  getFeaturePollAdminStatus,
  getPercentage,
  normalizeAdminPoll,
  toFeaturePollInsert,
  validateFeaturePollForm,
} from './feature-polls';

// Ported from the web `poll-availability.test.ts` and `constants.test.ts`.
// The web insert fixture assumes the app's home time zone.
process.env.TZ = 'Europe/Warsaw';

const basePoll = {
  is_active: true,
  expires_at: '2030-01-02T10:00:00.000Z',
};

const validForm = {
  title: 'Głosowanie',
  titleEnabled: true,
  description: 'Odpowiedz na jedno pytanie, żeby kontynuować.',
  descriptionEnabled: true,
  question: 'Co budujemy dalej?',
  questionEnabled: true,
  options: ['Liga mistrzów', 'Kasyno live'],
  allowOther: true,
  expiresAt: '2030-01-02T10:00',
};

describe('feature poll availability', () => {
  it('returns active, expired, and disabled statuses without a start date', () => {
    expect(getFeaturePollAdminStatus(basePoll, new Date('2030-01-01T12:00:00.000Z'))).toBe('active');
    expect(getFeaturePollAdminStatus(basePoll, new Date('2030-01-02T10:00:00.000Z'))).toBe('expired');
    expect(
      getFeaturePollAdminStatus({ ...basePoll, is_active: false }, new Date('2030-01-01T12:00:00.000Z')),
    ).toBe('disabled');
  });

  it('validates admin poll forms', () => {
    const now = new Date('2029-12-01T00:00:00.000Z');
    expect(validateFeaturePollForm({ ...validForm, title: '' }, now)).toBe('Nagłówek jest wymagany');
    expect(validateFeaturePollForm({ ...validForm, title: '', titleEnabled: false }, now)).toBeNull();
    expect(validateFeaturePollForm({ ...validForm, description: '' }, now)).toBe('Opis jest wymagany');
    expect(validateFeaturePollForm({ ...validForm, question: '' }, now)).toBe('Pytanie jest wymagane');
    expect(validateFeaturePollForm({ ...validForm, options: ['Jedna'] }, now)).toBe(
      'Dodaj co najmniej dwie opcje odpowiedzi',
    );
    expect(validateFeaturePollForm({ ...validForm, options: ['Jedna', '  '] }, now)).toBe(
      'Opcje odpowiedzi nie mogą być puste',
    );
    expect(validateFeaturePollForm({ ...validForm, expiresAt: 'not-a-date' }, now)).toBe(
      'Podaj poprawną datę zakończenia',
    );
    expect(validateFeaturePollForm(validForm, new Date('2030-01-03T00:00:00.000Z'))).toBe(
      'Data zakończenia musi być późniejsza niż teraz',
    );
    expect(validateFeaturePollForm(validForm, now)).toBeNull();
  });

  it('trims copy and options for inserts without a start date', () => {
    expect(
      toFeaturePollInsert({
        title: '  Ankieta  ',
        titleEnabled: true,
        description: '  Jedno pytanie  ',
        descriptionEnabled: false,
        question: '  Co dalej?  ',
        questionEnabled: true,
        options: ['  Social  ', ' Kasyno '],
        allowOther: false,
        expiresAt: '2030-01-02T10:00',
      }),
    ).toEqual({
      poll: {
        title: 'Ankieta',
        title_enabled: true,
        description: 'Jedno pytanie',
        description_enabled: false,
        question: 'Co dalej?',
        question_enabled: true,
        allow_other: false,
        starts_at: null,
        expires_at: '2030-01-02T09:00:00.000Z',
        is_active: true,
      },
      options: ['Social', 'Kasyno'],
    });
  });
});

describe('createDefaultFeaturePollForm', () => {
  it('defaults to editable copy, two blank options, and a one-week end date', () => {
    expect(createDefaultFeaturePollForm(new Date(2030, 5, 14, 10, 30))).toEqual({
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
  });
});

describe('admin poll results', () => {
  it('rounds vote percentages and handles polls without votes', () => {
    expect(getPercentage(1, 3)).toBe(33);
    expect(getPercentage(2, 3)).toBe(67);
    expect(getPercentage(0, 0)).toBe(0);
  });

  it('drops malformed options and non-string other responses', () => {
    const poll = normalizeAdminPoll({
      allow_other: true,
      created_at: '2030-01-01T00:00:00Z',
      description: '',
      description_enabled: false,
      expires_at: '2030-01-02T00:00:00Z',
      id: 'poll-1',
      is_active: true,
      options: [
        { id: 'o1', label: 'Social', sort_order: 0, vote_count: 3 },
        { id: 'o2', label: 'Kasyno', sort_order: 1 },
        'garbage',
      ],
      other_responses: ['Turnieje', 4, null],
      question: 'Co dalej?',
      question_enabled: true,
      starts_at: null,
      title: 'Głosowanie',
      title_enabled: true,
      total_votes: 3,
      updated_at: '2030-01-01T00:00:00Z',
    });
    expect(poll.options).toEqual([{ id: 'o1', label: 'Social', sort_order: 0, vote_count: 3 }]);
    expect(poll.other_responses).toEqual(['Turnieje']);
  });
});
