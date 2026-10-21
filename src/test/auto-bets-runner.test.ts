import { describe, expect, it } from 'vitest';

import type { GammaEvent, GammaMarket } from '../../supabase/functions/auto-bets/core';
import { runCreation, runSettlement, type RunnerDeps } from '../../supabase/functions/auto-bets/runner';

const NOW = new Date('2026-10-14T10:00:00Z');

function market(id: string, groupItemTitle: string, bid: number): GammaMarket {
  return {
    id,
    groupItemTitle,
    outcomes: '["Yes", "No"]',
    bestBid: bid,
    bestAsk: bid + 0.02,
    liquidityNum: 8000,
    sportsMarketType: 'moneyline',
    active: true,
    closed: false,
  };
}

function ekstraklasaGame(id: string, home: string, away: string): GammaEvent {
  return {
    id,
    slug: `pol-${id}`,
    title: `${home} vs. ${away}`,
    startTime: '2026-10-15T18:30:00Z',
    markets: [market(`${id}-h`, home, 0.4), market(`${id}-d`, `Draw (${home} vs. ${away})`, 0.26), market(`${id}-a`, away, 0.3)],
  };
}

interface Call {
  name: string;
  params: Record<string, unknown>;
}

function fakeDeps(responses: Record<string, unknown>, gammaResponses: Record<string, unknown> = {}) {
  const calls: Call[] = [];
  const gammaPaths: string[] = [];
  const deps: RunnerDeps = {
    async rpc<T>(name: string, params: Record<string, unknown>) {
      calls.push({ name, params });
      return (responses[name] ?? null) as T;
    },
    async gamma<T>(path: string) {
      gammaPaths.push(path);
      const match = Object.keys(gammaResponses).find((prefix) => path.startsWith(prefix));
      return (match ? gammaResponses[match] : []) as T;
    },
  };
  return { deps, calls, gammaPaths };
}

const context = {
  categories: [
    { id: 'cat-ekstraklasa', slug: 'football-ekstraklasa' },
    { id: 'cat-football', slug: 'football' },
  ],
  activeBets: [{ ends_at: '2026-10-15T18:30:00Z', event_key: 'pm:already', category_id: 'cat-ekstraklasa' }],
  historicalBets: [],
};

describe('runCreation', () => {
  it('publishes new games into the league category and skips games already on the board', async () => {
    const { deps, calls } = fakeDeps(
      {
        agent_get_bet_context: context,
        agent_start_run: { run_id: 'run-1' },
        agent_create_bets: { created: [{ id: 'bet-1', title: 'x' }], skipped: [], errors: [] },
      },
      {
        '/events?series_id=12320&': [
          ekstraklasaGame('new', 'Widzew Lodz', 'Wisla Krakow'),
          ekstraklasaGame('already', 'Legia Warszawa', 'Lech Poznan'),
        ],
      },
    );

    await runCreation(deps, NOW, false);

    const create = calls.filter((call) => call.name === 'agent_create_bets');
    expect(create).toHaveLength(1);
    const bets = create[0].params.p_bets as Array<{ title: string; category_id: string | null }>;
    expect(bets.map((bet) => [bet.title, bet.category_id])).toEqual([
      ['Ekstraklasa: Widzew Łódź - Wisła Kraków', 'cat-ekstraklasa'],
    ]);
    expect(calls.find((call) => call.name === 'agent_finish_run')?.params).toMatchObject({
      p_run_id: 'run-1',
      p_status: 'ok',
      p_counts: { created: 1 },
    });
  });

  it('holds games back when their category is missing and marks the run partial', async () => {
    const { deps, calls } = fakeDeps(
      {
        agent_get_bet_context: { ...context, categories: [] },
        agent_start_run: { run_id: 'run-4' },
      },
      { '/events?series_id=12320&': [ekstraklasaGame('new', 'Widzew Lodz', 'Wisla Krakow')] },
    );

    await runCreation(deps, NOW, false);

    expect(calls.some((call) => call.name === 'agent_create_bets')).toBe(false);
    expect(calls.find((call) => call.name === 'agent_finish_run')?.params).toMatchObject({ p_status: 'partial' });
  });

  it('records a failed run when the first read fails', async () => {
    const { deps, calls } = fakeDeps({ agent_start_run: { run_id: 'run-5' } });
    deps.rpc = (async (name: string, params: Record<string, unknown>) => {
      calls.push({ name, params });
      if (name === 'agent_get_bet_context') throw new Error('boom');
      return name === 'agent_start_run' ? { run_id: 'run-5' } : null;
    }) as RunnerDeps['rpc'];

    await expect(runCreation(deps, NOW, false)).rejects.toThrow('boom');
    expect(calls.find((call) => call.name === 'agent_finish_run')?.params).toMatchObject({
      p_run_id: 'run-5',
      p_status: 'failed',
    });
  });

  it('writes nothing in a dry run', async () => {
    const { deps, calls } = fakeDeps(
      { agent_get_bet_context: context },
      { '/events?series_id=12320&': [ekstraklasaGame('new', 'Widzew Lodz', 'Wisla Krakow')] },
    );

    const result = await runCreation(deps, NOW, true);

    expect(calls.map((call) => call.name)).toEqual(['agent_get_bet_context']);
    expect(result.selected).toBe(1);
  });
});

describe('runSettlement', () => {
  const source = (marketId: string) => ({
    provider: 'polymarket',
    league: 'pol',
    event_id: marketId,
    kind: '1x2',
    url: 'https://polymarket.com/event/pol-1',
    outcomes: [
      { option: 'Widzew Łódź', market_id: `${marketId}-h`, outcome_index: 0 },
      { option: 'Remis', market_id: `${marketId}-d`, outcome_index: 0 },
      { option: 'Wisła Kraków', market_id: `${marketId}-a`, outcome_index: 0 },
    ],
  });

  const resolvedMarket = (id: string, prices: [string, string]) => ({
    id,
    closed: true,
    umaResolutionStatus: 'resolved',
    outcomePrices: JSON.stringify(prices),
  });

  it('settles resolved games, flags long-unresolved ones and ignores other bets', async () => {
    const { deps, calls, gammaPaths } = fakeDeps(
      {
        agent_get_pending_settlement_context: {
          has_more: false,
          next_offset: 0,
          bets: [
            { id: 'bet-done', title: 'done', ends_at: '2026-10-14T06:00:00Z', winning_option: null, event_key: 'pm:g1', odds_source: source('g1'), settlement_hold: null },
            { id: 'bet-stuck', title: 'stuck', ends_at: '2026-10-11T06:00:00Z', winning_option: null, event_key: 'pm:g2', odds_source: source('g2'), settlement_hold: null },
            { id: 'bet-future', title: 'future', ends_at: '2026-10-14T20:00:00Z', winning_option: null, event_key: 'pm:g3', odds_source: source('g3'), settlement_hold: null },
            { id: 'bet-manual', title: 'manual', ends_at: '2026-10-14T06:00:00Z', winning_option: null, event_key: null, odds_source: null, settlement_hold: null },
            // Polymarket metadata on a market the bot did not publish.
            { id: 'bet-foreign', title: 'foreign', ends_at: '2026-10-14T06:00:00Z', winning_option: null, event_key: 'manual-1', odds_source: source('g1'), settlement_hold: null },
          ],
        },
        agent_start_run: { run_id: 'run-2' },
      },
      {
        '/markets?closed=true': [
          resolvedMarket('g1-h', ['0', '1']),
          resolvedMarket('g1-d', ['1', '0']),
          resolvedMarket('g1-a', ['0', '1']),
        ],
      },
    );

    const result = await runSettlement(deps, NOW, false);

    expect(calls.filter((call) => call.name === 'agent_settle_bet').map((call) => call.params)).toEqual([
      expect.objectContaining({
        p_bet_id: 'bet-done',
        p_winning_options: ['Remis'],
        p_mode: 'normal',
        p_scope: 'pending_only',
        p_evidence: expect.objectContaining({ require_unsettled: true }),
      }),
    ]);
    expect(calls.filter((call) => call.name === 'agent_flag_settlement_hold').map((call) => call.params.p_bet_id)).toEqual([
      'bet-stuck',
    ]);
    expect(gammaPaths.join(' ')).not.toContain('g3-h');
    expect(result.waiting).toBe(0);
  });

  it('does not re-flag a conflicting result flagged less than a day ago', async () => {
    const { deps, calls } = fakeDeps(
      {
        agent_get_pending_settlement_context: {
          has_more: false,
          next_offset: 0,
          bets: [
            { id: 'bet-conflict', title: 'conflict', ends_at: '2026-10-14T06:00:00Z', winning_option: null, event_key: 'pm:g1', odds_source: source('g1'), settlement_hold: { flagged_at: '2026-10-14T09:40:00Z' } },
          ],
        },
      },
      {
        '/markets?closed=true': [
          resolvedMarket('g1-h', ['1', '0']),
          resolvedMarket('g1-d', ['1', '0']),
          resolvedMarket('g1-a', ['0', '1']),
        ],
      },
    );

    await runSettlement(deps, NOW, false);

    expect(calls.some((call) => call.name === 'agent_flag_settlement_hold')).toBe(false);
  });

  it('refunds a voided game without naming a winner', async () => {
    const { deps, calls } = fakeDeps(
      {
        agent_get_pending_settlement_context: {
          has_more: false,
          next_offset: 0,
          bets: [
            { id: 'bet-void', title: 'void', ends_at: '2026-10-14T06:00:00Z', winning_option: null, event_key: 'pm:g1', odds_source: source('g1'), settlement_hold: null },
          ],
        },
        agent_start_run: { run_id: 'run-3' },
      },
      {
        '/markets?closed=true': [
          resolvedMarket('g1-h', ['0.5', '0.5']),
          resolvedMarket('g1-d', ['0.5', '0.5']),
          resolvedMarket('g1-a', ['0.5', '0.5']),
        ],
      },
    );

    await runSettlement(deps, NOW, false);

    expect(calls.find((call) => call.name === 'agent_settle_bet')?.params).toMatchObject({
      p_bet_id: 'bet-void',
      p_winning_options: [],
      p_mode: 'refund',
    });
  });
});
