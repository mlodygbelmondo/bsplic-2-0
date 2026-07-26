import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const MIRROR_DIR = 'supabase/schema/daily_jackpot';
const MIGRATIONS_DIR = 'supabase/migrations';

const LIFECYCLE_FUNCTIONS = [
  { mirror: 'daily_jackpot_rules', sqlName: 'private.daily_jackpot_rules' },
  {
    mirror: 'get_daily_jackpot_snapshot',
    sqlName: 'private.get_daily_jackpot_snapshot',
  },
  {
    mirror: 'get_empty_daily_jackpot_snapshot',
    sqlName: 'private.get_empty_daily_jackpot_snapshot',
  },
  {
    mirror: 'sync_daily_jackpot_funding',
    sqlName: 'private.sync_daily_jackpot_funding',
  },
  {
    mirror: 'finalize_daily_jackpot_pool',
    sqlName: 'private.finalize_daily_jackpot_pool',
  },
  {
    mirror: 'buy_daily_jackpot_ticket',
    sqlName: 'public.buy_daily_jackpot_ticket',
  },
  {
    mirror: 'get_daily_jackpot_state',
    sqlName: 'public.get_daily_jackpot_state',
  },
  {
    mirror: 'get_daily_jackpot_draw',
    sqlName: 'public.get_daily_jackpot_draw',
  },
];

const migrationFiles = readdirSync(join(process.cwd(), MIGRATIONS_DIR))
  .filter((file) => file.endsWith('.sql'))
  .sort();
const migrationSqlByFile = new Map(
  migrationFiles.map((file) => [
    file,
    readFileSync(join(process.cwd(), MIGRATIONS_DIR, file), 'utf8'),
  ]),
);

function readMirror(name: string): string {
  return readFileSync(join(process.cwd(), MIRROR_DIR, `${name}.sql`), 'utf8');
}

function extractDefinitions(sql: string, sqlName: string): string[] {
  const escapedName = sqlName.replaceAll('.', '\\.');
  const header = new RegExp(
    `CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+${escapedName}\\s*\\(`,
    'gi',
  );

  return Array.from(sql.matchAll(header), (match) => {
    const start = match.index;
    const remainder = sql.slice(start);
    const delimiterMatch = remainder.match(/\bAS\s+(\$[A-Za-z0-9_]*\$)/i);
    expect(delimiterMatch).not.toBeNull();
    const delimiter = delimiterMatch![1];
    const bodyStart = delimiterMatch!.index! + delimiterMatch![0].length;
    const closingDelimiter = remainder.indexOf(delimiter, bodyStart);
    expect(closingDelimiter).toBeGreaterThanOrEqual(0);
    return remainder
      .slice(0, closingDelimiter + delimiter.length + 1)
      .trimEnd();
  });
}

const currentDefinitions = new Map(
  LIFECYCLE_FUNCTIONS.map(({ mirror, sqlName }) => {
    let latest: { definition: string; migrationFile: string } | null = null;
    for (const migrationFile of migrationFiles) {
      const definitions = extractDefinitions(
        migrationSqlByFile.get(migrationFile) ?? '',
        sqlName,
      );
      for (const definition of definitions) {
        latest = { definition, migrationFile };
      }
    }
    expect(latest, `No migration defines ${sqlName}`).not.toBeNull();
    return [mirror, latest!] as const;
  }),
);

const currentMigrationSql = Array.from(
  new Set(
    Array.from(currentDefinitions.values(), ({ migrationFile }) => migrationFile),
  ),
)
  .map((file) => migrationSqlByFile.get(file) ?? '')
  .join('\n');

const currentLifecycleSql = Array.from(
  currentDefinitions.values(),
  ({ definition }) => definition,
).join('\n');

describe('jackpot lifecycle consolidation', () => {
  it('mirrors every lifecycle function', () => {
    const files = readdirSync(join(process.cwd(), MIRROR_DIR))
      .filter((file) => file.endsWith('.sql'))
      .map((file) => file.replace(/\.sql$/, ''))
      .sort();
    expect(files).toEqual(
      LIFECYCLE_FUNCTIONS.map(({ mirror }) => mirror).sort(),
    );
  });

  for (const { mirror } of LIFECYCLE_FUNCTIONS) {
    it(`keeps the ${mirror} mirror identical to its newest migration definition`, () => {
      const [definition] = extractDefinitions(
        readMirror(mirror),
        LIFECYCLE_FUNCTIONS.find((entry) => entry.mirror === mirror)!.sqlName,
      );
      expect(definition).toBe(currentDefinitions.get(mirror)?.definition);
    });
  }

  it('drives the per-player ticket limit from the single rule source', () => {
    expect(currentLifecycleSql).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+private\.daily_jackpot_rules\(\)/i,
    );
    expect(currentLifecycleSql).toMatch(/'max_tickets_per_player',\s*2/i);
    expect(currentLifecycleSql).toMatch(
      /v_user_ticket_count\s*>=\s*v_max_tickets_per_player/i,
    );
    expect(currentLifecycleSql).toMatch(
      /'Limit ticketów w tej puli to % na gracza',\s*v_max_tickets_per_player/i,
    );
    expect(currentLifecycleSql).not.toMatch(/v_user_ticket_count\s*>=\s*2\b/);
  });

  it('keeps the lifecycle functions locked down for browser roles', () => {
    expect(currentMigrationSql).toMatch(
      /REVOKE\s+ALL\s+ON\s+FUNCTION\s+private\.finalize_daily_jackpot_pool\(DATE,\s*UUID\)[\s\S]*?FROM\s+PUBLIC,\s*anon,\s*authenticated/i,
    );
    expect(currentMigrationSql).toMatch(
      /REVOKE\s+ALL\s+ON\s+FUNCTION\s+private\.sync_daily_jackpot_funding\(DATE\)[\s\S]*?FROM\s+PUBLIC,\s*anon,\s*authenticated/i,
    );
    expect(currentMigrationSql).toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.get_daily_jackpot_state\(\)\s+TO\s+authenticated/i,
    );
    expect(currentMigrationSql).toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.buy_daily_jackpot_ticket\(UUID\)\s+TO\s+authenticated/i,
    );
  });

  it('preserves the multi-ticket refund aggregation from the newest finalize fix', () => {
    expect(currentLifecycleSql).toMatch(
      /ROUND\(SUM\(price\),\s*2\)\s+AS\s+refund_amount/i,
    );
    expect(currentLifecycleSql).toMatch(/GROUP\s+BY\s+user_id/i);
  });

  it('preserves season-aware 20% funding from the newest sync definition', () => {
    expect(currentLifecycleSql).toMatch(/ROUND\(c\.stake\s*\*\s*0\.20,\s*2\)/i);
    expect(currentLifecycleSql).toMatch(
      /private\.get_active_season_started_at\(\)/i,
    );
  });
});
