// @vitest-environment node
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createDbPool,
  createServiceClient,
  createTestUser,
  deleteTestUsers,
  getProfileBalance,
  type TestUser,
} from './dbTestClient';

// Behavioral contract tests for request ids on `place_bet_secure` and
// `place_roulette_table_bet` (a retry after a lost response must not charge
// twice) and for the coupon odds check, against a local Supabase stack.
// See src/test/db/README.md for setup.
describe('idempotent placement RPC contract', () => {
  let service: SupabaseClient;
  let pool: Pool;
  let admin: TestUser;
  const players: TestUser[] = [];
  const createdBetIds: string[] = [];
  const endsAt = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  async function createBet(title: string, oddsA: number): Promise<string> {
    const { data, error } = await admin.client.rpc('admin_create_bet_with_ako_exclusions', {
      p_title: title,
      p_category_id: null,
      p_bet_type: '12',
      p_options: [
        { name: 'A', odds: oddsA },
        { name: 'B', odds: 1.8 },
      ],
      p_ends_at: endsAt(),
    });
    expect(error).toBeNull();
    createdBetIds.push(data as string);
    return data as string;
  }

  async function setOddsA(betId: string, title: string, oddsA: number) {
    const { error } = await admin.client.rpc('admin_update_bet_with_ako_exclusions', {
      p_bet_id: betId,
      p_title: title,
      p_category_id: null,
      p_bet_type: '12',
      p_options: [
        { name: 'A', odds: oddsA },
        { name: 'B', odds: 1.8 },
      ],
      p_ends_at: endsAt(),
    });
    expect(error).toBeNull();
  }

  async function createPlayer(label: string): Promise<TestUser> {
    const player = await createTestUser(service, label);
    players.push(player);
    return player;
  }

  function placeSingle(
    player: TestUser,
    betId: string,
    stake: number,
    extra: { p_request_id?: string; p_check_odds?: boolean; odds?: number } = {},
  ) {
    const { odds, ...params } = extra;
    return player.client.rpc('place_bet_secure', {
      p_user_id: player.id,
      p_total_odds: 1,
      p_stake: stake,
      p_items: [{ betId, selectedOption: 'A', stake, ...(odds === undefined ? {} : { odds }) }],
      ...params,
    });
  }

  async function countCoupons(userId: string): Promise<number> {
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS count FROM public.coupons WHERE user_id = $1`, [userId]);
    return rows[0].count;
  }

  beforeAll(async () => {
    service = createServiceClient();
    pool = createDbPool();
    admin = await createTestUser(service, 'idem-admin');
    // No interface grants roles; the admin seat is provisioned directly.
    await pool.query(`INSERT INTO public.user_roles (user_id, role) VALUES ($1, 'admin')`, [admin.id]);
  }, 60_000);

  afterAll(async () => {
    if (!service || !pool) return;
    await deleteTestUsers(service, [...players, admin].filter(Boolean));
    if (createdBetIds.length > 0) {
      await pool.query(`DELETE FROM public.bets WHERE id = ANY($1::uuid[])`, [createdBetIds]);
    }
    await pool.end();
  });

  it('places a coupon once when the same request id is sent twice', async () => {
    const betId = await createBet('Idempotencja - kupon', 2.5);
    const player = await createPlayer('idem-coupon');
    const requestId = randomUUID();

    const first = await placeSingle(player, betId, 10, { p_request_id: requestId });
    const retry = await placeSingle(player, betId, 10, { p_request_id: requestId });

    expect(first.error).toBeNull();
    expect(retry.error).toBeNull();
    expect(retry.data).toBe(first.data);
    expect(await countCoupons(player.id)).toBe(1);
    expect(await getProfileBalance(pool, player.id)).toBe(490);
  }, 60_000);

  it('returns the placed coupon on retry even when the balance no longer covers the stake', async () => {
    const betId = await createBet('Idempotencja - saldo', 2);
    const player = await createPlayer('idem-balance');
    const requestId = randomUUID();

    const first = await placeSingle(player, betId, 400, { p_request_id: requestId });
    const retry = await placeSingle(player, betId, 400, { p_request_id: requestId });

    expect(first.error).toBeNull();
    expect(retry.error).toBeNull();
    expect(retry.data).toBe(first.data);
    expect(await getProfileBalance(pool, player.id)).toBe(100);
  }, 60_000);

  it('keeps placing a new coupon per call without a request id (web client)', async () => {
    const betId = await createBet('Idempotencja - web', 2);
    const player = await createPlayer('idem-web');

    const first = await placeSingle(player, betId, 5);
    const second = await placeSingle(player, betId, 5);

    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
    expect(second.data).not.toBe(first.data);
    expect(await countCoupons(player.id)).toBe(2);
  }, 60_000);

  it('rejects a coupon whose odds changed when the client asks for the check', async () => {
    const title = 'Idempotencja - zmiana kursu';
    const betId = await createBet(title, 2.05);
    const player = await createPlayer('idem-odds');
    await setOddsA(betId, title, 1.95);

    const stale = await placeSingle(player, betId, 10, { p_check_odds: true, odds: 2.05 });

    expect(stale.error?.hint).toBe('odds_changed');
    expect(await countCoupons(player.id)).toBe(0);
    expect(await getProfileBalance(pool, player.id)).toBe(500);

    const current = await placeSingle(player, betId, 10, { p_check_odds: true, odds: 1.95 });
    expect(current.error).toBeNull();
    const { rows } = await pool.query(
      `SELECT odds_at_time::float8 AS odds FROM public.placed_bets WHERE coupon_id = $1`,
      [current.data],
    );
    expect(rows).toEqual([{ odds: 1.95 }]);
  }, 60_000);

  it('places a roulette bet once when the same request id is sent twice', async () => {
    const player = await createPlayer('idem-roulette');
    const requestId = randomUUID();
    const bet = {
      p_user_id: player.id,
      p_bet_type: 'color',
      p_bet_value: 'red',
      p_stake: 3,
      p_request_id: requestId,
    };

    const first = await player.client.rpc('place_roulette_table_bet', bet);
    const retry = await player.client.rpc('place_roulette_table_bet', bet);

    expect(first.error).toBeNull();
    expect(retry.error).toBeNull();
    expect(retry.data[0].id).toBe(first.data[0].id);
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM public.casino_roulette_bets WHERE user_id = $1`,
      [player.id],
    );
    expect(rows[0].count).toBe(1);
    expect(await getProfileBalance(pool, player.id)).toBe(497);
  }, 60_000);

  it("returns the caller's bets of the newest settled round apart from the open bets", async () => {
    const tableKey = `test-${randomUUID()}`;
    const player = await createPlayer('snapshot-player');
    const other = await createPlayer('snapshot-other');
    const snapshot = async (user: TestUser) => {
      const { data, error } = await user.client.rpc('get_roulette_table_snapshot', { p_table_key: tableKey });
      expect(error).toBeNull();
      return data[0];
    };

    const placed = await player.client.rpc('place_roulette_table_bet', {
      p_user_id: player.id,
      p_bet_type: 'parity',
      p_bet_value: 'even',
      p_stake: 2,
      p_table_key: tableKey,
    });
    expect(placed.error).toBeNull();
    const { id: betId, round_id: roundId } = placed.data[0];

    const open = await snapshot(player);
    expect(open.active_bets.map((bet: { id: string }) => bet.id)).toEqual([betId]);
    expect(open.last_settled_bets).toEqual([]);

    // Betting window and reveal are wall-clock timers; move them into the past and advance twice.
    await pool.query(
      `UPDATE public.casino_roulette_rounds SET betting_closes_at = NOW() - INTERVAL '1 minute' WHERE id = $1`,
      [roundId],
    );
    await pool.query(`SELECT public.advance_roulette_round_if_due($1)`, [tableKey]);
    await pool.query(
      `UPDATE public.casino_roulette_rounds SET spin_started_at = NOW() - INTERVAL '1 minute' WHERE id = $1`,
      [roundId],
    );
    await pool.query(`SELECT public.advance_roulette_round_if_due($1)`, [tableKey]);

    const settled = await snapshot(player);
    expect(settled.active_bets).toEqual([]);
    expect(settled.recent_spins[0].id).toBe(roundId);
    expect(settled.last_settled_bets).toHaveLength(1);
    expect(settled.last_settled_bets[0]).toMatchObject({ id: betId, round_id: roundId });
    expect(settled.last_settled_bets[0].is_win).not.toBeNull();

    expect((await snapshot(other)).last_settled_bets).toEqual([]);
  }, 60_000);
});
