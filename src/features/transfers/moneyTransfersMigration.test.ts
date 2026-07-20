import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const notificationMigration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260720090000_add_money_transfer_notification_type.sql',
  ),
  'utf8',
);
const transferMigration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260720090100_money_transfers.sql',
  ),
  'utf8',
);
const optimizedRecipientSearchMigration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260720100000_optimize_money_transfer_recipient_search.sql',
  ),
  'utf8',
);

describe('money transfer migrations', () => {
  it('adds a dedicated notification type before the transfer RPC is created', () => {
    expect(notificationMigration).toMatch(
      /ALTER\s+TYPE\s+public\.notification_type[\s\S]*ADD\s+VALUE\s+IF\s+NOT\s+EXISTS\s+'money_transfer'/i,
    );
    expect(transferMigration).toMatch(/'money_transfer'::public\.notification_type/i);
  });

  it('keeps the ledger append-only for browser roles', () => {
    expect(transferMigration).toMatch(/CREATE\s+TABLE\s+public\.money_transfers/i);
    expect(transferMigration).toMatch(
      /ALTER\s+TABLE\s+public\.money_transfers\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i,
    );
    expect(transferMigration).toMatch(
      /REVOKE\s+ALL\s+ON\s+TABLE\s+public\.money_transfers[\s\S]*FROM\s+PUBLIC,\s*anon,\s*authenticated/i,
    );
  });

  it('protects balance and account age while preserving avatar updates', () => {
    expect(transferMigration).toMatch(
      /REVOKE\s+UPDATE\s+ON\s+TABLE\s+public\.profiles\s+FROM\s+PUBLIC,\s*anon,\s*authenticated/i,
    );
    expect(transferMigration).toMatch(
      /GRANT\s+UPDATE\s*\(avatar_url\)\s+ON\s+TABLE\s+public\.profiles\s+TO\s+authenticated/i,
    );
    expect(transferMigration).toMatch(
      /FROM\s+auth\.users\s+auth_user[\s\S]*auth_user\.id\s*=\s*v_sender_id/i,
    );
    expect(transferMigration).toMatch(/NOW\(\)\s*-\s*INTERVAL\s+'14 days'/i);
  });

  it('performs an authenticated, atomic and idempotent balance transfer', () => {
    expect(transferMigration).toMatch(/v_sender_id\s+UUID\s*:=\s*auth\.uid\(\)/i);
    expect(transferMigration).toMatch(
      /ORDER\s+BY\s+profile\.id[\s\S]*FOR\s+UPDATE/i,
    );
    expect(transferMigration).toMatch(
      /UNIQUE\s*\(sender_id,\s*idempotency_key\)/i,
    );
    expect(transferMigration).toMatch(
      /SET\s+balance\s*=\s*balance\s*-\s*p_amount/i,
    );
    expect(transferMigration).toMatch(
      /SET\s+balance\s*=\s*balance\s*\+\s*p_amount/i,
    );
  });

  it('enforces the agreed amount, message and rolling rate limits', () => {
    expect(transferMigration).toMatch(/amount\s+>=\s+1/i);
    expect(transferMigration).toMatch(/ROUND\(p_amount,\s*2\)/i);
    expect(transferMigration).toMatch(/CHAR_LENGTH\(v_message\)\s*>\s*2000/i);
    expect(transferMigration).toMatch(
      /p_amount::TEXT\s+IN\s*\('NaN',\s*'Infinity',\s*'-Infinity'\)/i,
    );
    expect(transferMigration).toMatch(
      /v_sender_balance::TEXT\s+IN\s*\('NaN',\s*'Infinity',\s*'-Infinity'\)/i,
    );
    expect(transferMigration).toMatch(
      /created_at\s*>\s*NOW\(\)\s*-\s*INTERVAL\s+'1 hour'[\s\S]*\)\s*>=\s*5/i,
    );
  });

  it('keeps username and avatar snapshots for durable private history', () => {
    expect(transferMigration).toMatch(/sender_username_snapshot\s+TEXT\s+NOT\s+NULL/i);
    expect(transferMigration).toMatch(/recipient_username_snapshot\s+TEXT\s+NOT\s+NULL/i);
    expect(transferMigration).toMatch(/sender_avatar_snapshot\s+TEXT/i);
    expect(transferMigration).toMatch(/recipient_avatar_snapshot\s+TEXT/i);
  });

  it('blocks restricted and agent accounts in search and transfer execution', () => {
    expect(transferMigration).toMatch(/private\.transfer_restricted_accounts/i);
    expect(transferMigration.match(/private\.is_agent_profile/g)?.length).toBeGreaterThanOrEqual(3);
    expect(transferMigration).toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.create_money_transfer[\s\S]*TO\s+authenticated/i,
    );
  });

  it('exposes history only for the authenticated participant', () => {
    expect(transferMigration).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.get_money_transfer_history/i,
    );
    expect(transferMigration).toMatch(
      /WHERE\s+transfer\.sender_id\s*=\s*v_user_id\s+OR\s+transfer\.recipient_id\s*=\s*v_user_id/i,
    );
  });

  it('uses an indexed literal substring for recipient search', () => {
    expect(optimizedRecipientSearchMigration).toMatch(
      /CREATE\s+INDEX[\s\S]*USING\s+gin\s*\(\s*LOWER\(username\)\s+extensions\.gin_trgm_ops\s*\)/i,
    );
    expect(optimizedRecipientSearchMigration).toMatch(
      /LOWER\(profile\.username\)\s+LIKE\s*'%'\s*\|\|\s*v_pattern\s*\|\|\s*'%'\s+ESCAPE\s*'\\'/i,
    );
    expect(optimizedRecipientSearchMigration).toMatch(
      /REPLACE\(REPLACE\(LOWER\(v_query\),\s*'\\',\s*'\\\\'\),\s*'%',\s*'\\%'\)/i,
    );
    expect(optimizedRecipientSearchMigration).toMatch(
      /REPLACE\([\s\S]*'_',\s*'\\_'/i,
    );
  });
});
