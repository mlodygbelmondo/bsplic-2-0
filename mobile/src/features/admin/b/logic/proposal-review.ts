import type { Json } from '@/lib/database.types';
import type { BetOption, BetProposalSource } from '@/types/database';
import type { EditableBetType } from '../../constants';
import {
  getTomorrowAt2359,
  lockEditableOptionsByType,
  normalizeOptions,
  normalizeType,
  toEditableOptions,
  toInputDateTime,
  type EditableBetOption,
} from '../../helpers';
import {
  normalizeAgentMetadata,
  normalizeProposalSource,
  type AgentProposalMetadata,
} from '../../proposal-source';

/** Pending proposal as listed in the admin queue (web `ProposalsTab` `ProposalRow`). */
export interface ProposalRow {
  id: string;
  user_id: string;
  title: string;
  category_id: string | null;
  ends_at: string | null;
  bet_type: EditableBetType;
  options: BetOption[];
  username: string;
  proposal_source: BetProposalSource;
  agent_metadata: AgentProposalMetadata | null;
  agent_duplicate_key: string | null;
}

export interface ProposalEditor {
  id: string;
  title: string;
  categoryId: string;
  betType: EditableBetType;
  options: EditableBetOption[];
  endsAt: string;
  isBsplicboost: boolean;
}

export interface RawProposalRow {
  id: string;
  user_id: string;
  title: string;
  category_id: string | null;
  ends_at: string | null;
  bet_type: string;
  options: Json;
  proposal_source?: string | null;
  agent_metadata?: Json;
  agent_duplicate_key?: string | null;
}

export const FALLBACK_PROPOSAL_USERNAME = 'Użytkownik';

export const normalizeProposalRow = (
  proposal: RawProposalRow,
  username: string | undefined,
): ProposalRow => ({
  id: proposal.id,
  user_id: proposal.user_id,
  title: proposal.title,
  category_id: proposal.category_id,
  ends_at: proposal.ends_at,
  bet_type: normalizeType(proposal.bet_type),
  options: normalizeOptions(proposal.options),
  proposal_source: normalizeProposalSource(proposal.proposal_source),
  agent_metadata: normalizeAgentMetadata(proposal.agent_metadata),
  agent_duplicate_key:
    typeof proposal.agent_duplicate_key === 'string' ? proposal.agent_duplicate_key : null,
  username: username || FALLBACK_PROPOSAL_USERNAME,
});

export const createProposalEditor = (
  proposal: ProposalRow,
  now: Date = new Date(),
): ProposalEditor => ({
  id: proposal.id,
  title: proposal.title,
  categoryId: proposal.category_id || '',
  betType: proposal.bet_type,
  options: lockEditableOptionsByType(proposal.bet_type, toEditableOptions(proposal.options)),
  endsAt: proposal.ends_at
    ? toInputDateTime(proposal.ends_at)
    : toInputDateTime(getTomorrowAt2359(now)),
  isBsplicboost: false,
});

export const hasFixedOptionCount = (betType: EditableBetType): boolean =>
  betType === 'single' || betType === '12' || betType === '1x2';

const FIXED_OPTION_COUNTS: Partial<Record<EditableBetType, number>> = {
  single: 1,
  '12': 2,
  '1x2': 3,
};

export interface AcceptProposalParams {
  p_proposal_id: string;
  p_status: 'accepted';
  p_title: string;
  p_category_id: string | null;
  p_bet_type: EditableBetType;
  p_options: { name: string; odds: number }[];
  p_ends_at: string;
  p_is_bsplicboost: boolean;
}

export type AcceptProposalResult =
  | { ok: true; params: AcceptProposalParams }
  | { ok: false; error: string };

/** Validation and RPC payload of the web `acceptEdited` (same order and copy). */
export const buildAcceptProposalParams = (editing: ProposalEditor): AcceptProposalResult => {
  const cleanedOptions = editing.options
    .filter((option) => option.name.trim())
    .map((option) => ({ name: option.name.trim(), oddsRaw: option.odds.trim() }));

  const fixedOptionCount = FIXED_OPTION_COUNTS[editing.betType];
  if (
    fixedOptionCount !== undefined
      ? cleanedOptions.length !== fixedOptionCount
      : cleanedOptions.length < 2
  ) {
    return { ok: false, error: 'Nieprawidłowa liczba opcji' };
  }

  const invalidOddsIndex = cleanedOptions.findIndex((option) => {
    const odds = Number(option.oddsRaw);
    return !option.oddsRaw || !Number.isFinite(odds) || odds <= 0;
  });
  if (invalidOddsIndex !== -1) {
    return { ok: false, error: `Podaj poprawny kurs dla opcji ${invalidOddsIndex + 1}` };
  }

  if (!editing.title.trim()) {
    return { ok: false, error: 'Tytuł jest wymagany' };
  }

  const endsAtDate = new Date(editing.endsAt);
  if (Number.isNaN(endsAtDate.getTime())) {
    return { ok: false, error: 'Wybierz poprawną datę zakończenia' };
  }

  return {
    ok: true,
    params: {
      p_proposal_id: editing.id,
      p_status: 'accepted',
      p_title: editing.title.trim(),
      p_category_id: editing.categoryId || null,
      p_bet_type: editing.betType,
      p_options: cleanedOptions.map((option) => ({
        name: option.name,
        odds: Number(option.oddsRaw),
      })),
      p_ends_at: endsAtDate.toISOString(),
      p_is_bsplicboost: editing.isBsplicboost,
    },
  };
};
