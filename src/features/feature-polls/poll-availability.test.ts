import { describe, expect, it } from 'vitest';

import {
  getFeaturePollAdminStatus,
  pickFirstAvailableFeaturePoll,
  toFeaturePollInsert,
  validateFeaturePollForm,
} from './poll-availability';

const basePoll = {
  is_active: true,
  expires_at: '2030-01-02T10:00:00.000Z',
};

describe('feature poll availability', () => {
  it('returns active, expired, and disabled statuses without a start date', () => {
    expect(
      getFeaturePollAdminStatus(
        basePoll,
        new Date('2030-01-01T12:00:00.000Z'),
      ),
    ).toBe('active');
    expect(
      getFeaturePollAdminStatus(
        basePoll,
        new Date('2030-01-02T10:00:00.000Z'),
      ),
    ).toBe('expired');
    expect(
      getFeaturePollAdminStatus(
        { ...basePoll, is_active: false },
        new Date('2030-01-01T12:00:00.000Z'),
      ),
    ).toBe('disabled');
  });

  it('picks the first available poll only', () => {
    expect(pickFirstAvailableFeaturePoll([])).toBeNull();
    expect(
      pickFirstAvailableFeaturePoll([{ id: 'poll-1' }, { id: 'poll-2' }])?.id,
    ).toBe('poll-1');
  });

  it('validates admin poll forms', () => {
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

    expect(validateFeaturePollForm({ ...validForm, title: '' })).toBe(
      'Nagłówek jest wymagany',
    );
    expect(
      validateFeaturePollForm({
        ...validForm,
        title: '',
        titleEnabled: false,
      }),
    ).toBeNull();
    expect(validateFeaturePollForm({ ...validForm, description: '' })).toBe(
      'Opis jest wymagany',
    );
    expect(validateFeaturePollForm({ ...validForm, question: '' })).toBe(
      'Pytanie jest wymagane',
    );
    expect(validateFeaturePollForm({ ...validForm, options: ['Jedna'] })).toBe(
      'Dodaj co najmniej dwie opcje odpowiedzi',
    );
    expect(
      validateFeaturePollForm({ ...validForm, options: ['Jedna', '  '] }),
    ).toBe('Opcje odpowiedzi nie mogą być puste');
    expect(
      validateFeaturePollForm({
        ...validForm,
        expiresAt: 'not-a-date',
      }),
    ).toBe('Podaj poprawną datę zakończenia');
    expect(validateFeaturePollForm(validForm)).toBeNull();
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
