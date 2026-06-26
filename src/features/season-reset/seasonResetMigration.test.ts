import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationsDir = join(process.cwd(), 'supabase/migrations');
const migrationFiles = readdirSync(migrationsDir)
  .filter((file) => file.endsWith('.sql'))
  .sort();
const migrationSqlByFile = new Map(
  migrationFiles.map((file) => [
    file,
    readFileSync(join(migrationsDir, file), 'utf8'),
  ]),
);
const migrationSql = migrationFiles
  .map((file) => migrationSqlByFile.get(file) ?? '')
  .join('\n');

const resetMigrationFile = migrationFiles.find((file) =>
  file.endsWith('_global_season_reset.sql'),
);
const resetMigration = resetMigrationFile
  ? migrationSqlByFile.get(resetMigrationFile) ?? ''
  : '';

function getLatestFunctionBody(functionNamePattern: string): string {
  const pattern = new RegExp(
    `CREATE OR REPLACE FUNCTION ${functionNamePattern}[\\s\\S]*?\\n\\$\\$;`,
    'gm',
  );
  return Array.from(migrationSql.matchAll(pattern), (match) => match[0]).at(-1) ?? '';
}

describe('global season reset migration', () => {
  it('creates locked-down season metadata and a central active boundary helper', () => {
    expect(resetMigrationFile).toBeTruthy();
    expect(resetMigration).toMatch(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.seasons/i);
    expect(resetMigration).toMatch(/ALTER\s+TABLE\s+public\.seasons\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
    expect(resetMigration).toMatch(/REVOKE\s+ALL\s+ON\s+TABLE\s+public\.seasons\s+FROM\s+anon,\s*authenticated/i);
    expect(resetMigration).toMatch(/CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+seasons_one_active_idx/i);
    expect(resetMigration).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+private\.get_active_season_started_at\(\)/i);
    expect(resetMigration).toContain("'-infinity'::TIMESTAMPTZ");
  });

  it('adds preview and service-role-only execute reset RPCs with matching summary keys', () => {
    expect(resetMigration).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.preview_global_season_reset/i);
    expect(resetMigration).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.execute_global_season_reset/i);
    expect(resetMigration).toContain('pg_try_advisory_xact_lock');
    expect(resetMigration).toMatch(/IF\s+COALESCE\(p_confirm,\s*FALSE\)\s+IS\s+NOT\s+TRUE\s+THEN/i);
    expect(resetMigration).toMatch(
      /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.execute_global_season_reset\(TIMESTAMPTZ,\s*BOOLEAN\)\s+FROM\s+PUBLIC,\s*anon,\s*authenticated/i,
    );
    expect(resetMigration).toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.execute_global_season_reset\(TIMESTAMPTZ,\s*BOOLEAN\)\s+TO\s+service_role/i,
    );

    [
      'mode',
      'reset_at',
      'profiles_reset',
      'pending_coupons_refunded',
      'expired_events_deactivated',
      'sportsbook_records_archived',
      'casino_records_archived',
      'jackpot_records_isolated',
      'economic_social_items_hidden',
      'badges_archived',
    ].forEach((key) => {
      expect(resetMigration).toContain(`'${key}'`);
    });
  });

  it('resets player economy, refunds pending coupons, and deactivates expired events without deleting archive rows', () => {
    const executeBody = getLatestFunctionBody(
      'public\\.execute_global_season_reset\\(\\s*p_reset_at TIMESTAMPTZ DEFAULT NOW\\(\\),\\s*p_confirm BOOLEAN DEFAULT FALSE\\s*\\)',
    );

    expect(resetMigration).toMatch(/UPDATE\s+public\.profiles/i);
    expect(resetMigration).toMatch(/balance\s*=\s*500/i);
    expect(resetMigration).toMatch(/last_topup_at\s*=\s*NULL/i);
    expect(resetMigration).toMatch(/current_streak\s*=\s*0/i);
    expect(resetMigration).toMatch(/longest_streak\s*=\s*0/i);
    expect(resetMigration).toMatch(/last_bet_date\s*=\s*NULL/i);
    expect(resetMigration).toMatch(/UPDATE\s+public\.placed_bets[\s\S]+result\s*=\s*'refund'/i);
    expect(resetMigration).toMatch(/UPDATE\s+public\.coupons[\s\S]+status\s*=\s*'refund'/i);
    expect(executeBody).toMatch(/payout\s*=\s*ROUND\(rc\.stake,\s*2\)/i);
    expect(executeBody).toMatch(/WITH\s+reset_coupons\s+AS/i);
    expect(executeBody).toMatch(/UPDATE\s+public\.coupons\s+c[\s\S]+settled_at\s*=\s*p_reset_at[\s\S]+FROM\s+reset_coupons\s+rc/i);
    expect(resetMigration).toMatch(/UPDATE\s+public\.bets[\s\S]+is_active\s*=\s*FALSE[\s\S]+ends_at\s*<=\s*p_reset_at/i);
    expect(resetMigration).not.toMatch(/DELETE\s+FROM\s+public\.(bets|coupons|placed_bets|badges|casino_roulette_bets|casino_blackjack_games)/i);
  });

  it('makes sportsbook profile, history, and ranking contracts season-aware', () => {
    [
      'private\\.sportsbook_ranking_units\\(p_user_id UUID DEFAULT NULL\\)',
      'private\\.get_user_stats_for_rpc\\(p_user_id UUID\\)',
      'public\\.get_user_coupon_history\\(\\s*p_user_id UUID,\\s*p_limit INTEGER DEFAULT 50,\\s*p_offset INTEGER DEFAULT 0\\s*\\)',
      'public\\.get_public_profile\\(p_user_id UUID\\)',
    ].forEach((functionPattern) => {
      const body = getLatestFunctionBody(functionPattern);
      expect(body).toContain('private.get_active_season_started_at()');
    });
  });

  it('makes casino history and rankings season-aware', () => {
    [
      'public\\.get_user_casino_history\\(\\s*p_user_id UUID,\\s*p_limit INTEGER DEFAULT 100,\\s*p_offset INTEGER DEFAULT 0\\s*\\)',
      'public\\.get_casino_rankings\\(\\)',
    ].forEach((functionPattern) => {
      const body = getLatestFunctionBody(functionPattern);
      expect(body).toContain('private.get_active_season_started_at()');
      expect(body).toMatch(/created_at\s*>=\s*v_season_started_at/i);
    });
  });

  it('hides old economic social items while preserving text posts', () => {
    const feedBody = getLatestFunctionBody(
      'public\\.get_social_feed\\(\\s*p_limit INTEGER DEFAULT 30,\\s*p_offset INTEGER DEFAULT 0,\\s*p_user_id UUID DEFAULT NULL\\s*\\)',
    );
    const itemBody = getLatestFunctionBody(
      'public\\.get_social_feed_item\\(\\s*p_item_type TEXT,\\s*p_item_id UUID,\\s*p_user_id UUID DEFAULT NULL\\s*\\)',
    );

    expect(feedBody).toContain('private.get_active_season_started_at()');
    expect(feedBody).toMatch(/FROM\s+public\.social_posts\s+sp[\s\S]+JOIN\s+public\.profiles/i);
    expect(feedBody).toMatch(/FROM\s+public\.coupons\s+c[\s\S]+c\.created_at\s*>=\s*v_season_started_at/i);
    expect(feedBody).toMatch(/FROM\s+public\.casino_social_shares\s+cs[\s\S]+cs\.created_at\s*>=\s*v_season_started_at/i);

    expect(itemBody).toContain('private.get_active_season_started_at()');
    expect(itemBody).toMatch(/p_item_type\s*=\s*'coupon'[\s\S]+c\.created_at\s*>=\s*v_season_started_at/i);
    expect(itemBody).toMatch(/p_item_type\s*=\s*'casino'[\s\S]+cs\.created_at\s*>=\s*v_season_started_at/i);
  });

  it('keeps badges archived but visible and awardable only in the active season', () => {
    const awardBadgeBody = getLatestFunctionBody(
      'public\\.award_badge\\(p_user_id UUID,\\s*p_badge_key TEXT\\)',
    );
    const publicBadgesBody = getLatestFunctionBody('public\\.get_public_badges\\(p_user_id UUID\\)');
    const privateBadgesBody = getLatestFunctionBody('private\\.get_public_badges_for_rpc\\(p_user_id UUID\\)');

    expect(resetMigration).toMatch(/DROP\s+CONSTRAINT\s+IF\s+EXISTS\s+badges_user_id_badge_key_key/i);
    expect(resetMigration).toMatch(/CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+badges_user_badge_season_unique/i);
    expect(resetMigration).toMatch(/CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+badges_user_badge_preseason_unique/i);
    expect(awardBadgeBody).toContain('private.get_active_season_started_at()');
    expect(awardBadgeBody).toMatch(/unlocked_at\s*>=\s*v_season_started_at/i);
    expect(awardBadgeBody).toMatch(/ON\s+CONFLICT\s+DO\s+NOTHING/i);
    expect(resetMigration).toMatch(
      /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.award_badge\(UUID,\s*TEXT\)\s+FROM\s+PUBLIC,\s*anon,\s*authenticated/i,
    );
    expect(publicBadgesBody).toContain('private.get_public_badges_for_rpc(p_user_id)');
    expect(privateBadgesBody).toContain('private.get_active_season_started_at()');
    expect(privateBadgesBody).toMatch(/unlocked_at\s*>=\s*v_season_started_at/i);
  });

  it('replaces badge trigger helpers with active-season criteria', () => {
    const insertBody = getLatestFunctionBody('public\\.check_badges_on_bet_insert\\(\\)');
    const resultBody = getLatestFunctionBody('public\\.check_badges_on_bet_result\\(\\)');

    expect(insertBody).toContain('private.get_active_season_started_at()');
    expect(insertBody).toMatch(/FROM\s+public\.placed_bets[\s\S]+user_id\s*=\s*NEW\.user_id[\s\S]+created_at\s*>=\s*v_season_started_at/i);
    expect(insertBody).toMatch(/WHERE\s+coupon_id\s*=\s*NEW\.coupon_id[\s\S]+created_at\s*>=\s*v_season_started_at/i);
    expect(insertBody).toMatch(/count\(DISTINCT coupon_id\)[\s\S]+created_at\s*>=\s*v_season_started_at/i);
    expect(insertBody).toMatch(/JOIN\s+public\.bets\s+b[\s\S]+pb\.created_at\s*>=\s*v_season_started_at/i);

    expect(resultBody).toContain('private.get_active_season_started_at()');
    expect(resultBody).toMatch(/result\s*=\s*'won'[\s\S]+id\s*<>\s*NEW\.id[\s\S]+created_at\s*>=\s*v_season_started_at/i);
    expect(resultBody).toMatch(/result\s+IN\s+\('won',\s*'lost'\)[\s\S]+created_at\s*>=\s*v_season_started_at/i);
    expect(resultBody).toMatch(/SUM\(payout\)[\s\S]+result\s*=\s*'won'[\s\S]+created_at\s*>=\s*v_season_started_at/i);
    expect(resultBody).toMatch(/count\(\*\)\s+FILTER[\s\S]+created_at\s*>=\s*v_season_started_at/i);
  });

  it('keeps badge backfill service-role-only and reset-aware', () => {
    const backfillBody = getLatestFunctionBody('public\\.backfill_streaks_and_badges\\(\\)');

    expect(backfillBody).toContain('private.get_active_season_started_at()');
    expect(backfillBody).toMatch(/SELECT\s+DISTINCT\s+user_id[\s\S]+FROM\s+public\.placed_bets[\s\S]+created_at\s*>=\s*v_season_started_at/i);
    expect(backfillBody).toMatch(/SELECT\s+DISTINCT\s+created_at::DATE\s+AS\s+bet_date[\s\S]+created_at\s*>=\s*v_season_started_at/i);
    expect(backfillBody).toMatch(/FROM\s+public\.bet_proposals[\s\S]+status\s*=\s*'accepted'[\s\S]+created_at\s*>=\s*v_season_started_at/i);
    expect(resetMigration).toMatch(
      /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.backfill_streaks_and_badges\(\)\s+FROM\s+PUBLIC,\s*anon,\s*authenticated/i,
    );
    expect(resetMigration).toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.backfill_streaks_and_badges\(\)\s+TO\s+service_role/i,
    );
  });
});
