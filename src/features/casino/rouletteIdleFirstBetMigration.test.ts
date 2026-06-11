import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

function readRouletteIdleMigration() {
  const migrationsDir = join(process.cwd(), 'supabase/migrations');
  const migrationName = readdirSync(migrationsDir).find((name) =>
    name.endsWith('_roulette_idle_first_bet_rounds.sql'),
  );

  if (!migrationName) {
    throw new Error('Missing roulette idle first bet migration');
  }

  return readFileSync(join(migrationsDir, migrationName), 'utf8');
}

describe('roulette idle first bet migration', () => {
  const migration = readRouletteIdleMigration();

  it('exposes an authenticated RPC that can create the shared round from a bet', () => {
    expect(migration).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.place_roulette_table_bet/i,
    );
    expect(migration).toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.place_roulette_table_bet\(UUID,\s*TEXT,\s*TEXT,\s*NUMERIC,\s*TEXT\)\s+TO\s+authenticated/i,
    );
    expect(migration).toMatch(
      /pg_try_advisory_xact_lock\(hashtext\('roulette:'/i,
    );
  });

  it('treats a missing active round as an idle table in snapshots', () => {
    expect(migration).toMatch(
      /WHERE\s+auth\.uid\(\)\s+IS\s+NOT\s+NULL[\s\S]+r\.phase\s+IN\s+\('waiting',\s*'spinning'\)/i,
    );
    expect(migration).toMatch(
      /COALESCE\(\(SELECT\s+to_jsonb\(current_round_row\)\s+FROM\s+current_round_row\),\s*'null'::jsonb\)/i,
    );
  });

  it('settles due rounds without creating a new empty round', () => {
    const advanceStart = migration.indexOf(
      'CREATE OR REPLACE FUNCTION public.advance_roulette_round_if_due',
    );
    const placeBetStart = migration.indexOf(
      'CREATE OR REPLACE FUNCTION public.place_roulette_table_bet',
    );
    const advanceFunction = migration.slice(advanceStart, placeBetStart);

    expect(advanceFunction).toContain("SET phase = 'settled'");
    expect(advanceFunction).not.toContain(
      'INSERT INTO public.casino_roulette_rounds',
    );
  });

  it('keeps the low-cost scheduler on a pg_cron seconds interval', () => {
    expect(migration).toMatch(
      /cron\.schedule\([\s\S]+'bsplic-roulette-advance-main'[\s\S]+'5 seconds'/i,
    );
  });
});
