import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationsDir = join(process.cwd(), 'supabase/migrations');

function readSocialStoriesMigration(): string {
  const file = readdirSync(migrationsDir).find((name) =>
    name.includes('social_stories'),
  );

  if (!file) {
    throw new Error('Missing social stories migration');
  }

  return readFileSync(join(migrationsDir, file), 'utf8');
}

describe('social stories migration', () => {
  const migration = readSocialStoriesMigration();

  it('creates expiring stories with RLS and explicit grants', () => {
    expect(migration).toMatch(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.social_stories/i);
    expect(migration).toMatch(/expires_at\s+TIMESTAMPTZ\s+NOT\s+NULL/i);
    expect(migration).toContain("INTERVAL '24 hours'");
    expect(migration).toMatch(/ALTER\s+TABLE\s+public\.social_stories\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
    expect(migration).toMatch(/GRANT\s+SELECT\s+ON\s+public\.social_stories\s+TO\s+anon,\s*authenticated/i);
    expect(migration).toMatch(/GRANT\s+INSERT\s+ON\s+public\.social_stories\s+TO\s+authenticated/i);
  });

  it('only exposes active stories and restricts creation to the owner', () => {
    expect(migration).toMatch(/expires_at\s*>\s*NOW\(\)/i);
    expect(migration).toMatch(/TO\s+authenticated[\s\S]+WITH\s+CHECK\s*\([\s\S]*\(select\s+auth\.uid\(\)\)\s*=\s*user_id/i);
    expect(migration).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.get_active_social_stories/i);
    expect(migration).toMatch(/WHERE\s+s\.expires_at\s*>\s*NOW\(\)/i);
    expect(migration).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.create_social_story/i);
    expect(migration).toMatch(/auth\.uid\(\)\s+IS\s+DISTINCT\s+FROM\s+p_user_id/i);
  });
});
