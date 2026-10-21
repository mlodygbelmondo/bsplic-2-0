// @vitest-environment node
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

// Behavioral contract tests for sportsbook settlement money: they place real
// coupons through `place_bet_secure` and settle them through `admin_settle_bet`
// against a local Supabase stack. See src/test/db/README.md for setup.
describe('sportsbook settlement RPC contract', () => {
  let service: SupabaseClient;
  let pool: Pool;
  let admin: TestUser;
  const players: TestUser[] = [];
  const createdBetIds: string[] = [];

  async function createBet(title: string, oddsA: number, oddsB: number): Promise<string> {
    const { data, error } = await admin.client.rpc('admin_create_bet_with_ako_exclusions', {
      p_title: title,
      p_category_id: null,
      p_bet_type: '12',
      p_options: [
        { name: 'A', odds: oddsA },
        { name: 'B', odds: oddsB },
      ],
      p_ends_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(error).toBeNull();
    createdBetIds.push(data as string);
    return data as string;
  }

  async function createPlayer(label: string): Promise<TestUser> {
    const player = await createTestUser(service, label);
    players.push(player);
    return player;
  }

  async function placeCoupon(
    player: TestUser,
    legs: Array<{ betId: string; stake: number }>,
  ): Promise<string> {
    const { data, error } = await player.client.rpc('place_bet_secure', {
      p_user_id: player.id,
      p_total_odds: 0,
      p_stake: legs.reduce((sum, leg) => sum + leg.stake, 0),
      p_items: legs.map((leg) => ({ betId: leg.betId, selectedOption: 'A', stake: leg.stake })),
    });
    expect(error).toBeNull();
    return data as string;
  }

  async function settle(betId: string, winners: string[], mode: 'normal' | 'refund') {
    const { error } = await admin.client.rpc('admin_settle_bet', {
      p_bet_id: betId,
      p_winning_options: winners,
      p_mode: mode,
      p_scope: 'pending_only',
    });
    expect(error).toBeNull();
  }

  async function getCoupon(couponId: string) {
    const { rows } = await pool.query(
      `SELECT status, payout::float8 AS payout FROM public.coupons WHERE id = $1`,
      [couponId],
    );
    return rows[0];
  }

  beforeAll(async () => {
    service = createServiceClient();
    pool = createDbPool();
    admin = await createTestUser(service, 'settle-admin');
    // No interface grants roles; the admin seat is provisioned directly.
    await pool.query(`INSERT INTO public.user_roles (user_id, role) VALUES ($1, 'admin')`, [
      admin.id,
    ]);
  }, 60_000);

  afterAll(async () => {
    if (!service || !pool) return;
    // Deleting the users cascades their coupons, which frees the markets.
    await deleteTestUsers(service, [...players, admin].filter(Boolean));
    if (createdBetIds.length > 0) {
      await pool.query(`DELETE FROM public.bets WHERE id = ANY($1::uuid[])`, [createdBetIds]);
    }
    await pool.end();
  });

  it('pays a won AKO at the full combined odds', async () => {
    const first = await createBet('AKO pełne - mecz 1', 2, 1.6);
    const second = await createBet('AKO pełne - mecz 2', 1.5, 2.4);
    const player = await createPlayer('ako-full');
    const before = await getProfileBalance(pool, player.id);

    const couponId = await placeCoupon(player, [
      { betId: first, stake: 5 },
      { betId: second, stake: 5 },
    ]);
    await settle(first, ['A'], 'normal');
    await settle(second, ['A'], 'normal');

    // 10 zł at 2.0 × 1.5 = 3.0 returns 30 zł.
    expect(await getCoupon(couponId)).toEqual({ status: 'won', payout: 30 });
    expect(await getProfileBalance(pool, player.id)).toBe(before - 10 + 30);
  }, 60_000);

  it('prices a refunded AKO leg at 1.0 when the other legs win', async () => {
    const refunded = await createBet('AKO zwrot - odwołany', 3, 1.4);
    const won = await createBet('AKO zwrot - wygrany', 3, 1.4);
    const player = await createPlayer('ako-refund');
    const before = await getProfileBalance(pool, player.id);

    const couponId = await placeCoupon(player, [
      { betId: refunded, stake: 5 },
      { betId: won, stake: 5 },
    ]);
    await settle(refunded, [], 'refund');
    await settle(won, ['A'], 'normal');

    // The cancelled 3.0 leg drops out: 10 zł at 3.0 returns 30 zł, not 90 zł.
    expect(await getCoupon(couponId)).toEqual({ status: 'won', payout: 30 });
    expect(await getProfileBalance(pool, player.id)).toBe(before - 10 + 30);
  }, 60_000);

  it('returns the stake when every AKO leg is refunded', async () => {
    const first = await createBet('AKO pełny zwrot - mecz 1', 2.2, 1.7);
    const second = await createBet('AKO pełny zwrot - mecz 2', 1.9, 1.9);
    const player = await createPlayer('ako-all-refund');
    const before = await getProfileBalance(pool, player.id);

    const couponId = await placeCoupon(player, [
      { betId: first, stake: 4 },
      { betId: second, stake: 4 },
    ]);
    await settle(first, [], 'refund');
    await settle(second, [], 'refund');

    expect(await getCoupon(couponId)).toEqual({ status: 'refund', payout: 8 });
    expect(await getProfileBalance(pool, player.id)).toBe(before);
  }, 60_000);

  it('refuses to delete a market that already carries coupons', async () => {
    const betId = await createBet('Rynek z kuponem', 2, 2);
    const player = await createPlayer('delete-guard');
    const couponId = await placeCoupon(player, [{ betId, stake: 20 }]);

    const { error } = await admin.client.from('bets').delete().eq('id', betId);

    expect(error?.message).toMatch(/Nie można usunąć zakładu/);
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS legs FROM public.placed_bets WHERE coupon_id = $1`,
      [couponId],
    );
    expect(rows[0].legs).toBe(1);

    // The stake still comes back through the normal refund path.
    const before = await getProfileBalance(pool, player.id);
    await settle(betId, [], 'refund');
    expect(await getProfileBalance(pool, player.id)).toBe(before + 20);
  }, 60_000);

  it('still deletes a market nobody has bet on', async () => {
    const betId = await createBet('Pusty rynek', 2, 2);

    const { error } = await admin.client.from('bets').delete().eq('id', betId);

    expect(error).toBeNull();
    const { rows } = await pool.query(`SELECT 1 FROM public.bets WHERE id = $1`, [betId]);
    expect(rows).toHaveLength(0);
  }, 60_000);
});
