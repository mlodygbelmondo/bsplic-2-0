import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

function readRouletteClientAdvanceMigration() {
  const migrationsDir = join(process.cwd(), 'supabase/migrations');
  const migrationName = readdirSync(migrationsDir).find((name) =>
    name.endsWith('_roulette_client_advance_and_bet_queue.sql'),
  );

  if (!migrationName) {
    throw new Error('Missing roulette client advance migration');
  }

  return readFileSync(join(migrationsDir, migrationName), 'utf8');
}

describe('roulette client advance migration', () => {
  const migration = readRouletteClientAdvanceMigration();

  it('lets authenticated clients nudge an overdue round forward', () => {
    expect(migration).toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.advance_roulette_round_if_due\(TEXT\)\s+TO\s+authenticated/i,
    );
    expect(migration).toMatch(
      /pg_try_advisory_xact_lock\(hashtext\('roulette:'/i,
    );
  });

  it('treats the earliest unsettled round as the current round', () => {
    expect(migration).not.toMatch(
      /phase\s+IN\s+\('waiting',\s*'spinning'\)[\s\S]{0,200}ORDER\s+BY\s+r?\.?round_number\s+DESC/i,
    );
    expect(migration).toMatch(
      /phase\s+IN\s+\('waiting',\s*'spinning'\)[\s\S]{0,200}ORDER\s+BY\s+r\.round_number\s+ASC/i,
    );
  });

  it('queues a bet placed during a spin into the next round', () => {
    expect(migration).not.toContain('Koło już się kręci');
    expect(migration).toMatch(
      /GREATEST\(v_spinning_round\.spin_started_at\s*\+\s*v_reveal_duration,\s*v_now\)\s*\+\s*v_betting_window/i,
    );
  });

  it('keeps snapshot bets and participants visible across queued rounds', () => {
    expect(migration).toMatch(
      /b\.round_id\s+IN\s+\(SELECT\s+o\.id\s+FROM\s+open_round_rows\s+AS\s+o\)/i,
    );
  });
});
