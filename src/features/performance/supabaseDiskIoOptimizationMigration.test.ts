import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

function readDiskIoMigration() {
  const migrationsDir = join(process.cwd(), 'supabase/migrations');
  const migrationName = readdirSync(migrationsDir).find((name) =>
    name.endsWith('_supabase_disk_io_optimization.sql'),
  );

  if (!migrationName) {
    throw new Error('Missing supabase disk IO optimization migration');
  }

  return readFileSync(join(migrationsDir, migrationName), 'utf8');
}

describe('supabase disk IO optimization migration', () => {
  const migration = readDiskIoMigration();

  it.each([
    'placed_bets',
    'bet_proposals',
    'casino_roulette_bets',
    'social_posts',
    'social_comments',
    'social_reactions',
    'casino_social_shares',
  ])('removes public.%s from the realtime publication', (tableName) => {
    expect(migration).toMatch(
      new RegExp(
        `ALTER\\s+PUBLICATION\\s+supabase_realtime\\s+DROP\\s+TABLE\\s+public\\.${tableName}`,
        'i',
      ),
    );
  });

  it.each([
    'bets',
    'categories',
    'casino_roulette_rounds',
    'social_realtime_events',
    'user_notifications',
  ])('keeps public.%s in the realtime publication', (tableName) => {
    expect(migration).toMatch(
      new RegExp(
        `ALTER\\s+PUBLICATION\\s+supabase_realtime\\s+ADD\\s+TABLE\\s+public\\.${tableName}`,
        'i',
      ),
    );
  });

  it('adds a single roulette snapshot contract and removes browser advancement access', () => {
    expect(migration).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.get_roulette_table_snapshot/i);
    expect(migration).toMatch(/REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.advance_roulette_round_if_due\(TEXT\)\s+FROM\s+PUBLIC,\s*anon,\s*authenticated/i);
    expect(migration).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.advance_roulette_round_if_due\(TEXT\)\s+TO\s+service_role/i);
    expect(migration).toMatch(/cron\.schedule/i);
  });

  it('adds retention for append-only social realtime invalidation rows', () => {
    expect(migration).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.delete_old_social_realtime_events/i);
    expect(migration).toMatch(/DELETE\s+FROM\s+public\.social_realtime_events/i);
    expect(migration).toMatch(/created_at\s+<\s+NOW\(\)\s*-\s*INTERVAL\s+'2 days'/i);
  });

  it('adds a server-side admin dashboard aggregate contract', () => {
    expect(migration).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.admin_get_dashboard_summary/i);
    expect(migration).toMatch(/public\.has_role\(auth\.uid\(\),\s*'admin'\)/i);
    expect(migration).toMatch(/Europe\/Warsaw/i);
  });

  it('uses full replica identity for notification unread-count realtime updates', () => {
    expect(migration).toMatch(/ALTER\s+TABLE\s+public\.user_notifications\s+REPLICA\s+IDENTITY\s+FULL/i);
  });
});
