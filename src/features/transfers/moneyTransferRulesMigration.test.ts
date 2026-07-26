import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const rulesMigration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260724220000_money_transfer_rules.sql',
  ),
  'utf8',
);

describe('money transfer rules migration', () => {
  it('defines a single private authority for the rule values', () => {
    expect(rulesMigration).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+private\.money_transfer_rules\(\)/i,
    );
    expect(rulesMigration).toMatch(/'min_amount',\s*1\.00/i);
    expect(rulesMigration).toMatch(/'max_message_length',\s*2000/i);
    expect(rulesMigration).toMatch(/'max_transfers_per_hour',\s*5/i);
    expect(rulesMigration).toMatch(/'min_account_age_days',\s*14/i);
    expect(rulesMigration).toMatch(
      /REVOKE\s+ALL\s+ON\s+FUNCTION\s+private\.money_transfer_rules\(\)[\s\S]*FROM\s+PUBLIC,\s*anon,\s*authenticated/i,
    );
  });

  it('re-bases enforcement on the private rule source', () => {
    expect(rulesMigration).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.create_money_transfer/i,
    );
    expect(rulesMigration).toMatch(
      /v_rules\s+JSONB\s*:=\s*private\.money_transfer_rules\(\)/i,
    );
    expect(rulesMigration).toMatch(/p_amount\s*<\s*v_min_amount/i);
    expect(rulesMigration).toMatch(
      /CHAR_LENGTH\(v_message\)\s*>\s*v_max_message_length/i,
    );
    expect(rulesMigration).toMatch(/>=\s*v_max_transfers_per_hour/i);
    expect(rulesMigration).toMatch(
      /MAKE_INTERVAL\(days\s*=>\s*v_min_account_age_days\)/i,
    );
    expect(rulesMigration).toMatch(
      /ADD\s+CONSTRAINT\s+money_transfers_minimum_amount[\s\S]*?private\.money_transfer_rules\(\)/i,
    );
    expect(rulesMigration).toMatch(
      /ADD\s+CONSTRAINT\s+money_transfers_message_length[\s\S]*?private\.money_transfer_rules\(\)/i,
    );
  });

  it('exposes the rules with sender eligibility to authenticated users only', () => {
    expect(rulesMigration).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.get_money_transfer_rules\(\)/i,
    );
    expect(rulesMigration).toMatch(/'sender_eligible_at',\s*v_eligible_at/i);
    expect(rulesMigration).toMatch(
      /'sender_eligible',\s*v_eligible_at\s+IS\s+NOT\s+NULL\s+AND\s+v_eligible_at\s*<=\s*NOW\(\)/i,
    );
    expect(rulesMigration).toMatch(/'server_now',\s*NOW\(\)/i);
    expect(rulesMigration).toMatch(
      /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.get_money_transfer_rules\(\)[\s\S]*FROM\s+PUBLIC,\s*anon/i,
    );
    expect(rulesMigration).toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.get_money_transfer_rules\(\)[\s\S]*TO\s+authenticated/i,
    );
  });
});
