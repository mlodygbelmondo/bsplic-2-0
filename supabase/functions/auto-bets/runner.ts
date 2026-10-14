// Orchestration of one auto-bets run. I/O is injected (agent RPC + Polymarket
// Gamma fetch), so the same code runs in the edge function and in the local
// dry-run script (`npm run auto-bets:dry-run`).

import { LEAGUES } from './leagues.ts';
import {
  buildCandidate,
  decideSettlement,
  isPolymarketSource,
  MIN_LEAD_MS,
  selectCandidates,
  type Candidate,
  type GammaEvent,
  type GammaMarket,
  type PolymarketOddsSource,
} from './core.ts';

export interface RunnerDeps {
  // Calls an agent-token RPC; the token is added by the implementation.
  rpc: <T>(name: string, params: Record<string, unknown>) => Promise<T>;
  // GETs a Gamma API path such as `/events?series_id=1`.
  gamma: <T>(path: string) => Promise<T>;
  log?: (message: string) => void;
}

const CREATE_CHUNK = 25;
const MARKET_LOOKUP_CHUNK = 40;
// Safety stop for the settlement context scan (200 rows per page).
const SETTLEMENT_MAX_PAGES = 50;
const HISTORY_LIMIT = 500;
// A market Polymarket still has not resolved this long after the start is
// flagged for a human; re-flagged at most once a day.
const HOLD_AFTER_MS = 48 * 60 * 60 * 1000;
const HOLD_REPEAT_MS = 24 * 60 * 60 * 1000;

interface SettlementContextBet {
  id: string;
  title: string;
  ends_at: string;
  winning_option: string | null;
  event_key: string | null;
  odds_source: unknown;
  settlement_hold: { flagged_at?: string } | null;
}

interface PublishedBet {
  ends_at: string;
  event_key: string | null;
  category_id: string | null;
}

interface CategoryRow {
  id: string;
  slug?: string | null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function fetchUpcomingEvents(deps: RunnerDeps, seriesId: string, now: Date) {
  const endMin = encodeURIComponent(new Date(now.getTime() + MIN_LEAD_MS).toISOString());
  const events: GammaEvent[] = [];
  for (let page = 0; page < 3; page += 1) {
    const batch = await deps.gamma<GammaEvent[]>(
      `/events?series_id=${seriesId}&closed=false&limit=100&offset=${page * 100}&end_date_min=${endMin}`,
    );
    events.push(...batch);
    if (batch.length < 100) {
      break;
    }
  }
  return events;
}

// Gamma's /markets only returns closed markets when asked to, so a market
// missing from the result is still open.
async function fetchClosedMarkets(deps: RunnerDeps, ids: string[]) {
  const markets = new Map<string, GammaMarket>();
  for (const batchIds of chunk(ids, MARKET_LOOKUP_CHUNK)) {
    const query = batchIds.map((id) => `id=${encodeURIComponent(id)}`).join('&');
    const batch = await deps.gamma<GammaMarket[]>(
      `/markets?closed=true&limit=${batchIds.length}&${query}`,
    );
    for (const market of batch) {
      markets.set(String(market.id), market);
    }
  }
  return markets;
}

async function startRun(deps: RunnerDeps, kind: 'settle' | 'create') {
  try {
    const result = await deps.rpc<{ run_id: string }>('agent_start_run', { p_kind: kind });
    return result.run_id;
  } catch (error) {
    deps.log?.(`auto-bets: could not open run audit: ${errorMessage(error)}`);
    return null;
  }
}

async function finishRun(
  deps: RunnerDeps,
  runId: string | null,
  status: 'ok' | 'partial' | 'failed',
  counts: Record<string, number>,
  summary: Record<string, unknown>,
  report: string,
) {
  if (!runId) {
    return;
  }
  try {
    await deps.rpc('agent_finish_run', {
      p_run_id: runId,
      p_status: status,
      p_counts: counts,
      p_summary: summary,
      p_report: report,
    });
  } catch (error) {
    deps.log?.(`auto-bets: could not close run audit: ${errorMessage(error)}`);
  }
}

// A market is the bot's own only when its event_key is the one buildCandidate
// wrote and its odds_source is a complete mapping; everything else (manual
// markets, the old agent's, damaged metadata) is never settled here.
function isBotMarket(bet: SettlementContextBet): boolean {
  return (
    isPolymarketSource(bet.odds_source) &&
    bet.event_key === `pm:${(bet.odds_source as PolymarketOddsSource).event_id}`
  );
}

export async function runSettlement(deps: RunnerDeps, now: Date, dryRun: boolean) {
  const settled: { id: string; title: string; winner: string }[] = [];
  const refunded: { id: string; title: string; reason: string }[] = [];
  const held: { id: string; title: string; reason: string }[] = [];
  const errors: { id: string; title: string; error: string }[] = [];
  let waiting = 0;
  let checked = 0;

  // Only runs that change something (or fail) leave an audit row; an
  // every-30-minutes "nothing finished yet" would bury the useful ones.
  let runId: string | null = null;
  const ensureRun = async () => {
    if (!dryRun && runId === null) {
      runId = await startRun(deps, 'settle');
    }
    return runId;
  };

  try {
    const bets: SettlementContextBet[] = [];
    let offset = 0;
    for (let page = 0; page < SETTLEMENT_MAX_PAGES; page += 1) {
      const context = await deps.rpc<{
        bets: SettlementContextBet[];
        has_more: boolean;
        next_offset: number;
      }>('agent_get_pending_settlement_context', { p_limit: 200, p_offset: offset });
      bets.push(...context.bets);
      if (!context.has_more) {
        break;
      }
      offset = context.next_offset;
    }

    const due = bets.filter(
      (bet) =>
        bet &&
        isBotMarket(bet) &&
        bet.winning_option === null &&
        Date.parse(bet.ends_at) <= now.getTime(),
    );
    checked = due.length;
    if (due.length === 0) {
      return { checked, settled, refunded, held, waiting, errors };
    }

    const marketIds = [
      ...new Set(
        due.flatMap((bet) =>
          (bet.odds_source as PolymarketOddsSource).outcomes.map((outcome) => outcome.market_id),
        ),
      ),
    ];
    const closedMarkets = await fetchClosedMarkets(deps, marketIds);

    for (const bet of due) {
      const source = bet.odds_source as PolymarketOddsSource;
      const decision = decideSettlement(source, closedMarkets);

      try {
        if (decision.action === 'settle' || decision.action === 'refund') {
          if (!dryRun) {
            const currentRunId = await ensureRun();
            await deps.rpc('agent_settle_bet', {
              p_bet_id: bet.id,
              p_winning_options: decision.action === 'settle' ? [decision.winningOption] : [],
              p_mode: decision.action === 'settle' ? 'normal' : 'refund',
              p_scope: 'pending_only',
              p_evidence: {
                sources: [source.url],
                confidence: 'high',
                provider: 'polymarket',
                market_ids: [...new Set(source.outcomes.map((outcome) => outcome.market_id))],
                run_id: currentRunId,
                // Refused under the row lock if someone settled it meanwhile.
                require_unsettled: true,
              },
            });
          }
          if (decision.action === 'settle') {
            settled.push({ id: bet.id, title: bet.title, winner: decision.winningOption });
          } else {
            refunded.push({ id: bet.id, title: bet.title, reason: decision.reason });
          }
          continue;
        }

        const overdue = now.getTime() - Date.parse(bet.ends_at) > HOLD_AFTER_MS;
        const lastFlag = Date.parse(bet.settlement_hold?.flagged_at ?? '');
        const flaggedRecently =
          Number.isFinite(lastFlag) && now.getTime() - lastFlag < HOLD_REPEAT_MS;
        if ((decision.action === 'hold' || overdue) && !flaggedRecently) {
          const reason =
            decision.action === 'hold'
              ? decision.reason
              : `Polymarket nie rozstrzygnął rynku 48h po starcie (${decision.reason})`;
          if (!dryRun) {
            const currentRunId = await ensureRun();
            await deps.rpc('agent_flag_settlement_hold', {
              p_bet_id: bet.id,
              p_reason: reason,
              p_run_id: currentRunId,
            });
          }
          held.push({ id: bet.id, title: bet.title, reason });
          continue;
        }

        waiting += 1;
      } catch (error) {
        errors.push({ id: bet.id, title: bet.title, error: errorMessage(error) });
      }
    }
  } catch (error) {
    await ensureRun();
    await finishRun(
      deps,
      runId,
      'failed',
      { settled: settled.length + refunded.length, held: held.length },
      { auto_bets: true, error: errorMessage(error), settled, refunded, held, errors },
      `Auto-bets: rozliczanie przerwane: ${errorMessage(error)}`,
    );
    throw error;
  }

  if (errors.length > 0) {
    await ensureRun();
  }
  const result = { checked, settled, refunded, held, waiting, errors };
  await finishRun(
    deps,
    runId,
    errors.length > 0 ? 'partial' : 'ok',
    { settled: settled.length + refunded.length, held: held.length },
    { auto_bets: true, ...result },
    `Auto-bets: rozliczono ${settled.length}, zwroty ${refunded.length}, wstrzymano ${held.length}, czeka ${waiting}, błędy ${errors.length}.`,
  );
  return result;
}

export async function runCreation(deps: RunnerDeps, now: Date, dryRun: boolean) {
  // Opened first so a run that dies on its first read still leaves a row.
  const runId = dryRun ? null : await startRun(deps, 'create');
  try {
    return await createMarkets(deps, now, dryRun, runId);
  } catch (error) {
    await finishRun(
      deps,
      runId,
      'failed',
      { created: 0 },
      { auto_bets: true, error: errorMessage(error) },
      `Auto-bets: tworzenie przerwane: ${errorMessage(error)}`,
    );
    throw error;
  }
}

async function createMarkets(deps: RunnerDeps, now: Date, dryRun: boolean, runId: string | null) {
  const context = await deps.rpc<{
    categories: CategoryRow[];
    activeBets: PublishedBet[];
    historicalBets: PublishedBet[];
  }>('agent_get_bet_context', { p_recent_bet_limit: 1, p_history_limit: HISTORY_LIMIT });
  const categoryIdBySlug = new Map(
    context.categories
      .filter((category) => category.slug)
      .map((category) => [category.slug as string, category.id]),
  );
  // Settled markets are inactive and only appear in the (newest-first)
  // history; 500 rows covers the 48h window at the current volume.
  const published = [...context.activeBets, ...(context.historicalBets ?? [])]
    .filter((bet) => bet.event_key?.startsWith('pm:'))
    .map((bet) => ({ categoryId: bet.category_id, eventKey: bet.event_key, startsAt: bet.ends_at }));

  const candidates: Candidate[] = [];
  const rejected: Record<string, number> = {};
  const fetchErrors: { league: string; error: string }[] = [];

  for (const leagues of chunk(LEAGUES, 5)) {
    await Promise.all(
      leagues.map(async (league) => {
        try {
          const events = await fetchUpcomingEvents(deps, league.seriesId, now);
          for (const event of events) {
            const result = buildCandidate(event, league, { now });
            if (result.ok === true) {
              candidates.push(result.candidate);
            } else if (result.ok === false) {
              rejected[result.reason] = (rejected[result.reason] ?? 0) + 1;
            }
          }
        } catch (error) {
          fetchErrors.push({ league: league.key, error: errorMessage(error) });
        }
      }),
    );
  }

  // A market without its category would vanish from the sport and league
  // filters, so those games wait until the category exists again.
  const missingCategories = [
    ...new Set(
      candidates
        .map((candidate) => candidate.categorySlug)
        .filter((slug) => !categoryIdBySlug.has(slug)),
    ),
  ];
  const categorized = candidates.filter((candidate) => categoryIdBySlug.has(candidate.categorySlug));
  const { selected, capped } = selectCandidates(categorized, LEAGUES, published, categoryIdBySlug);
  const bets = selected.map((candidate) => ({
    ...candidate.bet,
    category_id: categoryIdBySlug.get(candidate.categorySlug) as string,
  }));

  const created: { id: string; title: string }[] = [];
  const skipped: unknown[] = [];
  const errors: unknown[] = [];

  if (!dryRun) {
    for (const batch of chunk(bets, CREATE_CHUNK)) {
      try {
        const result = await deps.rpc<{
          created: { id: string; title: string }[];
          skipped: unknown[];
          errors: unknown[];
        }>('agent_create_bets', { p_bets: batch });
        created.push(...result.created.map(({ id, title }) => ({ id, title })));
        skipped.push(...result.skipped);
        errors.push(...result.errors);
      } catch (error) {
        errors.push({ batch: batch.map((bet) => bet.title), error: errorMessage(error) });
      }
    }
  }

  const result = {
    candidates: candidates.length,
    selected: selected.length,
    capped: capped.length,
    rejected,
    fetch_errors: fetchErrors,
    missing_categories: missingCategories,
    created,
    skipped,
    errors,
    ...(dryRun
      ? {
          would_create: selected.map((candidate) => ({
            title: candidate.bet.title,
            category: candidate.categorySlug,
            ends_at: candidate.bet.ends_at,
            options: candidate.bet.options,
          })),
        }
      : {}),
  };

  const degraded = errors.length > 0 || fetchErrors.length > 0 || missingCategories.length > 0;
  await finishRun(
    deps,
    runId,
    degraded ? 'partial' : 'ok',
    { created: created.length },
    { auto_bets: true, ...result },
    `Auto-bets: nowe rynki ${created.length}, pominięte ${skipped.length}, poza limitem ${capped.length}, błędy ${errors.length + fetchErrors.length}, brak kategorii ${missingCategories.length}.`,
  );
  return result;
}
