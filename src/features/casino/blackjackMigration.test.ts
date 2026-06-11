import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const persistentMigrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260503010000_blackjack_persistent_tables.sql',
);
const ambiguityFixMigrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260503011000_fix_blackjack_shoe_column_ambiguity.sql',
);
const stateVolatilityFixMigrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260503012000_fix_blackjack_state_volatility.sql',
);
const insuranceMigrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260503013000_blackjack_insurance.sql',
);
const splitAcesPlayableMigrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260611170000_blackjack_split_aces_playable.sql',
);

describe('blackjack persistent table migration', () => {
  it.each([
    ['persistent migration', persistentMigrationPath],
    ['follow-up ambiguity fix migration', ambiguityFixMigrationPath],
  ])('qualifies shoe draw output columns in the %s', (_name, migrationPath) => {
    const migration = readFileSync(migrationPath, 'utf8');

    expect(migration).not.toMatch(
      /SELECT\s+card,\s+remaining,\s+new_shoe_number,\s+reshuffled/i,
    );
    expect(migration).not.toMatch(
      /SELECT\s+new_dealer,\s+new_shoe,\s+new_shoe_number/i,
    );
    expect(migration).toMatch(
      /SELECT\s+d\.card,\s+d\.remaining,\s+d\.new_shoe_number,\s+d\.reshuffled/i,
    );
    expect(migration).toMatch(
      /SELECT\s+dealer_draw\.new_dealer,\s+dealer_draw\.new_shoe,\s+dealer_draw\.new_shoe_number/i,
    );
  });

  it('redefines blackjack state as volatile so shoe metadata reflects action writes', () => {
    const migration = readFileSync(stateVolatilityFixMigrationPath, 'utf8');

    expect(migration).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\._blackjack_state/i,
    );
    expect(migration).toMatch(
      /RETURNS\s+public\.blackjack_game_state[\s\S]*?LANGUAGE\s+plpgsql[\s\S]*?VOLATILE/i,
    );
    expect(migration).not.toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\._blackjack_state[\s\S]*?LANGUAGE\s+plpgsql[\s\S]*?STABLE/i,
    );
  });

  it('adds insurance as a server-authoritative blackjack decision state', () => {
    const migration = readFileSync(insuranceMigrationPath, 'utf8');

    expect(migration).toMatch(
      /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+insurance_status/i,
    );
    expect(migration).toMatch(/ADD\s+ATTRIBUTE\s+insurance_status\s+TEXT/i);
    expect(migration).toMatch(
      /status\s+IN\s+\('playing',\s*'insurance',\s*'won',\s*'lost',\s*'push'\)/i,
    );
    expect(migration).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.blackjack_take_insurance/i,
    );
    expect(migration).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.blackjack_decline_insurance/i,
    );
    expect(migration).toMatch(
      /WHERE\s+user_id\s+=\s+p_user_id[\s\S]*status\s+IN\s+\('playing',\s*'insurance'\)/i,
    );
    expect(migration).toMatch(
      /RETURN\s+public\._blackjack_state\(v_game,\s+TRUE\)/i,
    );
  });

  it('keeps hands playable after splitting aces', () => {
    const migration = readFileSync(splitAcesPlayableMigrationPath, 'utf8');

    expect(migration).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.blackjack_split/i,
    );
    // Split hands must always be created as 'playing' — no auto-stand for aces.
    expect(migration).not.toMatch(/CASE\s+WHEN\s+v_split_aces\s+THEN\s+'stand'/i);
    expect(migration).toMatch(/'playing',\s*\n\s*FALSE,\s*\n\s*v_split_aces/);
    // The isSplitAces flag still reaches the hand object for UI badges.
    expect(migration).toMatch(/v_split_aces\s*:=/);
    expect(migration).toMatch(
      /SELECT\s+d\.card,\s+d\.remaining,\s+d\.new_shoe_number,\s+d\.reshuffled/i,
    );
  });
});
