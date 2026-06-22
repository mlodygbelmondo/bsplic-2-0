import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationsDir = join(process.cwd(), 'supabase/migrations');
const migrationSql = readdirSync(migrationsDir)
  .filter((file) => file.endsWith('.sql'))
  .sort()
  .map((file) => readFileSync(join(migrationsDir, file), 'utf8'))
  .join('\n');

function getLatestFunctionBody(functionName: string): string {
  const pattern = new RegExp(
    `CREATE OR REPLACE FUNCTION ${functionName}[\\s\\S]*?\\nEND;\\n\\$\\$;`,
    'gm',
  );
  const matches = Array.from(migrationSql.matchAll(pattern), (match) => match[0]);
  return matches.at(-1) ?? '';
}

describe('place_bet_secure migration invariants', () => {
  it('rejects duplicate AKO events before deducting balance', () => {
    const body = getLatestFunctionBody(
      'public.place_bet_secure\\(\\s*p_user_id UUID,\\s*p_total_odds NUMERIC,\\s*p_stake NUMERIC,\\s*p_items JSONB\\s*\\)',
    );

    expect(body).toContain('v_distinct_bet_count');
    expect(body).toContain('COUNT(DISTINCT (item->>\'betId\')::UUID)');
    expect(body).toContain('IF v_distinct_bet_count <> v_item_count THEN');
    expect(body.indexOf('IF v_distinct_bet_count <> v_item_count THEN')).toBeLessThan(
      body.indexOf('UPDATE public.profiles'),
    );
  });

  it('does not expose authoritative bet placement to anon clients', () => {
    expect(migrationSql).toContain(
      'REVOKE EXECUTE ON FUNCTION public.place_bet_secure(UUID, NUMERIC, NUMERIC, JSONB)',
    );
    expect(migrationSql).toContain(
      'GRANT EXECUTE ON FUNCTION public.place_bet_secure(UUID, NUMERIC, NUMERIC, JSONB)',
    );
  });
});
