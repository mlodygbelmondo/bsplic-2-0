// @vitest-environment node
import type { Pool } from 'pg';
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createDbPool,
  createServiceClient,
  createTestUser,
  deleteTestUsers,
  type TestUser,
} from './dbTestClient';

// Behavioral contract tests for the operator season-reset RPCs. Preview must
// stay read-only; execute must refuse to run without explicit confirmation;
// neither is callable by a browser role.
describe('global season reset RPC contract', () => {
  let service: SupabaseClient;
  let pool: Pool;
  let previewUser: TestUser;

  beforeAll(async () => {
    service = createServiceClient();
    pool = createDbPool();
    previewUser = await createTestUser(service, 'season-preview');
    await pool.query(
      `UPDATE public.profiles
          SET balance = 321.45,
              current_streak = 4,
              longest_streak = 7
        WHERE id = $1`,
      [previewUser.id],
    );
  }, 60_000);

  afterAll(async () => {
    if (service && pool) {
      await deleteTestUsers(service, [previewUser].filter(Boolean));
      await pool.end();
    }
  });

  it('previews a reset without mutating anything', async () => {
    const before = await pool.query(
      `SELECT balance::float8, current_streak, longest_streak
         FROM public.profiles WHERE id = $1`,
      [previewUser.id],
    );
    const preview = await service.rpc('preview_global_season_reset');
    expect(preview.error).toBeNull();
    expect(preview.data).toMatchObject({ mode: 'dry-run' });
    const after = await pool.query(
      `SELECT balance::float8, current_streak, longest_streak
         FROM public.profiles WHERE id = $1`,
      [previewUser.id],
    );
    expect(after.rows).toEqual(before.rows);
  });

  it('refuses to execute without explicit confirmation', async () => {
    const unconfirmed = await service.rpc('execute_global_season_reset', {
      p_confirm: false,
    });
    expect(unconfirmed.error?.message).toMatch(
      /Global season reset requires explicit confirmation/,
    );
  });

  it('is not callable by an authenticated browser session', async () => {
    const user = await createTestUser(service, 'operator');
    try {
      const before = await pool.query(
        `SELECT balance::float8 FROM public.profiles WHERE id = $1`,
        [user.id],
      );
      const denied = await user.client.rpc('preview_global_season_reset');
      expect(denied.error?.message).toMatch(/permission denied/i);
      const deniedExecute = await user.client.rpc('execute_global_season_reset', {
        p_confirm: true,
      });
      expect(deniedExecute.error?.message).toMatch(/permission denied/i);
      const after = await pool.query(
        `SELECT balance::float8 FROM public.profiles WHERE id = $1`,
        [user.id],
      );
      expect(after.rows).toEqual(before.rows);
    } finally {
      await deleteTestUsers(service, [user]);
    }
  }, 30_000);
});
