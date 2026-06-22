import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/20260622010000_admin_bet_ako_rpc_contract.sql',
);
const migrationSql = readFileSync(migrationPath, 'utf8');
const rlsOptimizationSql = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260618043000_optimize_jackpot_ako_rls_policies.sql',
  ),
  'utf8',
);

function getFunctionBody(functionName: string): string {
  const pattern = new RegExp(
    `CREATE OR REPLACE FUNCTION ${functionName}[\\s\\S]*?\\nEND;\\n\\$\\$;`,
    'm',
  );
  const match = migrationSql.match(pattern);
  return match?.[0] ?? '';
}

describe('admin AKO exclusions migration invariants', () => {
  it('locks the parent bet row before replacing exclusion pairs', () => {
    const body = getFunctionBody(
      'public.admin_replace_bet_ako_exclusions\\(\\s*p_bet_id UUID,\\s*p_exclusions JSONB\\s*\\)',
    );

    expect(body).toContain('FOR UPDATE');
    expect(body.indexOf('FOR UPDATE')).toBeLessThan(
      body.indexOf('DELETE FROM public.bet_ako_exclusions'),
    );
  });

  it('keeps AKO exclusion admin policies out of the public read policy', () => {
    expect(rlsOptimizationSql).toContain(
      'DROP POLICY IF EXISTS "Only admins can manage AKO exclusions"',
    );
    expect(rlsOptimizationSql).toContain('FOR INSERT');
    expect(rlsOptimizationSql).toContain('FOR UPDATE');
    expect(rlsOptimizationSql).toContain('FOR DELETE');
    expect(rlsOptimizationSql).not.toContain('FOR ALL');
    expect(rlsOptimizationSql).toContain('(SELECT auth.uid())');
  });
});
