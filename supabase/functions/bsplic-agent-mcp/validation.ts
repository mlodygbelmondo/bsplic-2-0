export interface AgentBetOption {
  name: string;
  odds: number;
}

export interface AgentOddsSource {
  bookmaker: string;
  url: string;
  observed_at: string;
  prices: Record<string, number>;
}

export interface AgentBetInput {
  title: string;
  category_id?: string | null;
  bet_type: 'single' | '12' | '1x2' | 'multi';
  options: AgentBetOption[];
  ends_at: string;
  is_live?: boolean;
  is_bsplicboost?: boolean;
  event_key: string;
  agent_duplicate_key: string;
  ako_ref: string;
  ako_exclusions?: Array<{
    ref?: string;
    betId?: string;
    agent_duplicate_key?: string;
    reason: string;
  }>;
  agent_metadata: {
    odds_source: AgentOddsSource;
    [key: string]: unknown;
  };
}

export interface AgentSettlementInput {
  bet_id: string;
  hold?: boolean;
  reason?: string;
  mode?: 'normal' | 'refund' | 'force_lost';
  scope?: 'pending_only' | 'all';
  winning_options?: string[];
  evidence?: {
    sources?: string[];
    confidence?: string;
    note?: string;
    [key: string]: unknown;
  };
}

const MAX_ODDS_AGE_MS = 6 * 60 * 60 * 1000;
const MIN_BETTING_WINDOW_MS = 2 * 60 * 60 * 1000;

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateBets(
  bets: AgentBetInput[],
  now = new Date(),
): string[] {
  const errors: string[] = [];

  if (bets.length === 0) {
    return ['bets must contain at least one market'];
  }
  if (bets.length > 25) {
    errors.push('one call may create at most 25 markets');
  }

  const refs = new Set<string>();
  const duplicateKeys = new Set<string>();

  bets.forEach((bet, index) => {
    const prefix = `bets[${index}]`;
    const endsAt = new Date(bet.ends_at).getTime();
    const observedAt = new Date(
      bet.agent_metadata?.odds_source?.observed_at,
    ).getTime();
    const source = bet.agent_metadata?.odds_source;

    if (!bet.title?.trim()) errors.push(`${prefix}.title is required`);
    if (!bet.event_key?.trim()) errors.push(`${prefix}.event_key is required`);
    if (!bet.agent_duplicate_key?.trim()) {
      errors.push(`${prefix}.agent_duplicate_key is required`);
    } else if (duplicateKeys.has(bet.agent_duplicate_key)) {
      errors.push(`${prefix}.agent_duplicate_key is duplicated in this call`);
    } else {
      duplicateKeys.add(bet.agent_duplicate_key);
    }

    if (!bet.ako_ref?.trim()) {
      errors.push(`${prefix}.ako_ref is required`);
    } else if (refs.has(bet.ako_ref)) {
      errors.push(`${prefix}.ako_ref is duplicated in this call`);
    } else {
      refs.add(bet.ako_ref);
    }

    if (!Number.isFinite(endsAt)) {
      errors.push(`${prefix}.ends_at must be an ISO date`);
    } else if (endsAt - now.getTime() < MIN_BETTING_WINDOW_MS) {
      errors.push(`${prefix}.ends_at must leave at least 2 hours to bet`);
    }

    if (!Array.isArray(bet.options) || bet.options.length === 0) {
      errors.push(`${prefix}.options must not be empty`);
    }

    if (!source?.bookmaker?.trim()) {
      errors.push(`${prefix}.agent_metadata.odds_source.bookmaker is required`);
    }
    if (!source?.url || !isHttpsUrl(source.url)) {
      errors.push(`${prefix}.agent_metadata.odds_source.url must use HTTPS`);
    }
    if (!Number.isFinite(observedAt)) {
      errors.push(
        `${prefix}.agent_metadata.odds_source.observed_at must be an ISO date`,
      );
    } else if (
      observedAt > now.getTime() + 5 * 60 * 1000 ||
      now.getTime() - observedAt > MAX_ODDS_AGE_MS
    ) {
      errors.push(
        `${prefix}.odds source must have been observed in the last 6 hours`,
      );
    }

    const prices = source?.prices;
    if (!prices || typeof prices !== 'object') {
      errors.push(`${prefix}.agent_metadata.odds_source.prices is required`);
      return;
    }

    const optionNames = new Set<string>();
    for (const [optionIndex, option] of (bet.options ?? []).entries()) {
      const optionPrefix = `${prefix}.options[${optionIndex}]`;
      if (!option.name?.trim()) {
        errors.push(`${optionPrefix}.name is required`);
        continue;
      }
      if (optionNames.has(option.name)) {
        errors.push(`${optionPrefix}.name is duplicated`);
      }
      optionNames.add(option.name);
      if (!Number.isFinite(option.odds) || option.odds <= 1) {
        errors.push(`${optionPrefix}.odds must be greater than 1`);
      }
      if (prices[option.name] !== option.odds) {
        errors.push(
          `${optionPrefix}.odds must exactly match odds_source.prices[${JSON.stringify(option.name)}]`,
        );
      }
    }
  });

  for (let leftIndex = 0; leftIndex < bets.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < bets.length;
      rightIndex += 1
    ) {
      const left = bets[leftIndex];
      const right = bets[rightIndex];
      if (!left.event_key || left.event_key !== right.event_key) continue;

      const leftTargetsRight = (left.ako_exclusions ?? []).some(
        (exclusion) =>
          exclusion.ref === right.ako_ref ||
          exclusion.agent_duplicate_key === right.agent_duplicate_key,
      );
      const rightTargetsLeft = (right.ako_exclusions ?? []).some(
        (exclusion) =>
          exclusion.ref === left.ako_ref ||
          exclusion.agent_duplicate_key === left.agent_duplicate_key,
      );

      if (!leftTargetsRight && !rightTargetsLeft) {
        errors.push(
          `bets[${leftIndex}] and bets[${rightIndex}] share event_key ${JSON.stringify(left.event_key)} and require an AKO exclusion`,
        );
      }
    }
  }

  return errors;
}

export function validateSettlements(
  settlements: AgentSettlementInput[],
): string[] {
  const errors: string[] = [];

  if (settlements.length === 0) {
    return ['settlements must contain at least one market'];
  }
  if (settlements.length > 50) {
    errors.push('one call may settle or hold at most 50 markets');
  }

  settlements.forEach((entry, index) => {
    const prefix = `settlements[${index}]`;
    if (!entry.bet_id?.trim()) errors.push(`${prefix}.bet_id is required`);

    if (entry.hold === true) {
      if (!entry.reason?.trim())
        errors.push(`${prefix}.reason is required for a hold`);
      return;
    }

    const mode = entry.mode ?? 'normal';
    if (mode === 'normal' && !entry.winning_options?.length) {
      errors.push(
        `${prefix}.winning_options is required for normal settlement`,
      );
    }

    const sources = entry.evidence?.sources ?? [];
    if (sources.length === 0) {
      errors.push(
        `${prefix}.evidence.sources must contain a public result source`,
      );
    }
    for (const [sourceIndex, source] of sources.entries()) {
      if (!isHttpsUrl(source)) {
        errors.push(
          `${prefix}.evidence.sources[${sourceIndex}] must use HTTPS`,
        );
      }
    }
    if (entry.evidence?.confidence !== 'high') {
      errors.push(`${prefix}.evidence.confidence must be high`);
    }
    if (!entry.evidence?.note?.trim()) {
      errors.push(
        `${prefix}.evidence.note must state the verified final result`,
      );
    }
  });

  return errors;
}
