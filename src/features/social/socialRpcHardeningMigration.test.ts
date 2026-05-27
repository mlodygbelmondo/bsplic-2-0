import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/20260527021458_harden_notifications_social_rpc.sql',
);

describe('social and notification RPC hardening migration', () => {
  const migration = readFileSync(migrationPath, 'utf8');

  it.each([
    'get_user_notifications',
    'get_unread_notifications_count',
    'mark_notification_read',
    'mark_all_notifications_read',
    'create_social_post',
  ])('guards public.%s with auth.uid()', (functionName) => {
    const start = migration.search(
      new RegExp(`CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+public\\.${functionName}`, 'i'),
    );
    expect(start).toBeGreaterThanOrEqual(0);

    const body = migration.slice(start, migration.indexOf('$$;', start));
    expect(body).toMatch(/auth\.uid\(\)\s+IS\s+DISTINCT\s+FROM\s+p_user_id/i);
  });

  it('revokes direct notification helper execution from browser roles', () => {
    expect(migration).toMatch(
      /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.create_user_notification[\s\S]+FROM\s+PUBLIC,\s*anon,\s*authenticated/i,
    );
  });

  it('keeps create_social_post unavailable to anon users', () => {
    expect(migration).toMatch(
      /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.create_social_post\(UUID,\s*TEXT\)\s+FROM\s+PUBLIC,\s*anon/i,
    );
    expect(migration).toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.create_social_post\(UUID,\s*TEXT\)\s+TO\s+authenticated/i,
    );
  });
});
