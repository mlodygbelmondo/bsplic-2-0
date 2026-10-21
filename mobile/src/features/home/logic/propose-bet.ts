/** Form rules of the web `ProposeBetModal` (`src/components/ProposeBetModal.tsx`). */

export type ProposalBetType = 'single' | '12' | '1x2' | 'multi';

export interface OptionDraft {
  name: string;
  odds: string;
}

export interface ProposalOption {
  name: string;
  odds: number;
}

export const PROPOSAL_TYPES: { value: ProposalBetType; label: string }[] = [
  { value: 'single', label: 'Single' },
  { value: '12', label: '1/2' },
  { value: '1x2', label: '1X2' },
  { value: 'multi', label: 'Multi' },
];

const FIXED_OPTION_COUNTS: Partial<Record<ProposalBetType, number>> = {
  single: 1,
  '12': 2,
  '1x2': 3,
};

const OPTION_DEFAULTS: Record<ProposalBetType, string[]> = {
  single: ['1'],
  '12': ['1', '2'],
  '1x2': ['1', 'X', '2'],
  multi: ['', ''],
};

export const INITIAL_OPTION_DRAFTS: OptionDraft[] = [
  { name: '1', odds: '2' },
  { name: '2', odds: '2' },
];

export function hasFixedOptionCount(type: ProposalBetType): boolean {
  return FIXED_OPTION_COUNTS[type] !== undefined;
}

/** Option rows after a type change (web `useEffect` on `betType`). */
export function reshapeOptionsForType(previous: OptionDraft[], type: ProposalBetType): OptionDraft[] {
  const fixedCount = FIXED_OPTION_COUNTS[type];
  if (fixedCount !== undefined) {
    return Array.from({ length: fixedCount }, (_, index) => ({
      name: previous[index]?.name ?? OPTION_DEFAULTS[type][index] ?? '',
      odds: previous[index]?.odds ?? (type === '1x2' && index === 1 ? '3' : '2'),
    }));
  }
  return previous.length >= 2
    ? previous
    : [
        { name: '', odds: '2' },
        { name: '', odds: '2' },
      ];
}

/** Default end date: tomorrow at 23:59 local time. */
export function getTomorrowAt2359(now: Date): Date {
  const date = new Date(now);
  date.setDate(date.getDate() + 1);
  date.setHours(23, 59, 0, 0);
  return date;
}

/**
 * Parses an odds field. The native decimal keypad types a comma in Polish
 * locales, so `1,85` is read as 1.85 (the web number input never sees commas).
 */
function parseOdds(raw: string): number {
  return Number(raw.replace(',', '.'));
}

export type ProposalValidation = { ok: true; options: ProposalOption[] } | { ok: false; message: string };

/** Web `handleSubmit` checks, in the same order and with the same messages. */
export function validateProposalOptions(options: OptionDraft[], betType: ProposalBetType): ProposalValidation {
  const prepared = options.map((option) => ({ name: option.name.trim(), oddsRaw: option.odds.trim() }));

  if (prepared.some((option) => !option.name)) {
    return { ok: false, message: 'Uzupełnij etykiety wszystkich opcji' };
  }

  const minOptions = betType === 'single' ? 1 : 2;
  if (prepared.length < minOptions) {
    return { ok: false, message: minOptions === 1 ? 'Dodaj co najmniej 1 opcję' : 'Dodaj co najmniej 2 opcje' };
  }

  const invalidOddsIndex = prepared.findIndex((option) => {
    if (!option.oddsRaw) return true;
    const odds = parseOdds(option.oddsRaw);
    return !Number.isFinite(odds) || odds <= 0;
  });
  if (invalidOddsIndex !== -1) {
    return { ok: false, message: `Podaj poprawny kurs dla opcji ${invalidOddsIndex + 1}` };
  }

  return { ok: true, options: prepared.map((option) => ({ name: option.name, odds: parseOdds(option.oddsRaw) })) };
}
