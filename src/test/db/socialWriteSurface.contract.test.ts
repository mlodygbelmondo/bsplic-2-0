// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createDbPool,
  createServiceClient,
  createTestUser,
  dbTestEnv,
  deleteTestUsers,
  type TestUser,
} from './dbTestClient';

// Behavioral contract tests for the social write surface: posts, comments and
// reactions are written only through the validated RPCs, so a client cannot
// forge timestamps or another user's identity. See src/test/db/README.md.
describe('social write surface contract', () => {
  let service: SupabaseClient;
  let pool: Pool;
  let author: TestUser;
  let other: TestUser;
  let postId: string;

  beforeAll(async () => {
    service = createServiceClient();
    pool = createDbPool();
    author = await createTestUser(service, 'social-author');
    other = await createTestUser(service, 'social-other');

    const { data, error } = await author.client.rpc('create_social_post', {
      p_user_id: author.id,
      p_content: 'Post do testów kontraktu',
    });
    expect(error).toBeNull();
    postId = data as string;
  }, 60_000);

  afterAll(async () => {
    if (service && pool) {
      await deleteTestUsers(service, [author, other].filter(Boolean));
      await pool.end();
    }
  });

  it('rejects a direct post insert that would pin itself to the top of the feed', async () => {
    const { error } = await author.client
      .from('social_posts')
      .insert({ user_id: author.id, content: 'Przypięty', created_at: '2099-01-01T00:00:00Z' });

    expect(error).not.toBeNull();
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS future_posts FROM public.social_posts
        WHERE user_id = $1 AND created_at > NOW() + INTERVAL '1 day'`,
      [author.id],
    );
    expect(rows[0].future_posts).toBe(0);
  });

  it('rejects direct comment and reaction writes', async () => {
    const comment = await other.client
      .from('social_comments')
      .insert({ user_id: other.id, content: 'Bez RPC', post_id: postId });
    const reaction = await other.client
      .from('social_reactions')
      .insert({ user_id: other.id, emoji: 'fire', post_id: postId });

    expect(comment.error).not.toBeNull();
    expect(reaction.error).not.toBeNull();
  });

  it('accepts a comment without the optional casino share argument and keeps the identity check', async () => {
    const own = await other.client.rpc('add_social_comment', {
      p_user_id: other.id,
      p_content: 'Komentarz przez RPC',
      p_post_id: postId,
      p_coupon_id: null,
      p_parent_id: null,
    });
    const impersonated = await other.client.rpc('add_social_comment', {
      p_user_id: author.id,
      p_content: 'Podszywam się',
      p_post_id: postId,
      p_coupon_id: null,
      p_parent_id: null,
    });

    expect(own.error).toBeNull();
    expect(impersonated.error).not.toBeNull();
    const { rows } = await pool.query(
      `SELECT user_id FROM public.social_comments WHERE post_id = $1 ORDER BY created_at`,
      [postId],
    );
    expect(rows.map((row) => row.user_id)).toEqual([other.id]);
  });

  it('toggles a reaction without the optional casino share argument and keeps the identity check', async () => {
    const own = await other.client.rpc('toggle_reaction', {
      p_user_id: other.id,
      p_emoji: 'fire',
      p_post_id: postId,
      p_coupon_id: null,
      p_comment_id: null,
    });
    const impersonated = await other.client.rpc('toggle_reaction', {
      p_user_id: author.id,
      p_emoji: 'fire',
      p_post_id: postId,
      p_coupon_id: null,
      p_comment_id: null,
    });

    expect(own.error).toBeNull();
    expect(impersonated.error).not.toBeNull();
    const { rows } = await pool.query(
      `SELECT user_id FROM public.social_reactions WHERE post_id = $1`,
      [postId],
    );
    expect(rows.map((row) => row.user_id)).toEqual([other.id]);
  });

  it('keeps realtime events internal to the database triggers', async () => {
    const anonymous = createClient(dbTestEnv.url, dbTestEnv.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const fakeTargetId = randomUUID();

    const forged = await anonymous.rpc('record_social_realtime_event', {
      p_target_type: 'post',
      p_target_id: fakeTargetId,
      p_source_table: 'social_posts',
      p_operation: 'UPDATE',
    });

    expect(forged.error).not.toBeNull();
    const { rows: forgedRows } = await pool.query(
      `SELECT COUNT(*)::int AS events FROM public.social_realtime_events WHERE target_id = $1`,
      [fakeTargetId],
    );
    expect(forgedRows[0].events).toBe(0);

    // The trigger path still emits events for real writes.
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS events FROM public.social_realtime_events
        WHERE target_type = 'post' AND target_id = $1`,
      [postId],
    );
    expect(rows[0].events).toBeGreaterThan(0);
  });
});
