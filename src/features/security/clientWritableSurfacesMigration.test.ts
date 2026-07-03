import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationsDir = join(process.cwd(), 'supabase/migrations');

function readHardeningMigration() {
  const migrationName = readdirSync(migrationsDir).find((name) =>
    name.endsWith('_harden_client_writable_surfaces.sql'),
  );

  if (!migrationName) {
    throw new Error('Missing client writable surfaces hardening migration');
  }

  return readFileSync(join(migrationsDir, migrationName), 'utf8');
}

describe('client writable surfaces hardening migration', () => {
  const migration = readHardeningMigration();

  it('binds secure_daily_topup to the authenticated caller', () => {
    expect(migration).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.secure_daily_topup\(p_user_id\s+UUID\)/i,
    );
    expect(migration).toMatch(/auth\.uid\(\)\s+IS\s+NULL/i);
    expect(migration).toMatch(
      /auth\.uid\(\)\s+IS\s+DISTINCT\s+FROM\s+p_user_id/i,
    );
    expect(migration).toMatch(
      /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.secure_daily_topup\(UUID\)\s+FROM\s+PUBLIC,\s*anon/i,
    );
    expect(migration).toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.secure_daily_topup\(UUID\)\s+TO\s+authenticated/i,
    );
  });

  it('keeps profile avatar edits but blocks direct writes to server-owned profile fields', () => {
    expect(migration).toMatch(
      /DROP\s+POLICY\s+IF\s+EXISTS\s+"Users can insert own profile"\s+ON\s+public\.profiles/i,
    );
    expect(migration).toMatch(
      /REVOKE\s+INSERT,\s*UPDATE\s+ON\s+TABLE\s+public\.profiles\s+FROM\s+PUBLIC,\s*anon,\s*authenticated/i,
    );
    expect(migration).toMatch(
      /GRANT\s+UPDATE\s*\(\s*avatar_url\s*\)\s+ON\s+TABLE\s+public\.profiles\s+TO\s+authenticated/i,
    );
  });

  it('forces sportsbook bet placement through place_bet_secure', () => {
    expect(migration).toMatch(
      /DROP\s+POLICY\s+IF\s+EXISTS\s+"Users can insert own placed bets"\s+ON\s+public\.placed_bets/i,
    );
    expect(migration).toMatch(
      /DROP\s+POLICY\s+IF\s+EXISTS\s+"Users can insert own coupons"\s+ON\s+public\.coupons/i,
    );
    expect(migration).toMatch(
      /REVOKE\s+INSERT\s+ON\s+TABLE\s+public\.placed_bets\s+FROM\s+PUBLIC,\s*anon,\s*authenticated/i,
    );
    expect(migration).toMatch(
      /REVOKE\s+INSERT\s+ON\s+TABLE\s+public\.coupons\s+FROM\s+PUBLIC,\s*anon,\s*authenticated/i,
    );
  });

  it('preserves user proposal creation without client-controlled moderation fields', () => {
    expect(migration).toMatch(
      /GRANT\s+INSERT\s*\([\s\S]*user_id[\s\S]*title[\s\S]*category_id[\s\S]*bet_type[\s\S]*options[\s\S]*ends_at[\s\S]*proposal_source[\s\S]*agent_metadata[\s\S]*agent_duplicate_key[\s\S]*\)\s+ON\s+TABLE\s+public\.bet_proposals\s+TO\s+authenticated/i,
    );
    expect(migration).toMatch(
      /ALTER\s+TABLE\s+public\.bet_proposals[\s\S]+ALTER\s+COLUMN\s+proposal_source\s+SET\s+DEFAULT\s+'human'/i,
    );
    expect(migration).toMatch(
      /ALTER\s+TABLE\s+public\.bet_proposals[\s\S]+ALTER\s+COLUMN\s+agent_metadata\s+SET\s+DEFAULT\s+'\{\}'::jsonb/i,
    );
    expect(migration).not.toMatch(
      /GRANT\s+INSERT\s*\([^)]*\b(status|created_at)\b[^)]*\)\s+ON\s+TABLE\s+public\.bet_proposals\s+TO\s+authenticated/i,
    );
  });

  it('normalizes legacy direct human proposal fields before insert', () => {
    const functionStart = migration.search(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.normalize_direct_human_bet_proposal_insert/i,
    );
    expect(functionStart).toBeGreaterThan(-1);

    const functionSql = migration.slice(
      functionStart,
      migration.indexOf('$$;', functionStart),
    );

    expect(functionSql).toMatch(/current_user\s+IN\s+\('anon',\s*'authenticated'\)/i);
    expect(functionSql).toMatch(/NEW\.status\s*:=\s*'pending'/i);
    expect(functionSql).toMatch(/NEW\.proposal_source\s*:=\s*'human'/i);
    expect(functionSql).toMatch(/NEW\.agent_metadata\s*:=\s+'\{\}'::jsonb/i);
    expect(functionSql).toMatch(/NEW\.agent_duplicate_key\s*:=\s*NULL/i);
    expect(migration).toMatch(
      /CREATE\s+TRIGGER\s+trg_normalize_direct_human_bet_proposal_insert[\s\S]+BEFORE\s+INSERT\s+ON\s+public\.bet_proposals[\s\S]+EXECUTE\s+FUNCTION\s+public\.normalize_direct_human_bet_proposal_insert\(\)/i,
    );
  });

  it('forces casino social shares and feature poll votes through validating RPCs', () => {
    expect(migration).toMatch(
      /DROP\s+POLICY\s+IF\s+EXISTS\s+"Users can insert own casino social shares"\s+ON\s+public\.casino_social_shares/i,
    );
    expect(migration).toMatch(
      /DROP\s+POLICY\s+IF\s+EXISTS\s+"Users insert own feature poll votes"\s+ON\s+public\.feature_poll_votes/i,
    );
    expect(migration).toMatch(
      /REVOKE\s+INSERT\s+ON\s+TABLE\s+public\.casino_social_shares\s+FROM\s+PUBLIC,\s*anon,\s*authenticated/i,
    );
    expect(migration).toMatch(
      /REVOKE\s+INSERT\s+ON\s+TABLE\s+public\.feature_poll_votes\s+FROM\s+PUBLIC,\s*anon,\s*authenticated/i,
    );
  });

  it('replaces casino share creation with canonical roulette win data', () => {
    const functionStart = migration.search(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.create_casino_social_share/i,
    );
    expect(functionStart).toBeGreaterThan(-1);

    const functionSql = migration.slice(
      functionStart,
      migration.indexOf('$$;', functionStart),
    );
    const insertStart = functionSql.search(
      /INSERT\s+INTO\s+public\.casino_social_shares/i,
    );
    const insertSql = functionSql.slice(insertStart, functionSql.indexOf('ON CONFLICT', insertStart));

    expect(functionSql).toMatch(/p_roulette_bet_id\s+IS\s+NULL/i);
    expect(functionSql).toMatch(
      /FROM\s+public\.casino_roulette_bets\s+AS\s+b[\s\S]+JOIN\s+public\.casino_roulette_rounds\s+AS\s+r\s+ON\s+r\.id\s+=\s+b\.round_id/i,
    );
    expect(functionSql).toMatch(
      /b\.id\s+=\s+p_roulette_bet_id[\s\S]+b\.user_id\s+=\s+p_user_id[\s\S]+b\.is_win\s+IS\s+TRUE[\s\S]+b\.payout\s+>\s+0/i,
    );
    expect(functionSql).toMatch(/r\.phase\s+=\s+'settled'/i);
    expect(insertSql).toMatch(/v_bet_type/i);
    expect(insertSql).toMatch(/v_bet_value/i);
    expect(insertSql).toMatch(/ROUND\s*\(\s*v_bet_stake,\s*2\s*\)/i);
    expect(insertSql).toMatch(/ROUND\s*\(\s*v_bet_payout,\s*2\s*\)/i);
    expect(insertSql).toMatch(/v_round_number::INTEGER/i);
    expect(insertSql).toMatch(/v_winning_number/i);
    expect(insertSql).toMatch(/v_winning_color/i);
    expect(insertSql).not.toMatch(/p_casino_/i);
    expect(migration).toMatch(
      /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.create_casino_social_share\(UUID,\s*UUID,\s*TEXT,\s*TEXT,\s*TEXT,\s*NUMERIC,\s*NUMERIC,\s*INTEGER,\s*INTEGER,\s*TEXT\)\s+FROM\s+PUBLIC,\s*anon/i,
    );
    expect(migration).toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.create_casino_social_share\(UUID,\s*UUID,\s*TEXT,\s*TEXT,\s*TEXT,\s*NUMERIC,\s*NUMERIC,\s*INTEGER,\s*INTEGER,\s*TEXT\)\s+TO\s+authenticated/i,
    );
  });
});
