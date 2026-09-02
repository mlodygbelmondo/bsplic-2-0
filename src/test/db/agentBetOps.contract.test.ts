// @vitest-environment node
import { createHash, randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createDbPool,
  createServiceClient,
  createTestUser,
  dbTestEnv,
  deleteTestUsers,
  type TestUser,
} from './dbTestClient';

// Behavioral contract tests for the autonomous agent RPCs. They call the same
// interface the cloud runner calls (anon key + token argument) against a local
// Supabase stack. See src/test/db/README.md for setup.

const AGENT_SCOPES = [
  'read:bets',
  'create:proposals',
  'accept:proposals',
  'create:bets',
  'read:settlement',
  'settle:bets',
  'manage:ako',
  'manage:runs',
];

interface BetInput {
  title: string;
  bet_type: string;
  options: Array<{ name: string; odds: number }>;
  ends_at: string;
  event_key?: string;
  agent_duplicate_key?: string;
  ako_ref?: string;
  ako_exclusions?: Array<Record<string, unknown>>;
  agent_metadata?: Record<string, unknown>;
}

function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

describe('autonomous agent bet ops RPC contract', () => {
  const runTag = randomUUID().slice(0, 8);
  let service: SupabaseClient;
  let anon: SupabaseClient;
  let pool: Pool;
  let agentUser: TestUser;
  let punter: TestUser;
  let admin: TestUser;
  let token: string;

  const createdBetIds = new Set<string>();

  async function callAgentRpc<T = unknown>(
    name: string,
    params: Record<string, unknown>,
  ): Promise<T> {
    const { data, error } = await anon.rpc(name, { p_token: token, ...params });
    if (error) {
      throw new Error(`${name} failed: ${error.message}`);
    }
    return data as T;
  }

  async function createBets(bets: BetInput[]) {
    const scheduleObservedAt = new Date().toISOString();
    const sourcedBets = bets.map((bet) => ({
      ...bet,
      agent_metadata: {
        event_starts_at: bet.ends_at,
        schedule_source: {
          provider: 'Contract test schedule',
          url: 'https://example.test/schedule',
          observed_at: scheduleObservedAt,
          displayed_start: bet.ends_at,
          timezone: 'UTC',
        },
        ...(bet.agent_metadata ?? {}),
      },
    }));
    const result = await callAgentRpc<{
      created: Array<{ id: string; title: string; ako_ref: string | null }>;
      skipped: Array<{ title: string; reason: string }>;
      errors: Array<{ title?: string; reason: string }>;
      ako_created: Array<{ bet_id_a: string; bet_id_b: string }>;
      ako_unresolved: Array<Record<string, unknown>>;
    }>('agent_create_bets', { p_bets: sourcedBets });

    for (const row of result.created) {
      createdBetIds.add(row.id);
    }
    return result;
  }

  beforeAll(async () => {
    service = createServiceClient();
    pool = createDbPool();
    anon = createClient(dbTestEnv.url, dbTestEnv.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    agentUser = await createTestUser(service, `agent-${runTag}`);
    punter = await createTestUser(service, `punter-${runTag}`);
    admin = await createTestUser(service, `admin-${runTag}`);

    await pool.query(
      `INSERT INTO public.user_roles (user_id, role) VALUES ($1, 'admin')
       ON CONFLICT DO NOTHING`,
      [admin.id],
    );

    await pool.query(
      `UPDATE public.profiles SET balance = 1000 WHERE id = $1`,
      [punter.id],
    );

    token = `test-agent-token-${runTag}`;
    const tokenHash = createHash('sha256').update(token).digest('hex');

    await pool.query(
      `INSERT INTO private.agent_api_tokens (token_hash, label, agent_user_id, scopes, is_active)
       VALUES ($1, $2, $3, $4, true)`,
      [tokenHash, `contract-test-${runTag}`, agentUser.id, AGENT_SCOPES],
    );
  }, 90_000);

  afterAll(async () => {
    if (!pool) {
      return;
    }

    if (createdBetIds.size > 0) {
      await pool.query(`DELETE FROM public.bets WHERE id = ANY($1::uuid[])`, [
        Array.from(createdBetIds),
      ]);
    }

    await pool.query(`DELETE FROM private.agent_api_tokens WHERE label = $1`, [
      `contract-test-${runTag}`,
    ]);

    if (service) {
      await deleteTestUsers(
        service,
        [agentUser, punter, admin].filter(Boolean),
      );
    }

    await pool.end();
  }, 60_000);

  // The regression that blocked tournament days: option signatures are built
  // from option NAMES only, so eight 1x2 markets named 1/X/2 used to collide
  // with each other and seven were dropped as "approximate duplicate".
  it('creates every distinct 1x2 market on the same day', async () => {
    const fixtures = [
      'Polska - Brazylia',
      'Niemcy - Hiszpania',
      'Francja - Argentyna',
      'Anglia - Portugalia',
      'Włochy - Holandia',
      'Belgia - Chorwacja',
      'Urugwaj - Meksyk',
      'Japonia - Senegal',
    ];

    const payload: BetInput[] = fixtures.map((fixture, index) => ({
      title: `${fixture} — zwycięzca meczu [${runTag}]`,
      bet_type: '1x2',
      options: [
        { name: '1', odds: 2.4 },
        { name: 'X', odds: 3.3 },
        { name: '2', odds: 2.85 },
      ],
      ends_at: hoursFromNow(24 + index),
      event_key: `wc-${runTag}:fixture-${index}`,
      agent_duplicate_key: `wc-${runTag}:fixture-${index}:1x2`,
    }));

    const result = await createBets(payload);

    expect(result.errors).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(result.created).toHaveLength(8);
  }, 60_000);

  it('is idempotent on a re-run via agent_duplicate_key', async () => {
    const payload: BetInput[] = [
      {
        title: `Idempotency probe [${runTag}]`,
        bet_type: '12',
        options: [
          { name: 'Tak', odds: 1.8 },
          { name: 'Nie', odds: 2.0 },
        ],
        ends_at: hoursFromNow(30),
        agent_duplicate_key: `idempotency-${runTag}`,
      },
    ];

    const first = await createBets(payload);
    expect(first.created).toHaveLength(1);

    const second = await createBets(payload);
    expect(second.created).toHaveLength(0);
    expect(second.skipped).toHaveLength(1);
    expect(second.skipped[0].reason).toContain('agent_duplicate_key');
  }, 60_000);

  it('rejects a close time moved past the verified event start', async () => {
    const verifiedStart = hoursFromNow(6);
    const result = await createBets([
      {
        title: `Shifted event start probe [${runTag}]`,
        bet_type: '12',
        options: [
          { name: 'A', odds: 1.8 },
          { name: 'B', odds: 2.0 },
        ],
        ends_at: hoursFromNow(30),
        agent_duplicate_key: `shifted-start-${runTag}`,
        agent_metadata: {
          event_starts_at: verifiedStart,
        },
      },
    ]);

    expect(result.created).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].reason).toContain(
      'ends_at must exactly equal event_starts_at',
    );
  }, 60_000);

  it('persists provenance on directly created bets', async () => {
    const key = `provenance-${runTag}`;
    const result = await createBets([
      {
        title: `Provenance probe [${runTag}]`,
        bet_type: '12',
        options: [
          { name: 'A', odds: 1.9 },
          { name: 'B', odds: 1.9 },
        ],
        ends_at: hoursFromNow(31),
        event_key: `event-${key}`,
        agent_duplicate_key: key,
        agent_metadata: {
          odds_source: {
            bookmaker: 'TestBook',
            url: 'https://example.test/event',
            observed_at: '2026-07-26T09:00:00Z',
          },
        },
      },
    ]);

    expect(result.created).toHaveLength(1);

    const { rows } = await pool.query(
      `SELECT agent_duplicate_key, event_key, agent_metadata
         FROM public.bets WHERE id = $1`,
      [result.created[0].id],
    );

    expect(rows[0].agent_duplicate_key).toBe(key);
    expect(rows[0].event_key).toBe(`event-${key}`);
    expect(rows[0].agent_metadata.odds_source.bookmaker).toBe('TestBook');
  }, 60_000);

  // The core anti-arbitrage path: the agent links correlated markets at
  // creation time, and coupon placement refuses to combine them.
  it('creates AKO exclusions in the same request and blocks the coupon', async () => {
    const result = await createBets([
      {
        title: `AKO A — zwycięzca [${runTag}]`,
        bet_type: '12',
        options: [
          { name: 'Gospodarze', odds: 1.75 },
          { name: 'Goście', odds: 2.05 },
        ],
        ends_at: hoursFromNow(12),
        event_key: `ako-${runTag}`,
        agent_duplicate_key: `ako-${runTag}:winner`,
        ako_ref: 'ako-a',
        ako_exclusions: [
          { ref: 'ako-b', reason: 'ten sam mecz — skorelowane rynki' },
        ],
      },
      {
        title: `AKO B — liczba goli [${runTag}]`,
        bet_type: '12',
        options: [
          { name: 'Over 2.5', odds: 1.9 },
          { name: 'Under 2.5', odds: 1.9 },
        ],
        ends_at: hoursFromNow(12),
        event_key: `ako-${runTag}`,
        agent_duplicate_key: `ako-${runTag}:goals`,
        ako_ref: 'ako-b',
      },
    ]);

    expect(result.created).toHaveLength(2);
    expect(result.ako_unresolved).toEqual([]);
    expect(result.ako_created).toHaveLength(1);

    const betA = result.created.find((row) => row.ako_ref === 'ako-a')!;
    const betB = result.created.find((row) => row.ako_ref === 'ako-b')!;

    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM public.bet_ako_exclusions
        WHERE LEAST(bet_id_a, bet_id_b) = LEAST($1::uuid, $2::uuid)
          AND GREATEST(bet_id_a, bet_id_b) = GREATEST($1::uuid, $2::uuid)`,
      [betA.id, betB.id],
    );
    expect(rows[0].count).toBe(1);

    const { error } = await punter.client.rpc('place_bet_secure', {
      p_user_id: punter.id,
      p_total_odds: 1.75 * 1.9,
      p_stake: 20,
      p_items: [
        { betId: betA.id, selectedOption: 'Gospodarze', stake: 10 },
        { betId: betB.id, selectedOption: 'Over 2.5', stake: 10 },
      ],
    });

    expect(error).not.toBeNull();
    expect(error?.message).toContain('AKO');
  }, 60_000);

  // Batch creation must not delete pairs written moments earlier, which is why
  // it uses the additive helper rather than wholesale replacement.
  it('keeps earlier exclusion pairs when a later bet links to the same market', async () => {
    const first = await createBets([
      {
        title: `Additive A [${runTag}]`,
        bet_type: '12',
        options: [
          { name: 'A1', odds: 1.9 },
          { name: 'A2', odds: 1.9 },
        ],
        ends_at: hoursFromNow(14),
        agent_duplicate_key: `additive-${runTag}:a`,
        ako_ref: 'add-a',
        ako_exclusions: [{ ref: 'add-b' }],
      },
      {
        title: `Additive B [${runTag}]`,
        bet_type: '12',
        options: [
          { name: 'B1', odds: 1.9 },
          { name: 'B2', odds: 1.9 },
        ],
        ends_at: hoursFromNow(14),
        agent_duplicate_key: `additive-${runTag}:b`,
        ako_ref: 'add-b',
      },
    ]);

    const betA = first.created.find((row) => row.ako_ref === 'add-a')!;

    const second = await createBets([
      {
        title: `Additive C [${runTag}]`,
        bet_type: '12',
        options: [
          { name: 'C1', odds: 1.9 },
          { name: 'C2', odds: 1.9 },
        ],
        ends_at: hoursFromNow(14),
        agent_duplicate_key: `additive-${runTag}:c`,
        ako_ref: 'add-c',
        ako_exclusions: [{ agent_duplicate_key: `additive-${runTag}:a` }],
      },
    ]);

    expect(second.ako_created).toHaveLength(1);

    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM public.bet_ako_exclusions
        WHERE bet_id_a = $1 OR bet_id_b = $1`,
      [betA.id],
    );
    expect(rows[0].count).toBe(2);
  }, 60_000);

  it('lets the agent replace exclusions after the fact', async () => {
    const result = await createBets([
      {
        title: `Correction A [${runTag}]`,
        bet_type: '12',
        options: [
          { name: 'X1', odds: 1.9 },
          { name: 'X2', odds: 1.9 },
        ],
        ends_at: hoursFromNow(16),
        agent_duplicate_key: `correction-${runTag}:a`,
      },
      {
        title: `Correction B [${runTag}]`,
        bet_type: '12',
        options: [
          { name: 'Y1', odds: 1.9 },
          { name: 'Y2', odds: 1.9 },
        ],
        ends_at: hoursFromNow(16),
        agent_duplicate_key: `correction-${runTag}:b`,
      },
    ]);

    const [betA, betB] = result.created;

    const exclusions = await callAgentRpc<Array<{ betId: string }>>(
      'agent_set_bet_ako_exclusions',
      {
        p_bet_id: betA.id,
        p_exclusions: [{ betId: betB.id, reason: 'korekta po fakcie' }],
      },
    );

    expect(exclusions).toHaveLength(1);
    expect(exclusions[0].betId).toBe(betB.id);
  }, 60_000);

  it('keeps the admin exclusion path role-gated and wholesale', async () => {
    const result = await createBets([
      {
        title: `Admin path A [${runTag}]`,
        bet_type: '12',
        options: [
          { name: 'P', odds: 1.9 },
          { name: 'Q', odds: 1.9 },
        ],
        ends_at: hoursFromNow(18),
        agent_duplicate_key: `adminpath-${runTag}:a`,
      },
      {
        title: `Admin path B [${runTag}]`,
        bet_type: '12',
        options: [
          { name: 'R', odds: 1.9 },
          { name: 'S', odds: 1.9 },
        ],
        ends_at: hoursFromNow(18),
        agent_duplicate_key: `adminpath-${runTag}:b`,
      },
    ]);

    const [betA, betB] = result.created;

    const denied = await punter.client.rpc('admin_replace_bet_ako_exclusions', {
      p_bet_id: betA.id,
      p_exclusions: [{ betId: betB.id }],
    });
    expect(denied.error).not.toBeNull();

    const allowed = await admin.client.rpc('admin_replace_bet_ako_exclusions', {
      p_bet_id: betA.id,
      p_exclusions: [{ betId: betB.id, reason: 'admin' }],
    });
    expect(allowed.error).toBeNull();
    expect(allowed.data).toHaveLength(1);

    const cleared = await admin.client.rpc('admin_replace_bet_ako_exclusions', {
      p_bet_id: betA.id,
      p_exclusions: [],
    });
    expect(cleared.error).toBeNull();
    expect(cleared.data).toHaveLength(0);
  }, 60_000);

  it('records settlement evidence and clears a prior hold', async () => {
    const result = await createBets([
      {
        title: `Settlement probe [${runTag}]`,
        bet_type: '12',
        options: [
          { name: 'Gospodarze', odds: 1.8 },
          { name: 'Goście', odds: 2.0 },
        ],
        ends_at: hoursFromNow(1),
        agent_duplicate_key: `settlement-${runTag}`,
      },
    ]);

    const betId = result.created[0].id;

    await callAgentRpc('agent_flag_settlement_hold', {
      p_bet_id: betId,
      p_reason: 'brak potwierdzonego wyniku',
      p_run_id: null,
    });

    const held = await pool.query(
      `SELECT agent_metadata -> 'settlement_hold' AS hold FROM public.bets WHERE id = $1`,
      [betId],
    );
    expect(held.rows[0].hold.reason).toBe('brak potwierdzonego wyniku');
    expect(held.rows[0].hold.attempts).toBe(1);

    await pool.query(
      `UPDATE public.bets SET ends_at = NOW() - INTERVAL '1 hour' WHERE id = $1`,
      [betId],
    );

    await callAgentRpc('agent_settle_bet', {
      p_bet_id: betId,
      p_winning_options: ['Gospodarze'],
      p_mode: 'normal',
      p_scope: 'pending_only',
      p_evidence: {
        sources: ['https://example.test/result'],
        confidence: 'high',
      },
    });

    const settled = await pool.query(
      `SELECT winning_option,
              agent_metadata -> 'settlement' AS settlement,
              agent_metadata ? 'settlement_hold' AS still_held
         FROM public.bets WHERE id = $1`,
      [betId],
    );

    expect(settled.rows[0].winning_option).toBe('Gospodarze');
    expect(settled.rows[0].settlement.confidence).toBe('high');
    expect(settled.rows[0].settlement.settled_by).toBe('agent');
    expect(settled.rows[0].still_held).toBe(false);
  }, 60_000);

  it('brackets a run in the audit table', async () => {
    const started = await callAgentRpc<{ run_id: string }>('agent_start_run', {
      p_kind: 'daily',
    });

    expect(started.run_id).toBeTruthy();

    const finished = await callAgentRpc<{
      status: string;
      created_count: number;
      summary: Record<string, unknown>;
    }>('agent_finish_run', {
      p_run_id: started.run_id,
      p_status: 'partial',
      p_counts: { created: 3, settled: 2, held: 1 },
      p_summary: { unexcluded_same_event_pairs: [] },
      p_report: 'contract test',
    });

    expect(finished.status).toBe('partial');
    expect(finished.created_count).toBe(3);

    // Reads it back through PostgREST, not the DB seam: a STABLE agent RPC is
    // executed in a read-only transaction and dies on the `last_used_at` update
    // inside require_agent_scope. This call is what catches that.
    const recent = await callAgentRpc<Array<{ id: string; status: string }>>(
      'agent_get_recent_runs',
      { p_limit: 5 },
    );

    expect(recent.some((run) => run.id === started.run_id)).toBe(true);

    await pool.query(`DELETE FROM public.agent_runs WHERE id = $1`, [
      started.run_id,
    ]);
  }, 60_000);

  it('surfaces AKO pairs and provenance in the agent context', async () => {
    const context = await callAgentRpc<{
      akoExclusions: Array<{ bet_id_a: string; bet_id_b: string }>;
      activeBets: Array<{ id: string; event_key: string | null }>;
    }>('agent_get_bet_context', {
      p_recent_bet_limit: 10,
      p_history_limit: 50,
    });

    expect(Array.isArray(context.akoExclusions)).toBe(true);
    expect(
      context.activeBets.some((bet) => bet.event_key?.startsWith(`ako-${runTag}`)),
    ).toBe(true);
  }, 60_000);
});
