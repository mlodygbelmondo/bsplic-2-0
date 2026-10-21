import type { Bet } from '@/types/database';

import type {
  BetAkoExclusionDraft,
  CreateBetWithAkoExclusionsInput,
  UpdateBetWithAkoExclusionsInput,
} from './api/ako-exclusions';
import type { EditableBetType } from './constants';
import {
  getTomorrowAt2359,
  lockEditableOptionsByType,
  normalizeOptions,
  normalizeType,
  toEditableOptions,
  type EditableBetOption,
} from './helpers';

/** An option row with a stable key, so removing a middle row keeps focus and values aligned. */
export interface OptionDraft extends EditableBetOption {
  key: string;
}

export type FormResult<T> = { ok: true; value: T } | { ok: false; message: string };

let optionKeySeed = 0;
const nextOptionKey = () => {
  optionKeySeed += 1;
  return `option-${optionKeySeed}`;
};

/** Keeps each row's key by position (the option lockers are positional). */
export function withOptionKeys(
  options: EditableBetOption[],
  previous: OptionDraft[] = [],
): OptionDraft[] {
  return options.map((option, index) => ({
    name: option.name,
    odds: option.odds,
    key: (option as Partial<OptionDraft>).key ?? previous[index]?.key ?? nextOptionKey(),
  }));
}

export const newOptionDraft = (): OptionDraft => ({ name: '', odds: '2', key: nextOptionKey() });

/** Edit form type change: `lockEditableOptionsByType`, keeping row keys. */
export function relockEditorOptions(type: EditableBetType, current: OptionDraft[]): OptionDraft[] {
  return withOptionKeys(lockEditableOptionsByType(type, current), current);
}

const FIXED_DEFAULT_OPTIONS: Record<Exclude<EditableBetType, 'multi'>, EditableBetOption[]> = {
  single: [{ name: '1', odds: '2' }],
  '12': [
    { name: '1', odds: '2' },
    { name: '2', odds: '2' },
  ],
  '1x2': [
    { name: '1', odds: '2' },
    { name: 'X', odds: '3' },
    { name: '2', odds: '2' },
  ],
};

/**
 * Create form options for a bet type (web `CreateBetTab` type effect):
 * fixed types get their default rows; multi keeps two or more existing rows,
 * otherwise two blank rows.
 */
export function createFormOptions(type: EditableBetType, previous: OptionDraft[] = []): OptionDraft[] {
  if (type === 'multi') {
    return previous.length < 2 ? [newOptionDraft(), newOptionDraft()] : previous;
  }
  return withOptionKeys(FIXED_DEFAULT_OPTIONS[type], previous);
}

export const hasFixedOptionCount = (type: EditableBetType) => type !== 'multi';

/** `datetime-local` precision: the web input drops seconds. */
function toMinutePrecision(value: string | Date): Date {
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) date.setSeconds(0, 0);
  return date;
}

export const defaultEndsAt = () => getTomorrowAt2359();

export interface BetEditorDraft {
  id: string;
  title: string;
  categoryId: string;
  betType: EditableBetType;
  options: OptionDraft[];
  endsAt: Date;
  isLive: boolean;
  isBsplicboost: boolean;
  isActive: boolean;
  akoExclusions: BetAkoExclusionDraft[];
}

/** Web `openEditor` mapping. */
export function createBetEditor(bet: Bet): BetEditorDraft {
  const betType = normalizeType(bet.bet_type);
  return {
    id: bet.id,
    title: bet.title,
    categoryId: bet.category_id || '',
    betType,
    options: withOptionKeys(
      lockEditableOptionsByType(betType, toEditableOptions(normalizeOptions(bet.options))),
    ),
    endsAt: toMinutePrecision(bet.ends_at),
    isLive: Boolean(bet.is_live),
    isBsplicboost: Boolean(bet.is_bsplicboost),
    isActive: Boolean(bet.is_active),
    akoExclusions: [],
  };
}

function cleanOptions(options: OptionDraft[]) {
  return options.map((option) => ({
    name: option.name.trim(),
    // Polish keyboards type a decimal comma; the web number input normalises it the same way.
    oddsRaw: option.odds.trim().replace(',', '.'),
  }));
}

function findInvalidOddsIndex(options: { oddsRaw: string }[]) {
  return options.findIndex((option) => {
    if (!option.oddsRaw) return true;
    const odds = Number(option.oddsRaw);
    return !Number.isFinite(odds) || odds <= 0;
  });
}

const isValidDate = (date: Date) => !Number.isNaN(date.getTime());

/** Web `updateBet` checks, in the web order and copy. */
export function validateBetEditor(
  draft: BetEditorDraft,
  ako: { loading: boolean; failed: boolean },
): FormResult<UpdateBetWithAkoExclusionsInput> {
  if (ako.loading) return { ok: false, message: 'Poczekaj, aż wykluczenia AKO się wczytają' };
  if (ako.failed) return { ok: false, message: 'Wykluczenia AKO nie wczytały się poprawnie' };
  if (!draft.title.trim()) return { ok: false, message: 'Tytuł jest wymagany' };

  const cleanedOptions = cleanOptions(draft.options);
  if (cleanedOptions.some((option) => !option.name)) {
    return { ok: false, message: 'Uzupełnij etykiety wszystkich opcji' };
  }

  const invalidOddsIndex = findInvalidOddsIndex(cleanedOptions);
  if (invalidOddsIndex !== -1) {
    return { ok: false, message: `Podaj poprawny kurs dla opcji ${invalidOddsIndex + 1}` };
  }

  const minOptions = draft.betType === 'single' ? 1 : 2;
  if (cleanedOptions.length < minOptions) {
    return {
      ok: false,
      message: 'Zakład musi mieć minimum ' + minOptions + ' opcj' + (minOptions === 1 ? 'ę' : 'e'),
    };
  }

  if (!isValidDate(draft.endsAt)) {
    return { ok: false, message: 'Wybierz poprawną datę zakończenia' };
  }

  return {
    ok: true,
    value: {
      betId: draft.id,
      title: draft.title.trim(),
      categoryId: draft.categoryId || null,
      betType: draft.betType,
      options: cleanedOptions.map((option) => ({ name: option.name, odds: Number(option.oddsRaw) })),
      endsAt: draft.endsAt.toISOString(),
      isLive: draft.isLive,
      isBsplicboost: draft.isBsplicboost,
      isActive: draft.isActive,
      exclusions: draft.akoExclusions,
    },
  };
}

export interface NewBetDraft {
  title: string;
  categoryId: string;
  betType: EditableBetType;
  options: OptionDraft[];
  endsAt: Date;
  isLive: boolean;
  isBsplicboost: boolean;
  akoExclusions: BetAkoExclusionDraft[];
}

/**
 * Web `CreateBetTab.handleSubmit` checks, in the web order and copy. The web
 * relies on the required date input; native checks the date last with the
 * edit form's message.
 */
export function validateNewBet(draft: NewBetDraft): FormResult<CreateBetWithAkoExclusionsInput> {
  const cleanedOptions = cleanOptions(draft.options);
  if (cleanedOptions.some((option) => !option.name)) {
    return { ok: false, message: 'Uzupełnij etykiety wszystkich opcji' };
  }

  const minOptions = draft.betType === 'single' ? 1 : 2;
  if (cleanedOptions.length < minOptions) {
    return {
      ok: false,
      message: minOptions === 1 ? 'Dodaj co najmniej 1 opcję' : 'Dodaj co najmniej 2 opcje',
    };
  }

  const invalidOddsIndex = findInvalidOddsIndex(cleanedOptions);
  if (invalidOddsIndex !== -1) {
    return { ok: false, message: `Podaj poprawny kurs dla opcji ${invalidOddsIndex + 1}` };
  }

  const trimmedTitle = draft.title.trim();
  if (!trimmedTitle) return { ok: false, message: 'Tytuł jest wymagany' };

  if (!isValidDate(draft.endsAt)) {
    return { ok: false, message: 'Wybierz poprawną datę zakończenia' };
  }

  return {
    ok: true,
    value: {
      title: trimmedTitle,
      categoryId: draft.categoryId || null,
      betType: draft.betType,
      options: cleanedOptions.map((option) => ({ name: option.name, odds: Number(option.oddsRaw) })),
      endsAt: draft.endsAt.toISOString(),
      isLive: draft.isLive,
      isBsplicboost: draft.isBsplicboost,
      exclusions: draft.akoExclusions,
    },
  };
}
