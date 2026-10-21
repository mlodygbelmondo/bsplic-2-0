import { FALLBACK_MONEY_TRANSFER_RULES, formatMoney } from './format';
import type { MoneyTransferRules } from './types';

/** Send-form rules ported from the web `MoneyTransferSend`. */

const DAY_MS = 24 * 60 * 60 * 1000;

export interface EffectiveTransferRules {
  minAmount: number;
  messageLimit: number;
  maxTransfersPerHour: number;
  minAccountAgeDays: number;
}

export function getEffectiveRules(rules: MoneyTransferRules | null): EffectiveTransferRules {
  return {
    minAmount: rules?.min_amount ?? FALLBACK_MONEY_TRANSFER_RULES.min_amount,
    messageLimit: rules?.max_message_length ?? FALLBACK_MONEY_TRANSFER_RULES.max_message_length,
    maxTransfersPerHour: rules?.max_transfers_per_hour ?? FALLBACK_MONEY_TRANSFER_RULES.max_transfers_per_hour,
    minAccountAgeDays: rules?.min_account_age_days ?? FALLBACK_MONEY_TRANSFER_RULES.min_account_age_days,
  };
}

export interface SenderEligibility {
  /** Epoch ms when the account may send, or null when unknown / not applicable. */
  eligibleAt: number | null;
  tooNew: boolean;
  /** Re-fetch the rules after this many ms to unlock an open form (server clock). */
  refetchRulesInMs: number | null;
}

/**
 * Server rules are authoritative; before they load the client estimates the
 * eligibility from the profile creation date (Continue stays disabled anyway).
 */
export function getSenderEligibility(
  rules: MoneyTransferRules | null,
  profileCreatedAt: string,
  now: number,
): SenderEligibility {
  if (rules) {
    const parsed = rules.sender_eligible_at ? new Date(rules.sender_eligible_at).getTime() : NaN;
    const eligibleAt = Number.isFinite(parsed) ? parsed : null;
    const tooNew = !rules.sender_eligible;
    const serverNow = new Date(rules.server_now).getTime();
    const refetchRulesInMs =
      tooNew && eligibleAt !== null && Number.isFinite(serverNow) ? Math.max(eligibleAt - serverNow, 0) + 50 : null;
    return { eligibleAt, tooNew, refetchRulesInMs };
  }

  const createdAt = new Date(profileCreatedAt).getTime();
  if (!Number.isFinite(createdAt)) return { eligibleAt: null, tooNew: false, refetchRulesInMs: null };
  const eligibleAt = createdAt + FALLBACK_MONEY_TRANSFER_RULES.min_account_age_days * DAY_MS;
  return { eligibleAt, tooNew: eligibleAt > now, refetchRulesInMs: null };
}

export interface TransferDraft {
  rules: MoneyTransferRules | null;
  rulesFailed: boolean;
  hasRecipient: boolean;
  amount: number | null;
  balance: number;
  messageLength: number;
  tooNew: boolean;
}

/** First failing rule wins; shown as a toast on Continue and again on submit. */
export function getTransferValidationError(draft: TransferDraft): string | null {
  const { minAmount, messageLimit, minAccountAgeDays } = getEffectiveRules(draft.rules);
  if (!draft.rules) {
    return draft.rulesFailed ? 'Najpierw ponów pobieranie zasad transferów' : 'Poczekaj na pobranie zasad transferów';
  }
  if (!draft.hasRecipient) return 'Wybierz odbiorcę';
  if (draft.amount === null || draft.amount < minAmount) {
    return `Wpisz kwotę co najmniej ${formatMoney(minAmount)} zł`;
  }
  if (draft.amount > draft.balance) return 'Niewystarczające saldo';
  if (draft.messageLength > messageLimit) return `Wiadomość może mieć maksymalnie ${messageLimit} znaków`;
  if (draft.tooNew) return `Konto nadawcy musi istnieć od co najmniej ${minAccountAgeDays} dni`;
  return null;
}

/** Message length in code points, like the web's `Array.from(value).length`. */
export function messageLengthOf(value: string): number {
  return Array.from(value).length;
}
