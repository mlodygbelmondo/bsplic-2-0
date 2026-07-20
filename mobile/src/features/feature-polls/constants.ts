import { toInputDateTime } from '@/lib/date-input';

export const createDefaultFeaturePollForm = (now: Date = new Date()) => {
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + 7);

  return {
    title: 'Głosowanie',
    titleEnabled: true,
    description: 'Odpowiedz na jedno pytanie, żeby kontynuować.',
    descriptionEnabled: true,
    question: '',
    questionEnabled: true,
    options: ['', ''],
    allowOther: true,
    expiresAt: toInputDateTime(expiresAt),
  };
};
