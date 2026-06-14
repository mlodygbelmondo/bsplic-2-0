import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

function readFeaturePollsMigration() {
  const migrationsDir = join(process.cwd(), 'supabase/migrations');
  const migrationName = readdirSync(migrationsDir).find((name) =>
    name.endsWith('_feature_polls.sql'),
  );

  if (!migrationName) {
    throw new Error('Missing feature polls migration');
  }

  return readFileSync(join(migrationsDir, migrationName), 'utf8');
}

function readFeaturePollsFollowupMigration() {
  const migrationsDir = join(process.cwd(), 'supabase/migrations');
  const migrationName = readdirSync(migrationsDir).find((name) =>
    name.endsWith('_feature_polls_copy_and_start.sql'),
  );

  if (!migrationName) {
    throw new Error('Missing feature polls copy/start follow-up migration');
  }

  return readFileSync(join(migrationsDir, migrationName), 'utf8');
}

describe('feature polls migration', () => {
  const migration = readFeaturePollsMigration();

  it.each(['feature_polls', 'feature_poll_options', 'feature_poll_votes'])(
    'creates public.%s',
    (tableName) => {
      expect(migration).toMatch(
        new RegExp(`CREATE\\s+TABLE\\s+public\\.${tableName}`, 'i'),
      );
      expect(migration).toMatch(
        new RegExp(
          `ALTER\\s+TABLE\\s+public\\.${tableName}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`,
          'i',
        ),
      );
    },
  );

  it('enforces one vote per user per poll and one active poll window', () => {
    expect(migration).toMatch(
      /UNIQUE\s*\(\s*poll_id\s*,\s*user_id\s*\)/i,
    );
    expect(migration).toMatch(
      /CREATE\s+UNIQUE\s+INDEX\s+feature_polls_single_active_window_idx/i,
    );
  });

  it.each([
    'get_available_feature_poll',
    'submit_feature_poll_vote',
    'admin_get_feature_polls',
  ])('adds the public.%s RPC', (functionName) => {
    expect(migration).toMatch(
      new RegExp(
        `CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+public\\.${functionName}`,
        'i',
      ),
    );
  });

  it('grants user and admin RPCs to authenticated users only', () => {
    expect(migration).toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.get_available_feature_poll\(\)\s+TO\s+authenticated/i,
    );
    expect(migration).toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.submit_feature_poll_vote\(UUID,\s*UUID,\s*TEXT\)\s+TO\s+authenticated/i,
    );
    expect(migration).toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.admin_get_feature_polls\(\)\s+TO\s+authenticated/i,
    );
  });

  it('adds configurable poll copy and removes start-date requirements in a new migration', () => {
    const followupMigration = readFeaturePollsFollowupMigration();

    expect(followupMigration).toMatch(/ADD\s+COLUMN\s+title\s+TEXT/i);
    expect(followupMigration).toMatch(/ADD\s+COLUMN\s+title_enabled\s+BOOLEAN/i);
    expect(followupMigration).toMatch(/ADD\s+COLUMN\s+description\s+TEXT/i);
    expect(followupMigration).toMatch(
      /ADD\s+COLUMN\s+description_enabled\s+BOOLEAN/i,
    );
    expect(followupMigration).toMatch(
      /ADD\s+COLUMN\s+question_enabled\s+BOOLEAN/i,
    );
    expect(followupMigration).toMatch(
      /ALTER\s+COLUMN\s+starts_at\s+DROP\s+NOT\s+NULL/i,
    );
    expect(followupMigration).toMatch(
      /DROP\s+FUNCTION\s+IF\s+EXISTS\s+public\.get_available_feature_poll\(\)/i,
    );
    expect(followupMigration).toMatch(
      /DROP\s+FUNCTION\s+IF\s+EXISTS\s+public\.admin_get_feature_polls\(\)/i,
    );
    expect(followupMigration).toMatch(/starts_at\s+IS\s+NULL/i);
    expect(followupMigration).not.toMatch(/NOW\(\)\s*>=\s*poll\.starts_at/i);
    expect(followupMigration).toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.get_available_feature_poll\(\)\s+TO\s+authenticated/i,
    );
    expect(followupMigration).toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.admin_get_feature_polls\(\)\s+TO\s+authenticated/i,
    );
  });
});
