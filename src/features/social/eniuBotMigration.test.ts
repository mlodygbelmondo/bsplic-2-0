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

function getLatestFunctionBody(functionName: string) {
  const functionBodies = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => readFileSync(resolve(migrationsDir, file), 'utf8'))
    .map((migration) => getFunctionBody(migration, functionName))
    .filter(Boolean);

  return functionBodies.at(-1) ?? '';
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

  it('claims social bot replies through an atomic conflict-aware insert path', () => {
    const functionBody = getLatestFunctionBody('agent_claim_social_bot_reply');
    const insertIndex = functionBody.search(/INSERT\s+INTO\s+private\.social_bot_runs/i);
    const preInsertBody = functionBody.slice(0, Math.max(insertIndex, 0));

    expect(functionBody).toBeTruthy();
    expect(insertIndex).toBeGreaterThan(-1);
    expect(functionBody).toMatch(/ON\s+CONFLICT\s*\(\s*source_type\s*,\s*source_id\s*\)/i);
    expect(functionBody).toMatch(/WHERE\s+source_type\s+IN\s*\(\s*'post'\s*,\s*'comment'\s*\)/i);
    expect(preInsertBody).not.toMatch(/FROM\s+private\.social_bot_runs/i);
  });
});
