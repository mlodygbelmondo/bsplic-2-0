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

// Behavioral contract tests for the Jackpot Dnia lifecycle: buy limits and
// the underfunded-round refund path — the flow the 2026-07-22 multi-ticket
// refund fix patched — exercised through the real RPC interface.
describe('daily jackpot RPC contract', () => {
  let service: SupabaseClient;
  let pool: Pool;
  let player: TestUser;
  let testedPoolId: string | null = null;
  let testedPoolDate: string | null = null;
  let nextPoolExisted = false;

  beforeAll(async () => {
    service = createServiceClient();
    pool = createDbPool();
    const { rowCount: activePoolCount } = await pool.query(
      `SELECT 1
         FROM public.daily_jackpot_pools
        WHERE pool_date BETWEEN
          (timezone('Europe/Warsaw', NOW()))::date
          AND (timezone('Europe/Warsaw', NOW()))::date + 1`,
    );
    if (activePoolCount !== 0) {
      throw new Error(
        'Jackpot contract tests require clean current/next local pools; run `npx supabase db reset`.',
      );
    }
    player = await createTestUser(service, 'jackpot');
  }, 60_000);

  afterAll(async () => {
    if (service && pool) {
      try {
        if (testedPoolId && testedPoolDate) {
          await pool.query('BEGIN');
          await pool.query(
            `DELETE FROM public.daily_jackpot_funding_entries
              WHERE source_pool_id = $1`,
            [testedPoolId],
          );
          await pool.query(
            `UPDATE public.daily_jackpot_pools
                SET rollover_from_pool_id = NULL,
                    prize_amount = ROUND(COALESCE((
                      SELECT SUM(amount)
                      FROM public.daily_jackpot_funding_entries
                      WHERE pool_id = public.daily_jackpot_pools.id
                    ), 0), 2)
              WHERE rollover_from_pool_id = $1`,
            [testedPoolId],
          );
          await pool.query(
            `DELETE FROM public.daily_jackpot_pools WHERE id = $1`,
            [testedPoolId],
          );
          if (!nextPoolExisted) {
            await pool.query(
              `DELETE FROM public.daily_jackpot_pools next_pool
                WHERE next_pool.pool_date = $1::date + 1
                  AND next_pool.status = 'collecting'
                  AND NOT EXISTS (
                    SELECT 1 FROM public.daily_jackpot_tickets
                    WHERE pool_id = next_pool.id
                  )
                  AND NOT EXISTS (
                    SELECT 1 FROM public.daily_jackpot_funding_entries
                    WHERE pool_id = next_pool.id
                  )`,
              [testedPoolDate],
            );
          }
          await pool.query('COMMIT');
        }
      } catch (error) {
        await pool.query('ROLLBACK');
        throw error;
      } finally {
        await deleteTestUsers(service, [player].filter(Boolean));
        await pool.end();
      }
    }
  });

  it('serves a snapshot whose ticket limit comes from the rules authority', async () => {
    const state = await player.client.rpc('get_daily_jackpot_state');
    expect(state.error).toBeNull();
    expect(state.data).toMatchObject({ max_tickets_per_player: 2 });
    testedPoolId = state.data.pool_id;

    const { rows: poolDates } = await pool.query(
      `SELECT pool_date::text AS pool_date FROM public.daily_jackpot_pools WHERE id = $1`,
      [testedPoolId],
    );
    testedPoolDate = poolDates[0].pool_date;

    const { rows } = await pool.query(
      `SELECT (private.daily_jackpot_rules()->>'max_tickets_per_player')::int AS max`,
    );
    expect(state.data.max_tickets_per_player).toBe(rows[0].max);
  });

  it('enforces the per-player ticket limit and refunds an underfunded round', async () => {
    const state = await player.client.rpc('get_daily_jackpot_state');
    expect(state.error).toBeNull();
    const poolId: string = state.data.pool_id;
    testedPoolId = poolId;
    expect(poolId).toBeTruthy();
    expect(state.data.status).toBe('collecting');

    const { rows: poolDates } = await pool.query(
      `SELECT pool_date::text AS pool_date FROM public.daily_jackpot_pools WHERE id = $1`,
      [poolId],
    );
    testedPoolDate = poolDates[0].pool_date;
    const { rowCount: existingNextPoolCount } = await pool.query(
      `SELECT 1 FROM public.daily_jackpot_pools WHERE pool_date = $1::date + 1`,
      [testedPoolDate],
    );
    nextPoolExisted = existingNextPoolCount === 1;

    const balanceBefore = await getProfileBalance(pool, player.id);

    const firstTicket = await player.client.rpc('buy_daily_jackpot_ticket', {
      p_pool_id: poolId,
    });
    expect(firstTicket.error).toBeNull();
    const secondTicket = await player.client.rpc('buy_daily_jackpot_ticket', {
      p_pool_id: poolId,
    });
    expect(secondTicket.error).toBeNull();
    expect(secondTicket.data).toMatchObject({ current_user_ticket_count: 2 });

    const thirdTicket = await player.client.rpc('buy_daily_jackpot_ticket', {
      p_pool_id: poolId,
    });
    expect(thirdTicket.error?.message).toMatch(
      /Limit ticketów w tej puli to 2 na gracza/,
    );

    const ticketPrice = Number(state.data.ticket_price);
    expect(await getProfileBalance(pool, player.id)).toBeCloseTo(
      balanceBefore - 2 * ticketPrice,
      2,
    );

    const { rows: rolloverBefore } = await pool.query(
      `SELECT ROUND(COALESCE(SUM(amount), 0), 2)::float8 AS amount
         FROM public.daily_jackpot_funding_entries
        WHERE pool_id = $1 AND source_type <> 'ticket_purchase'`,
      [poolId],
    );
    const expectedRollover = rolloverBefore[0].amount;

    // Force the draw due; with one unique player (< min_unique_users) the
    // round must roll over and refund BOTH tickets — the multi-ticket refund
    // invariant.
    await pool.query(
      `UPDATE public.daily_jackpot_pools
          SET draw_scheduled_at = NOW() - INTERVAL '1 minute'
        WHERE id = $1`,
      [poolId],
    );
    const finalized = await player.client.rpc('get_daily_jackpot_state');
    expect(finalized.error).toBeNull();
    expect(finalized.data).toMatchObject({
      pool_id: poolId,
      status: 'rolled_over',
    });

    const { rows: poolRows } = await pool.query(
      `SELECT status FROM public.daily_jackpot_pools WHERE id = $1`,
      [poolId],
    );
    expect(poolRows[0].status).toBe('rolled_over');

    const { rows: ticketRows } = await pool.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE refunded_at IS NOT NULL)::int AS refunded
         FROM public.daily_jackpot_tickets
        WHERE pool_id = $1 AND user_id = $2`,
      [poolId, player.id],
    );
    expect(ticketRows[0]).toMatchObject({ total: 2, refunded: 2 });

    expect(await getProfileBalance(pool, player.id)).toBeCloseTo(
      balanceBefore,
      2,
    );

    // The next pool receives only non-ticket funding from this pool.
    const { rows: carried } = await pool.query(
      `SELECT amount::float8 AS amount
         FROM public.daily_jackpot_funding_entries
        WHERE source_pool_id = $1 AND source_type = 'rollover'`,
      [poolId],
    );
    expect(Number(carried[0]?.amount ?? 0)).toBeCloseTo(expectedRollover, 2);
  }, 30_000);
});
