// Pure logic of the auto-bets bot: turning Polymarket games into BSPLIC
// markets and deciding settlements from resolved Polymarket markets. No I/O,
// so it runs under Deno (edge function) and Vitest alike.

import { TEAM_NAME_ALIASES, type LeagueConfig } from './leagues.ts';

export const DEFAULT_MARGIN = 0.06;
export const MIN_LIQUIDITY = 1000;
export const MAX_SPREAD = 0.05;
// Games more lopsided than this are skipped: nobody bets them for fun and the
// favourite's price would fall under 1.03 after margin.
export const MIN_PROBABILITY = 0.04;
export const MAX_PROBABILITY = 0.92;
// The bets trigger demands two hours between publishing and the event start;
// the extra minutes absorb request latency.
export const MIN_LEAD_MS = (2 * 60 + 15) * 60 * 1000;
export const HORIZON_MS = 48 * 60 * 60 * 1000;
export const DRAW_OPTION = 'Remis';

export interface GammaMarket {
  id: string;
  question?: string | null;
  groupItemTitle?: string | null;
  outcomes?: string | null;
  outcomePrices?: string | null;
  bestBid?: number | string | null;
  bestAsk?: number | string | null;
  liquidityNum?: number | string | null;
  sportsMarketType?: string | null;
  gameStartTime?: string | null;
  active?: boolean | null;
  closed?: boolean | null;
  acceptingOrders?: boolean | null;
  umaResolutionStatus?: string | null;
}

export interface GammaEvent {
  id: string;
  slug: string;
  title: string;
  startTime?: string | null;
  markets?: GammaMarket[] | null;
}

export interface OddsSourceOutcome {
  option: string;
  market_id: string;
  outcome_index: number;
  probability: number;
}

export interface PolymarketOddsSource {
  provider: 'polymarket';
  league: string;
  event_id: string;
  event_slug: string;
  url: string;
  kind: '1x2' | '12';
  margin: number;
  observed_at: string;
  outcomes: OddsSourceOutcome[];
}

export interface AutoBetPayload {
  title: string;
  bet_type: '1x2' | '12';
  options: { name: string; odds: number }[];
  ends_at: string;
  event_key: string;
  agent_duplicate_key: string;
  ako_ref: string;
  agent_metadata: {
    event_starts_at: string;
    schedule_source: {
      provider: string;
      url: string;
      observed_at: string;
      displayed_start: string;
      timezone: string;
    };
    odds_source: PolymarketOddsSource;
  };
}

export interface Candidate {
  leagueKey: string;
  categorySlug: string;
  liquidity: number;
  bet: AutoBetPayload;
}

export type BuildResult =
  | { ok: true; candidate: Candidate }
  | { ok: false; reason: string };

export interface BuildOptions {
  now: Date;
  margin?: number;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function isYesNo(outcomes: string[]): boolean {
  return (
    outcomes.length === 2 &&
    outcomes[0].toLowerCase() === 'yes' &&
    outcomes[1].toLowerCase() === 'no'
  );
}

// Gamma prints game times as "2026-10-14 16:45:00+00", which is not ISO.
export function parseGammaTime(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const iso = value
    .trim()
    .replace(' ', 'T')
    .replace(/([+-]\d{2})$/, '$1:00');
  const time = Date.parse(iso);
  return Number.isFinite(time) ? new Date(time) : null;
}

const CLUB_PREFIX =
  /^(?:FC|AFC|SC|RC|RCD|SK|ŠK|FK|KF|NK|GNK|PFK|KKS|RSC|US|SS|SSC|ACF|CA|AJ|OGC|ES|K\.)\s+/;
const CLUB_SUFFIX =
  /\s+(?:FC|CF|AFC|CFC|AC|SK|SC|UD|FK|BC|KV|VV|AIF|GF|JK|CS|SFP|OSC|SCO|Calcio)(?:\s+\d{4})?$/;

// `clubNames` strips football legal affixes ("SSC Napoli" -> "Napoli",
// "Parma Calcio 1913" -> "Parma").
export function displayTeamName(raw: string, clubNames = false): string {
  const name = raw.trim();
  const alias = TEAM_NAME_ALIASES[name];
  if (alias) {
    return alias;
  }
  if (!clubNames) {
    return name;
  }
  const stripped = name.replace(CLUB_PREFIX, '').replace(CLUB_SUFFIX, '').trim();
  return stripped.length >= 3 ? stripped : name;
}

export function parseEventTitle(title: string) {
  const bo = title.match(/\((BO\d+)\)/i)?.[1]?.toUpperCase() ?? null;
  const stage = title.match(/\(BO\d+\)\s*-\s*(.+)$/i)?.[1]?.trim() || null;
  const colon = title.indexOf(': ');
  const prefix = colon > 0 ? title.slice(0, colon).trim() : null;
  return { bo, stage, prefix };
}

function titleContext(league: LeagueConfig, title: string): string {
  const parsed = parseEventTitle(title);
  switch (league.titleContext) {
    case 'label_and_prefix':
      if (!parsed.prefix) {
        return league.label;
      }
      return parsed.prefix.toLowerCase().startsWith(league.label.toLowerCase())
        ? parsed.prefix
        : `${league.label} ${parsed.prefix}`;
    case 'prefix':
      return parsed.prefix ?? league.label;
    case 'stage':
      return parsed.stage ?? league.label;
    default:
      return league.label;
  }
}

// Midpoint of the order book for the market's first outcome, falling back to
// the last displayed price.
function firstOutcomeProbability(market: GammaMarket): number | null {
  const bid = toNumber(market.bestBid);
  const ask = toNumber(market.bestAsk);
  if (bid !== null && ask !== null && bid > 0 && ask >= bid) {
    return (bid + ask) / 2;
  }
  return toNumber(parseJsonArray(market.outcomePrices)[0]);
}

function marketQualityIssue(market: GammaMarket): string | null {
  if (market.active === false || market.closed || market.acceptingOrders === false) {
    return 'market not open for trading';
  }
  if ((toNumber(market.liquidityNum) ?? 0) < MIN_LIQUIDITY) {
    return 'liquidity too low';
  }
  const bid = toNumber(market.bestBid);
  const ask = toNumber(market.bestAsk);
  if (bid === null || ask === null) {
    return 'no order book';
  }
  if (ask - bid > MAX_SPREAD) {
    return 'spread too wide';
  }
  return null;
}

export function probabilitiesToOdds(probabilities: number[], margin: number): number[] {
  const total = probabilities.reduce((sum, value) => sum + value, 0);
  return probabilities.map((probability) => {
    const priced = (probability / total) * (1 + margin);
    return Math.max(1.01, Math.round((1 / priced) * 100) / 100);
  });
}

interface Outcome {
  name: string;
  marketId: string;
  outcomeIndex: number;
  probability: number | null;
}

function twoWayOutcomes(market: GammaMarket, clubNames: boolean): Outcome[] | string {
  const names = parseJsonArray(market.outcomes);
  if (names.length !== 2 || isYesNo(names)) {
    return 'unsupported moneyline shape';
  }
  const first = firstOutcomeProbability(market);
  return [
    { name: displayTeamName(names[0], clubNames), marketId: market.id, outcomeIndex: 0, probability: first },
    {
      name: displayTeamName(names[1], clubNames),
      marketId: market.id,
      outcomeIndex: 1,
      probability: first === null ? null : 1 - first,
    },
  ];
}

function isDrawMarket(market: GammaMarket): boolean {
  return /^draw\b/i.test(market.groupItemTitle?.trim() ?? '');
}

function threeWayOutcomes(
  markets: GammaMarket[],
  eventTitle: string,
  clubNames: boolean,
): Outcome[] | string {
  const draw = markets.find(isDrawMarket);
  const teams = markets.filter((market) => market !== draw);
  if (!draw || teams.length !== 2) {
    return 'unsupported moneyline shape';
  }
  if (!markets.every((market) => isYesNo(parseJsonArray(market.outcomes)))) {
    return 'unsupported moneyline shape';
  }
  if (!teams.every((market) => market.groupItemTitle?.trim())) {
    return 'missing team names';
  }

  // Home team first: the event title reads "Home vs. Away".
  const position = (market: GammaMarket) => eventTitle.indexOf(market.groupItemTitle!.trim());
  const [home, away] =
    position(teams[0]) >= 0 && position(teams[1]) >= 0 && position(teams[1]) < position(teams[0])
      ? [teams[1], teams[0]]
      : teams;

  const outcome = (market: GammaMarket, name: string): Outcome => ({
    name,
    marketId: market.id,
    outcomeIndex: 0,
    probability: firstOutcomeProbability(market),
  });

  return [
    outcome(home, displayTeamName(home.groupItemTitle!, clubNames)),
    outcome(draw, DRAW_OPTION),
    outcome(away, displayTeamName(away.groupItemTitle!, clubNames)),
  ];
}

export function buildCandidate(
  event: GammaEvent,
  league: LeagueConfig,
  { now, margin = DEFAULT_MARGIN }: BuildOptions,
): BuildResult {
  const fail = (reason: string): BuildResult => ({ ok: false, reason });
  const moneylines = (event.markets ?? []).filter(
    (market) => market.sportsMarketType === 'moneyline',
  );
  if (moneylines.length === 0) {
    return fail('no moneyline market');
  }

  const startsAt = parseGammaTime(event.startTime ?? moneylines[0].gameStartTime);
  if (!startsAt) {
    return fail('missing start time');
  }
  const lead = startsAt.getTime() - now.getTime();
  if (lead < MIN_LEAD_MS) {
    return fail('starts too soon');
  }
  if (lead > HORIZON_MS) {
    return fail('starts too late');
  }

  for (const market of moneylines) {
    const issue = marketQualityIssue(market);
    if (issue) {
      return fail(issue);
    }
  }

  let kind: '1x2' | '12';
  let outcomes: Outcome[] | string;
  if (moneylines.length === 1) {
    kind = '12';
    outcomes = twoWayOutcomes(moneylines[0], league.clubNames === true);
  } else if (moneylines.length === 3) {
    kind = '1x2';
    outcomes = threeWayOutcomes(moneylines, event.title, league.clubNames === true);
  } else {
    return fail('unsupported moneyline shape');
  }
  if (typeof outcomes === 'string') {
    return fail(outcomes);
  }

  const probabilities = outcomes.map((outcome) => outcome.probability);
  if (probabilities.some((value) => value === null || value <= 0 || value >= 1)) {
    return fail('missing prices');
  }
  const total = (probabilities as number[]).reduce((sum, value) => sum + value, 0);
  const normalized = (probabilities as number[]).map((value) => value / total);
  if (normalized.some((value) => value < MIN_PROBABILITY || value > MAX_PROBABILITY)) {
    return fail('too lopsided');
  }
  if (new Set(outcomes.map((outcome) => outcome.name)).size !== outcomes.length) {
    return fail('ambiguous option names');
  }

  const odds = probabilitiesToOdds(normalized, margin);
  const startsAtIso = startsAt.toISOString();
  const observedAt = now.toISOString();
  const url = `https://polymarket.com/event/${event.slug}`;
  const parsed = parseEventTitle(event.title);
  const home = outcomes[0];
  const away = outcomes[outcomes.length - 1];
  const title = `${titleContext(league, event.title)}: ${home.name} - ${away.name}${
    parsed.bo ? ` (${parsed.bo})` : ''
  }`;
  const key = `pm:${event.id}`;

  return {
    ok: true,
    candidate: {
      leagueKey: league.key,
      categorySlug: league.categorySlug,
      liquidity: Math.min(...moneylines.map((market) => toNumber(market.liquidityNum) ?? 0)),
      bet: {
        title,
        bet_type: kind,
        options: outcomes.map((outcome, index) => ({ name: outcome.name, odds: odds[index] })),
        ends_at: startsAtIso,
        event_key: key,
        agent_duplicate_key: `${key}:moneyline`,
        ako_ref: `${key}:moneyline`,
        agent_metadata: {
          event_starts_at: startsAtIso,
          schedule_source: {
            provider: 'Polymarket',
            url,
            observed_at: observedAt,
            displayed_start: event.startTime ?? moneylines[0].gameStartTime ?? startsAtIso,
            timezone: 'UTC',
          },
          odds_source: {
            provider: 'polymarket',
            league: league.key,
            event_id: event.id,
            event_slug: event.slug,
            url,
            kind,
            margin,
            observed_at: observedAt,
            outcomes: outcomes.map((outcome, index) => ({
              option: outcome.name,
              market_id: outcome.marketId,
              outcome_index: outcome.outcomeIndex,
              probability: Math.round(normalized[index] * 10000) / 10000,
            })),
          },
        },
      },
    },
  };
}

const warsawDayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Warsaw',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function warsawDay(iso: string): string {
  return warsawDayFormat.format(new Date(iso));
}

export interface PublishedMarket {
  categoryId: string | null;
  eventKey: string | null;
  startsAt: string;
}

// Drops games that are already published and keeps at most `dailyCap` markets
// per category per Warsaw day. Published markets count whether still open or
// already settled, so settling early games does not free slots for more.
// Most liquid (most followed) games win the remaining slots.
export function selectCandidates(
  candidates: Candidate[],
  leagues: LeagueConfig[],
  published: PublishedMarket[],
  categoryIdBySlug: Map<string, string>,
): { selected: Candidate[]; capped: Candidate[] } {
  const caps = new Map<string, number>();
  for (const league of leagues) {
    if (league.dailyCap !== undefined) {
      caps.set(league.categorySlug, league.dailyCap);
    }
  }
  const publishedKeys = new Set(published.map((market) => market.eventKey));
  const used = new Map<string, number>();
  for (const market of published) {
    const group = `${market.categoryId}:${warsawDay(market.startsAt)}`;
    used.set(group, (used.get(group) ?? 0) + 1);
  }

  const fresh = candidates
    .filter((candidate) => !publishedKeys.has(candidate.bet.event_key))
    .sort((a, b) => b.liquidity - a.liquidity);

  const selected: Candidate[] = [];
  const capped: Candidate[] = [];
  for (const candidate of fresh) {
    const cap = caps.get(candidate.categorySlug);
    const categoryId = categoryIdBySlug.get(candidate.categorySlug) ?? null;
    const group = `${categoryId}:${warsawDay(candidate.bet.ends_at)}`;
    const count = used.get(group) ?? 0;
    if (cap !== undefined && count >= cap) {
      capped.push(candidate);
      continue;
    }
    used.set(group, count + 1);
    selected.push(candidate);
  }
  return { selected, capped };
}

function isOutcome(value: unknown): value is OddsSourceOutcome {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const outcome = value as Partial<OddsSourceOutcome>;
  return (
    typeof outcome.option === 'string' &&
    outcome.option.length > 0 &&
    typeof outcome.market_id === 'string' &&
    outcome.market_id.length > 0 &&
    (outcome.outcome_index === 0 || outcome.outcome_index === 1)
  );
}

// True only for the exact mapping buildCandidate writes: three Yes/No markets
// for 1x2, both sides of one market for 12. Anything else is left to a human
// rather than settled from a mapping that cannot prove the result.
export function isPolymarketSource(value: unknown): value is PolymarketOddsSource {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const source = value as Partial<PolymarketOddsSource>;
  if (
    source.provider !== 'polymarket' ||
    typeof source.event_id !== 'string' ||
    typeof source.url !== 'string' ||
    !Array.isArray(source.outcomes) ||
    !source.outcomes.every(isOutcome)
  ) {
    return false;
  }
  const outcomes = source.outcomes;
  const marketIds = new Set(outcomes.map((outcome) => outcome.market_id));
  if (source.kind === '1x2') {
    return (
      outcomes.length === 3 &&
      marketIds.size === 3 &&
      outcomes.every((outcome) => outcome.outcome_index === 0)
    );
  }
  if (source.kind === '12') {
    return (
      outcomes.length === 2 &&
      marketIds.size === 1 &&
      outcomes[0].outcome_index === 0 &&
      outcomes[1].outcome_index === 1
    );
  }
  return false;
}

export type SettlementDecision =
  | { action: 'settle'; winningOption: string }
  | { action: 'refund'; reason: string }
  | { action: 'wait'; reason: string }
  | { action: 'hold'; reason: string };

// `closedMarkets` holds the markets Gamma returned for `closed=true`; a market
// missing from it has not finished yet.
export function decideSettlement(
  source: PolymarketOddsSource,
  closedMarkets: Map<string, GammaMarket>,
): SettlementDecision {
  const prices = new Map<string, number[]>();
  for (const marketId of new Set(source.outcomes.map((outcome) => outcome.market_id))) {
    const market = closedMarkets.get(marketId);
    if (!market || !market.closed) {
      return { action: 'wait', reason: 'market not closed yet' };
    }
    if (market.umaResolutionStatus !== 'resolved') {
      return { action: 'wait', reason: `resolution ${market.umaResolutionStatus ?? 'missing'}` };
    }
    const values = parseJsonArray(market.outcomePrices).map(Number);
    if (values.length < 2 || values.some((value) => value !== 0 && value !== 0.5 && value !== 1)) {
      return { action: 'wait', reason: 'prices not final' };
    }
    prices.set(marketId, values);
  }

  if ([...prices.values()].some((values) => values.includes(0.5))) {
    return { action: 'refund', reason: 'Polymarket rozliczył rynek po 50/50 (wydarzenie odwołane)' };
  }

  const winners = source.outcomes.filter(
    (outcome) => prices.get(outcome.market_id)?.[outcome.outcome_index] === 1,
  );
  if (winners.length === 1) {
    return { action: 'settle', winningOption: winners[0].option };
  }
  if (winners.length === 0) {
    return { action: 'refund', reason: 'Polymarket nie wskazał zwycięzcy (wydarzenie odwołane)' };
  }
  return { action: 'hold', reason: 'Polymarket wskazał kilku zwycięzców' };
}
