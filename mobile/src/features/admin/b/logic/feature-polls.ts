import type { Database } from '@/lib/database.types';
import { toInputDateTime } from '@/lib/date-input';

/**
 * Admin subset of the web `features/feature-polls` logic
 * (`poll-availability.ts`, `constants.ts`, `types.ts`, `feature-poll-api.ts` normalizers).
 */

type PublicSchema = Database['public'];

export type FeaturePollInsert = PublicSchema['Tables']['feature_polls']['Insert'];
export type FeaturePollAdminStatus = 'active' | 'expired' | 'disabled';

export type FeaturePollForm = {
  title: string;
  titleEnabled: boolean;
  description: string;
  descriptionEnabled: boolean;
  question: string;
  questionEnabled: boolean;
  options: string[];
  allowOther: boolean;
  expiresAt: string;
};

export type AdminFeaturePollOption = {
  id: string;
  label: string;
  sort_order: number;
  vote_count: number;
};

type AdminFeaturePollRow = PublicSchema['Functions']['admin_get_feature_polls']['Returns'][number];

export type AdminFeaturePoll = Omit<AdminFeaturePollRow, 'options' | 'other_responses'> & {
  options: AdminFeaturePollOption[];
  other_responses: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const getFeaturePollAdminStatus = (
  poll: { is_active: boolean; expires_at: string },
  now: Date = new Date(),
): FeaturePollAdminStatus => {
  if (!poll.is_active) return 'disabled';
  const expiresAt = new Date(poll.expires_at);
  if (Number.isNaN(expiresAt.getTime())) return 'disabled';
  if (now >= expiresAt) return 'expired';
  return 'active';
};

export const validateFeaturePollForm = (
  { title, titleEnabled, description, descriptionEnabled, question, options, expiresAt }: FeaturePollForm,
  now: Date = new Date(),
): string | null => {
  if (titleEnabled && !title.trim()) return 'Nagłówek jest wymagany';
  if (descriptionEnabled && !description.trim()) return 'Opis jest wymagany';
  if (!question.trim()) return 'Pytanie jest wymagane';

  const trimmedOptions = options.map((option) => option.trim());
  if (trimmedOptions.length < 2) return 'Dodaj co najmniej dwie opcje odpowiedzi';
  if (trimmedOptions.some((option) => !option)) return 'Opcje odpowiedzi nie mogą być puste';

  const endDate = new Date(expiresAt);
  if (Number.isNaN(endDate.getTime())) return 'Podaj poprawną datę zakończenia';
  if (endDate <= now) return 'Data zakończenia musi być późniejsza niż teraz';
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
}: FeaturePollForm): { poll: FeaturePollInsert; options: string[] } => ({
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

export const createDefaultFeaturePollForm = (now: Date = new Date()): FeaturePollForm => {
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

export const getPercentage = (count: number, total: number): number =>
  total > 0 ? Math.round((count / total) * 100) : 0;

const toAdminOption = (value: unknown): AdminFeaturePollOption | null => {
  if (!isRecord(value)) return null;
  const { id, label, sort_order: sortOrder, vote_count: voteCount } = value;
  if (
    typeof id !== 'string' ||
    typeof label !== 'string' ||
    typeof sortOrder !== 'number' ||
    typeof voteCount !== 'number'
  ) {
    return null;
  }
  return { id, label, sort_order: sortOrder, vote_count: voteCount };
};

export const normalizeAdminPoll = (poll: AdminFeaturePollRow): AdminFeaturePoll => ({
  ...poll,
  options: Array.isArray(poll.options)
    ? poll.options.map(toAdminOption).filter((option): option is AdminFeaturePollOption => option !== null)
    : [],
  other_responses: Array.isArray(poll.other_responses)
    ? poll.other_responses.filter((response): response is string => typeof response === 'string')
    : [],
});
