import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/20260527020753_enable_social_notifications_realtime.sql',
);

describe('social realtime migration', () => {
  const migration = readFileSync(migrationPath, 'utf8');

  it.each([
    'user_notifications',
    'social_posts',
    'social_comments',
    'social_reactions',
    'casino_social_shares',
    'social_realtime_events',
  ])('adds public.%s to the supabase_realtime publication', (tableName) => {
    expect(migration).toMatch(
      new RegExp(
        `ALTER\\s+PUBLICATION\\s+supabase_realtime\\s+ADD\\s+TABLE\\s+public\\.${tableName}`,
        'i',
      ),
    );
  });

  it('checks publication membership before adding tables', () => {
    expect(migration).toMatch(/FROM\s+pg_publication_tables/i);
    expect(migration).toMatch(/pubname\s*=\s*'supabase_realtime'/i);
  });

  it('creates trigger-backed social realtime events for feed invalidation', () => {
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS public\.social_realtime_events/i);
    expect(migration).toMatch(/GRANT SELECT ON public\.social_realtime_events TO authenticated/i);
    expect(migration).toMatch(/CREATE TRIGGER trg_social_posts_realtime_event/i);
    expect(migration).toMatch(/CREATE TRIGGER trg_social_comments_realtime_event/i);
    expect(migration).toMatch(/CREATE TRIGGER trg_social_reactions_realtime_event/i);
    expect(migration).toMatch(/CREATE TRIGGER trg_coupons_social_realtime_event/i);
    expect(migration).toMatch(/CREATE TRIGGER trg_placed_bets_social_realtime_event/i);
  });
});
