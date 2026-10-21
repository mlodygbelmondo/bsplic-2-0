import type {
  FeaturePollAdminStatus,
  FeaturePollForm,
  FeaturePollInsert,
} from './types';

type PollWindowInput = {
  is_active: boolean;
  starts_at?: string | null;
  expires_at: string;
};

export const parsePollTimestamp = (value: string): Date | null => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};

export const getFeaturePollAdminStatus = (
  poll: PollWindowInput,
  now: Date = new Date(),
): FeaturePollAdminStatus => {
  if (!poll.is_active) {
    return 'disabled';
  }

  const expiresAt = parsePollTimestamp(poll.expires_at);

  if (!expiresAt) {
    return 'disabled';
  }

  if (now >= expiresAt) {
    return 'expired';
  }

  return 'active';
};

export const pickFirstAvailableFeaturePoll = <T extends { id: string }>(
  polls: T[],
): T | null => (polls.length > 0 ? polls[0] : null);

export const validateFeaturePollForm = ({
  title,
  titleEnabled,
  description,
  descriptionEnabled,
  question,
  options,
  expiresAt,
}: FeaturePollForm): string | null => {
  if (titleEnabled && !title.trim()) {
    return 'Nagłówek jest wymagany';
  }

  if (descriptionEnabled && !description.trim()) {
    return 'Opis jest wymagany';
  }

  if (!question.trim()) {
    return 'Pytanie jest wymagane';
  }

  const trimmedOptions = options.map((option) => option.trim());
  if (trimmedOptions.length < 2) {
    return 'Dodaj co najmniej dwie opcje odpowiedzi';
  }

  if (trimmedOptions.some((option) => !option)) {
    return 'Opcje odpowiedzi nie mogą być puste';
  }

  const endDate = new Date(expiresAt);

  if (Number.isNaN(endDate.getTime())) {
    return 'Podaj poprawną datę zakończenia';
  }

  if (endDate <= new Date()) {
    return 'Data zakończenia musi być późniejsza niż teraz';
  }

  return null;
};

export const toFeaturePollInsert = ({
  title,
  titleEnabled,
  description,
  descriptionEnabled,
  question,
  questionEnabled,
  options,
  allowOther,
  expiresAt,
}: FeaturePollForm): {
  poll: FeaturePollInsert;
  options: string[];
} => ({
  poll: {
    title: title.trim(),
    title_enabled: titleEnabled,
    description: description.trim(),
    description_enabled: descriptionEnabled,
    question: question.trim(),
    question_enabled: questionEnabled,
    allow_other: allowOther,
    starts_at: null,
    expires_at: new Date(expiresAt).toISOString(),
    is_active: true,
  },
  options: options.map((option) => option.trim()),
});
