# Global Season Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first safe global season reset slice: active season boundary, operator dry-run/execute command, core reset mutations, and season-aware user-facing economic reads.

**Architecture:** Put the reset source of truth in Supabase via a fresh migration. A private season-boundary helper drives all season-aware RPCs, while a service-role-only execute RPC performs the transactional reset. A small Node CLI calls preview or execute and prints the database summary.

**Tech Stack:** Supabase Postgres migrations/RPCs, Vite React TypeScript, Vitest migration contract tests, Node ESM CLI scripts, npm.

---

## Source Documents

- PRD: `.ai/docs/prd/2026-06-26-global-season-reset.md`
- Design: `docs/superpowers/specs/2026-06-26-global-season-reset-design.md`

## File Structure

- Create: `src/features/season-reset/seasonResetMigration.test.ts`
  - Text-contract tests over the latest reset migration and latest overridden RPC bodies.
- Create: `src/features/season-reset/operatorCli.test.ts`
  - Unit tests for reset CLI argument parsing and environment validation.
- Create: `scripts/global-season-reset.mjs`
  - Operator command entry point.
- Create: `scripts/lib/bsplic-operator-rpc.mjs`
  - Service-role RPC helper shared by the reset CLI.
- Modify: `package.json`
  - Add `season:reset` npm script.
- Create via Supabase CLI: `supabase/migrations/<generated>_global_season_reset.sql`
  - New season metadata, reset preview/execute RPCs, and season-aware function overrides.
- Optional narrow update: `src/integrations/supabase/types.ts`
  - Add new RPC/table typings only if frontend or tests need generated type coverage.

## Pre-Implementation Checks

- [x] **Step 1: Check current Supabase guidance**

Run:

```bash
curl -L https://supabase.com/changelog.md | sed -n '1,180p'
npx supabase --help
npx supabase migration --help
```

Expected: no relevant breaking change blocks ordinary SQL migrations/RPC grants. Use the CLI-discovered migration command, not a guessed one.

### Task 1: Migration Contract Tests

**Files:**
- Create: `src/features/season-reset/seasonResetMigration.test.ts`
- Later create: `supabase/migrations/<generated>_global_season_reset.sql`

- [x] **Step 1: Write the failing migration contract tests**

Test helper requirements:

```ts
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationsDir = join(process.cwd(), 'supabase/migrations');
const migrationFiles = readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort();
const migrationSql = migrationFiles.map((file) => readFileSync(join(migrationsDir, file), 'utf8')).join('\n');

function findMigrationBySuffix(suffix: string) {
  const file = migrationFiles.find((name) => name.endsWith(suffix));
  if (!file) throw new Error(`Missing migration ending with ${suffix}`);
  return readFileSync(join(migrationsDir, file), 'utf8');
}

function getLatestFunctionBody(functionPattern: string) {
  const pattern = new RegExp(`CREATE OR REPLACE FUNCTION ${functionPattern}[\\s\\S]*?\\n(?:END;|  SELECT)[\\s\\S]*?\\n\\$\\$;`, 'gm');
  return Array.from(migrationSql.matchAll(pattern), (match) => match[0]).at(-1) ?? '';
}
```

Required assertions:

- migration creates `public.seasons`, enables RLS, revokes broad access, and creates `private.get_active_season_started_at()`,
- migration creates `public.preview_global_season_reset(...)` and `public.execute_global_season_reset(...)`,
- execute uses `pg_try_advisory_xact_lock`, requires `p_confirm`, and is granted only to `service_role`,
- preview and execute JSON include stable keys: `mode`, `reset_at`, `profiles_reset`, `pending_coupons_refunded`, `expired_events_deactivated`, `sportsbook_records_archived`, `casino_records_archived`, `jackpot_records_isolated`, `economic_social_items_hidden`, `badges_archived`,
- reset SQL updates profiles to balance `500`, clears `last_topup_at`, `current_streak`, `longest_streak`, and `last_bet_date`,
- reset SQL refunds pre-cutoff pending coupons and deactivates expired events without deleting `public.bets`,
- latest `private.sportsbook_ranking_units`, `get_user_coupon_history`, `get_user_casino_history`, `get_casino_rankings`, `get_social_feed`, `get_social_feed_item`, and `get_public_badges` all reference `private.get_active_season_started_at()`,
- latest `award_badge` has active-season conflict handling instead of relying on historical `UNIQUE (user_id, badge_key)`.

- [x] **Step 2: Run the failing test**

Run:

```bash
npm run test -- src/features/season-reset/seasonResetMigration.test.ts
```

Expected: FAIL because the migration does not exist yet.

### Task 2: Global Season Reset Migration

**Files:**
- Create via CLI: `supabase/migrations/<generated>_global_season_reset.sql`
- Test: `src/features/season-reset/seasonResetMigration.test.ts`

- [x] **Step 1: Create the migration file with Supabase CLI**

Run:

```bash
npx supabase migration new global_season_reset
```

Expected: a new file under `supabase/migrations/` ending in `_global_season_reset.sql`.

- [x] **Step 2: Implement season metadata**

Migration SQL must include:

```sql
CREATE TABLE IF NOT EXISTS public.seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT seasons_active_ended_check CHECK (
    (is_active = TRUE AND ended_at IS NULL)
    OR (is_active = FALSE)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS seasons_one_active_idx
  ON public.seasons (is_active)
  WHERE is_active = TRUE;

ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.seasons FROM anon, authenticated;
```

Add:

```sql
CREATE OR REPLACE FUNCTION private.get_active_season_started_at()
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT started_at FROM public.seasons WHERE is_active = TRUE ORDER BY started_at DESC LIMIT 1),
    '-infinity'::TIMESTAMPTZ
  );
$$;
```

- [x] **Step 3: Implement preview and execute summary helpers**

Create a private shared summary function so preview and execute return the same keys. Summary should count pre-cutoff economic records, not delete them.

Important shape:

```sql
jsonb_build_object(
  'mode', p_mode,
  'reset_at', p_reset_at,
  'profiles_reset', ...,
  'pending_coupons_refunded', ...,
  'expired_events_deactivated', ...,
  'sportsbook_records_archived', ...,
  'casino_records_archived', ...,
  'jackpot_records_isolated', ...,
  'economic_social_items_hidden', ...,
  'badges_archived', ...
)
```

- [x] **Step 4: Implement execute mutations**

Execute should:

- reject unless `p_confirm = TRUE`,
- acquire a reset advisory transaction lock,
- close old active seasons and insert the new active season,
- set pre-cutoff pending placed bets to `refund`,
- set pre-cutoff pending coupons to `refund`, `payout = stake`, `settled_at = p_reset_at`,
- reset every profile economy/progression field,
- deactivate expired events with `ends_at <= p_reset_at`,
- isolate unresolved pre-cutoff jackpot pools/tickets from post-reset payout,
- mark pre-cutoff playable blackjack games as non-playable/archived by status compatible with current constraints.

- [x] **Step 5: Override season-aware RPCs**

Add `private.get_active_season_started_at()` filters to:

- `private.sportsbook_ranking_units`,
- `private.get_user_stats_for_rpc`,
- `public.get_user_coupon_history`,
- `public.get_public_profile`,
- `public.get_user_casino_history`,
- `public.get_casino_rankings`,
- `public.get_social_feed`,
- `public.get_social_feed_item`,
- `public.get_public_badges`,
- `public.award_badge`.

Text posts must not be filtered. Coupon and casino social items must be filtered by their own economic item `created_at`.

- [x] **Step 6: Fix badge re-earning**

Drop or replace the historical unique constraint/index that blocks re-earning:

```sql
ALTER TABLE public.badges
  DROP CONSTRAINT IF EXISTS badges_user_id_badge_key_key;
```

Add a partial expression unique index scoped to active-season-equivalent rows if using timestamps, or add a `season_id` column if the implementation chooses explicit season identity. Keep this small; do not rewrite the badge model beyond reset needs.

- [x] **Step 7: Run migration tests green**

Run:

```bash
npm run test -- src/features/season-reset/seasonResetMigration.test.ts
```

Expected: PASS.

### Task 3: Operator CLI Tests

**Files:**
- Create: `src/features/season-reset/operatorCli.test.ts`
- Create: `scripts/lib/bsplic-operator-rpc.mjs`
- Create: `scripts/global-season-reset.mjs`
- Modify: `package.json`

- [x] **Step 1: Write failing CLI tests**

Test the exported parser/helper functions through dynamic import:

```ts
const cli = await import('../../../scripts/global-season-reset.mjs');
expect(cli.parseResetArgs(['--dry-run'])).toEqual({ mode: 'dry-run', cutoff: null });
expect(cli.parseResetArgs(['--execute', '--cutoff', '2026-06-26T12:00:00Z'])).toEqual({
  mode: 'execute',
  cutoff: '2026-06-26T12:00:00Z',
});
expect(() => cli.parseResetArgs(['--dry-run', '--execute'])).toThrow(/Choose exactly one/);
```

Also test environment validation from the operator RPC helper:

```ts
const rpc = await import('../../../scripts/lib/bsplic-operator-rpc.mjs');
expect(() => rpc.readOperatorEnv({})).toThrow(/BSPLIC_OPERATOR_SUPABASE_URL/);
```

- [x] **Step 2: Run failing CLI tests**

Run:

```bash
npm run test -- src/features/season-reset/operatorCli.test.ts
```

Expected: FAIL because the CLI files do not exist yet.

### Task 4: Operator CLI Implementation

**Files:**
- Create: `scripts/lib/bsplic-operator-rpc.mjs`
- Create: `scripts/global-season-reset.mjs`
- Modify: `package.json`
- Test: `src/features/season-reset/operatorCli.test.ts`

- [x] **Step 1: Implement operator RPC helper**

Create `readOperatorEnv`, `callOperatorRpc`, and `printJson`. Use `BSPLIC_OPERATOR_SUPABASE_URL` and `BSPLIC_OPERATOR_SERVICE_ROLE_KEY`. Send service role key as both `apikey` and bearer token.

- [x] **Step 2: Implement CLI parser and main**

Support:

```bash
npm run season:reset -- --dry-run
npm run season:reset -- --execute
npm run season:reset -- --dry-run --cutoff 2026-06-26T12:00:00Z
```

Dry run calls `preview_global_season_reset`. Execute calls `execute_global_season_reset` with `p_confirm: true`.

- [x] **Step 3: Add npm script**

In `package.json`:

```json
"season:reset": "node scripts/global-season-reset.mjs"
```

- [x] **Step 4: Run CLI tests green**

Run:

```bash
npm run test -- src/features/season-reset/operatorCli.test.ts
```

Expected: PASS.

### Task 5: Focused Existing Contract Regression Tests

**Files:**
- Modify as needed: existing tests under `src/features/rankings/`, `src/pages/ProfilePage.test.tsx`, `src/pages/SocialPage.test.tsx`, `src/pages/SocialItemPage.test.tsx`, `src/features/casino/blackjackMigration.test.ts`, `src/features/jackpot/api/jackpotMigration.test.ts`

- [x] **Step 1: Add only tests that exercise changed contracts**

Prefer migration contract tests unless UI behavior changes. Do not broaden UI snapshots or rewrite unrelated page tests.

- [x] **Step 2: Run targeted tests**

Run:

```bash
npm run test -- src/features/season-reset/seasonResetMigration.test.ts src/features/season-reset/operatorCli.test.ts
npm run test -- src/features/rankings/stats.test.ts
npm run test -- src/pages/ProfilePage.test.tsx
npm run test -- src/pages/SocialPage.test.tsx src/pages/SocialItemPage.test.tsx
```

Expected: PASS or only pre-existing unrelated failures clearly documented.

### Task 6: Final Verification

**Files:**
- All touched files.

- [x] **Step 1: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 2: Run full test suite if targeted checks are stable**

Run:

```bash
npm run test
```

Expected: PASS or documented unrelated failures.

- [ ] **Step 3: Summarize operator usage**

Final response should include:

- exact reset command,
- required environment variables,
- migration filename,
- tests run,
- any intentionally deferred PRD items.
