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
});
