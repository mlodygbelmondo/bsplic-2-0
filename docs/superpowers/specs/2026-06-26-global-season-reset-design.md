# Global Season Reset Design

## Source

- PRD: `.ai/docs/prd/2026-06-26-global-season-reset.md`

## Goal

Build the first safe implementation slice for a global BSPlic season reset: a command-line operator reset that creates a durable active season boundary, resets player economy/progression, archives old economic records by hiding them behind that boundary, and keeps active Sportsbook events available for fresh coupons.

## Scope

This slice implements the foundation and highest-visibility user-facing reset behavior:

- active season metadata and a single central season-boundary reader,
- dry-run and execute reset database contracts,
- operator CLI wrapper,
- profile economy/progression reset,
- pending sportsbook coupon refunding,
- expired sportsbook event deactivation,
- season-aware sportsbook profile history and rankings,
- season-aware casino profile history and rankings,
- season-aware social feed and direct social item reads,
- season-aware public badge visibility and badge re-earning,
- focused migration/API contract tests.

This slice does not build an admin UI, historical archive UI, or physical deletion workflow. Jackpot and active casino game cutover are included in the database design as reset counts and blocked payout/current-state contracts where they directly affect post-reset balances, but deeper jackpot UX and casino gameplay redesign stay outside this slice.

## Current System Context

Most reset-sensitive behavior is implemented in Supabase SQL/RPCs rather than React-only code:

- `public.profiles` stores `balance`, streak fields, and `last_topup_at`.
- `public.coupons` and `public.placed_bets` drive sportsbook history, rankings, coupon social items, badge triggers, and jackpot lost-coupon funding.
- `public.casino_roulette_bets`, `public.casino_roulette_rounds`, and `public.casino_blackjack_games` drive casino history and rankings.
- `public.social_posts`, `public.casino_social_shares`, coupons, comments, and reactions are merged by `get_social_feed` and `get_social_feed_item`.
- `public.badges` has a historical `UNIQUE (user_id, badge_key)` constraint, so filtering old badges by timestamp alone would hide them but prevent earning the same badge again.
- Active sportsbook event placement already validates `bets.is_active = true` and `ends_at > NOW()` server-side. The reset executor still needs to deactivate expired events for clarity.

## Architecture

Add a durable `public.seasons` table with one active row. The row's `started_at` timestamp is the global visibility boundary. Because the table lives in the exposed `public` schema, enable RLS immediately and do not grant broad `anon` or `authenticated` table access. A small private helper, `private.get_active_season_started_at()`, becomes the only SQL contract that season-aware functions read.

Add two operator RPCs:

- `public.preview_global_season_reset(p_reset_at TIMESTAMPTZ DEFAULT NOW())`
- `public.execute_global_season_reset(p_reset_at TIMESTAMPTZ DEFAULT NOW(), p_confirm BOOLEAN DEFAULT FALSE)`

Both return the same JSONB summary shape. Preview only counts affected rows. Execute obtains an advisory transaction lock, creates/deactivates the active season boundary, applies the reset mutations, and returns post-execution counts. Execute requires `p_confirm = TRUE` and must only be granted to `service_role`; authorization should rely on function grants and not on deprecated `auth.role()` checks.

Add a Node CLI:

- `scripts/global-season-reset.mjs`
- npm script: `season:reset`

The CLI accepts `--dry-run`, `--execute`, and optional `--cutoff <ISO timestamp>`. It loads explicit operator environment variables and fails loudly if URL or service role key is missing. The CLI calls preview for dry runs and execute only for explicit execute mode.

## Reset Execution

The executor performs these steps in one database transaction:

1. Validate cutoff timestamp and acquire a reset-specific advisory lock.
2. Upsert a new active season boundary and close older active season rows.
3. Refund old pending coupons by setting pending pre-cutoff coupon legs to `refund`, coupon status to `refund`, payout to stake, and `settled_at` to the cutoff.
4. Reset all profiles: `balance = 500`, `last_topup_at = NULL`, `current_streak = 0`, `longest_streak = 0`, `last_bet_date = NULL`.
5. Deactivate expired sportsbook events where `ends_at <= cutoff`; do not delete events.
6. Prevent old jackpot pools/tickets from mutating post-reset balances by cancelling or isolating pre-cutoff unresolved pools in a way compatible with current jackpot status checks.
7. Mark pre-cutoff active blackjack games and unresolved casino table state as no longer playable if they could still pay out into the new season.
8. Return counts by domain area.

Execute is intended to be repeat-tolerant. Running it again with the same cutoff should not double-credit refunds or corrupt profile rows. Running with a newer cutoff starts a newer active season and repeats idempotent profile/event cleanup.

## Season-Aware Reads

All user-facing economic read contracts filter records at or after `private.get_active_season_started_at()`:

- sportsbook ranking units and `get_user_rankings`,
- `get_user_coupon_history`,
- `get_public_profile` and `get_user_stats`,
- `get_user_casino_history`,
- `get_casino_rankings`,
- `get_social_feed`,
- `get_social_feed_item` for `coupon` and `casino` item types,
- `get_public_badges`.

Text posts are not season-scoped. Social comments and reactions remain in the database; they disappear from user-facing views when the parent economic item is filtered out.

## Badges

Badge rows remain archived. To allow re-earning a badge after reset:

- replace the historical unique constraint with a unique active-season-safe index or include season identity on new rows,
- update `award_badge` so conflict detection applies only inside the active season,
- update badge trigger queries to count only active-season sportsbook activity,
- update public badge reads to show only active-season badge rows.

This keeps old badge rows inspectable while allowing the same player to earn `debiutant`, `trafiony`, and other badges again in the new season.

## CLI Contract

Usage:

```bash
npm run season:reset -- --dry-run
npm run season:reset -- --dry-run --cutoff 2026-06-26T12:00:00Z
npm run season:reset -- --execute --cutoff 2026-06-26T12:00:00Z
```

Required operator environment:

```bash
BSPLIC_OPERATOR_SUPABASE_URL=...
BSPLIC_OPERATOR_SERVICE_ROLE_KEY=...
```

The script prints formatted JSON containing mode, cutoff, profile count, pending coupon count, expired event count, casino record counts, jackpot counts, hidden social economic item counts, and badge counts.

## Error Handling

- Missing environment variables fail before any network request.
- Invalid or ambiguous CLI mode fails before any RPC call.
- Execute without `--execute` or without RPC confirmation cannot mutate data.
- Database execution fails on lock contention instead of running concurrently.
- SQL functions use explicit exceptions for missing confirmation, invalid cutoff, and unauthorized caller.
- Public-schema reset metadata uses RLS and narrowly granted functions instead of open table access.

## Testing

Use TDD for implementation. Initial tests should be migration contract tests, because the repo already uses that pattern for Supabase SQL invariants.

Minimum tests for this slice:

- migration creates season metadata and central active-boundary helper,
- preview and execute RPCs return the same summary keys,
- execute requires `service_role` and explicit confirmation,
- profile reset sets balance/streak/top-up fields,
- pending pre-cutoff coupons become refund archive records,
- expired events are deactivated and not deleted,
- sportsbook ranking/history/profile SQL filters by active boundary,
- casino ranking/history SQL filters by active boundary,
- social feed/item SQL keeps text posts and filters old coupon/casino items,
- public badges filter by active boundary and `award_badge` allows re-earning after reset,
- CLI parses dry-run, execute, and cutoff modes without mutating in dry-run.

Broader tests for jackpot payout isolation and casino current-game isolation should be added in the implementation plan where the latest SQL contracts are touched.
