import { readFileSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const eniuBotMigrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260524100000_social_eniu_bot.sql',
);
const migrationsDir = resolve(process.cwd(), 'supabase/migrations');

function getFunctionBody(migration: string, functionName: string) {
  const match = migration.match(
    new RegExp(
      `CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+public\\.${functionName}[\\s\\S]*?\\n\\$\\$;`,
      'i',
    ),
  );

  return match?.[0] ?? '';
}

describe('Eniu bot migration', () => {
  it('routes bot replies through the shared social comment RPC side effects', () => {
    const migration = readFileSync(eniuBotMigrationPath, 'utf8');
    const functionBody = getFunctionBody(migration, 'agent_add_social_comment');

    expect(functionBody).toMatch(/public\.add_social_comment\(/i);
    expect(functionBody).not.toMatch(/INSERT\s+INTO\s+public\.social_comments/i);
  });

  it('stores sanitized provider diagnostics for bot runs', () => {
    const migration = readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .map((file) => readFileSync(resolve(migrationsDir, file), 'utf8'))
      .find((source) => source.includes('provider_diagnostic JSONB'));

    expect(migration).toBeTruthy();
    expect(migration).toContain(
      'ALTER TABLE private.social_bot_runs ADD COLUMN IF NOT EXISTS provider_diagnostic JSONB',
    );
    expect(migration).toContain('p_provider_diagnostic JSONB DEFAULT NULL');
    expect(migration).toContain("'providerDiagnostic', r.provider_diagnostic");
    expect(migration).toContain(
      'DROP FUNCTION IF EXISTS public.agent_add_social_comment(TEXT, TEXT, UUID, TEXT)',
    );
    expect(migration).toContain(
      'DROP FUNCTION IF EXISTS public.agent_record_social_bot_error(TEXT, TEXT, UUID, TEXT)',
    );
    expect(migration).toContain(
      'DROP FUNCTION IF EXISTS public.agent_create_social_post(TEXT, TEXT)',
    );
  });
});
