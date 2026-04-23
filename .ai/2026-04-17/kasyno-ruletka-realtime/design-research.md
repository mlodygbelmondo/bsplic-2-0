# Design research — kasyno ruletka realtime

## Relevant files

### Existing roulette MVP
- `src/features/casino/components/RouletteGame.tsx`
  - Current flow is single-user and RPC-driven: validate locally, call `playRouletteRound`, render only the last settled result, then `refreshProfile()`.
  - This is the main place that must stop owning round truth and instead consume shared round state.
- `src/features/casino/components/RouletteBetForm.tsx`
  - Current betting UI already matches the supported MVP bet types and can stay the main input surface.
  - It currently assumes a simple `loading` flag, not shared `waiting/spinning/settled` phases.
- `src/features/casino/components/CasinoLobby.tsx`
  - Current lobby is just shell + balance + game.
  - Best place to add table-level layout: round status, wheel, recent spins, recent wins.
- `src/features/casino/api/roulette.ts`
  - Current API wrapper is for isolated per-user RPC settlement only.
  - This file is the clearest place either to extend or split into shared-round RPC/query wrappers.
- `src/features/casino/lib/roulette.ts`
  - Already contains supported bet types, color mapping, payout-display helpers, and validation helpers.
  - Should remain the client display/validation source for current simplified bet set.

### Existing auth / app wiring
- `src/pages/CasinoPage.tsx`
  - Already gates `/casino` by auth and waits for `profile`.
- `src/contexts/AuthContext.tsx`
  - `refreshProfile()` already exists and should remain the wallet refresh mechanism after settlement-related updates.

### Existing Supabase / SQL
- `supabase/migrations/20260417011000_casino_roulette.sql`
  - Current schema is per-user settled rounds in `casino_rounds` plus `play_roulette_round(...)`.
  - This is not a shared-table model; each call immediately generates and settles an isolated result.
- `src/integrations/supabase/types.ts`
  - Already contains generated types for `casino_rounds` and `play_roulette_round`.
  - Will need regeneration or aligned manual update after any new shared-round tables/RPCs are added.

### Existing realtime patterns to copy
- `src/features/home/api/bets.ts`
  - Shows the repo pattern for Supabase Postgres Changes subscriptions and cleanup with `supabase.removeChannel(channel)`.
- `src/features/notifications/components/NotificationsBell.tsx`
  - Shows filtered table subscription, refetch-on-event behavior, and cleanup in `useEffect`.

### Existing feed/history patterns to copy
- `src/pages/ProfilePage.tsx`
  - Uses RPC-backed history loading.
- `src/features/social/api/social.ts`
  - Shows the repo’s pattern for RPC wrappers returning normalized UI data.
- `supabase/migrations/20260315120000_social_and_coupon_history.sql`
  - Good reference for JSON-returning feed/history RPC shape.

## Current-state findings

### 1. Current roulette is not structurally capable of synchronization
- The current contract is “submit one bet, get one fully settled result back immediately”.
- There is no shared round record, no phase timestamps, no round countdown, no server-visible betting window, and no concept of multiple users betting into the same outcome.
- `casino_rounds` currently stores a finished personal result row, not a table round lifecycle.

### 2. The likely root cause of `column reference "id" is ambiguous`
- In `play_roulette_round(...)`, the function returns `TABLE (id UUID, ...)`.
- In PL/pgSQL, returned table columns behave like output variables.
- The function also uses unqualified `WHERE id = p_user_id` in queries against `public.profiles`.
- That creates a likely ambiguity between the output variable `id` and the table column `profiles.id`.
- Most likely failing lines are the `SELECT ... FROM public.profiles WHERE id = p_user_id FOR UPDATE;` and/or `UPDATE public.profiles ... WHERE id = p_user_id` inside `supabase/migrations/20260417011000_casino_roulette.sql`.
- Directionally, the fix should be explicit qualification (`profiles.id`, alias-qualified columns) or renaming the output column; not client-side changes.

## Minimal robust Supabase design for shared roulette rounds

### Recommendation: introduce dedicated shared-round tables instead of stretching `casino_rounds`

The current `casino_rounds` table models a finished personal play. Reusing it as the shared table state would mix two different concepts:
- authoritative shared round lifecycle,
- per-user bet/settlement records.

Minimal robust split:

1. `casino_roulette_rounds`
   - one row per shared round
   - key fields:
     - `id`
     - `table_key` (default `'main'` for one shared room)
     - `round_number`
     - `phase` (`waiting`, `spinning`, `settled`)
     - `betting_opens_at`
     - `betting_closes_at`
     - `spin_started_at`
     - `settled_at`
     - `winning_number`
     - `winning_color`
     - `created_at`

2. `casino_roulette_bets`
   - one row per user bet in a shared round
   - key fields:
     - `id`
     - `round_id`
     - `user_id`
     - `bet_type`
     - `bet_value`
     - `stake`
     - `payout`
     - `is_win`
     - `created_at`
     - optional `settled_at`

3. Keep `casino_rounds` only if backward compatibility/history reuse is needed
   - otherwise new shared tables should become the source of truth for roulette going forward.

### Round lifecycle

For one global table (`table_key = 'main'`):

1. **waiting**
   - round exists with `betting_closes_at = now() + interval '15 seconds'`
   - users can place bets only during this phase

2. **spinning**
   - when betting closes, server transitions the round atomically
   - winning number/color is generated authoritatively here
   - `spin_started_at` is written at the same moment
   - no more bets accepted

3. **settled**
   - payouts are applied server-side
   - recent spins and recent wins become queryable immediately
   - next waiting round is created

### RPC design

Minimal robust RPC set:

1. `get_current_roulette_round(p_table_key text default 'main')`
   - returns the current active/shared round snapshot

2. `place_roulette_bet(p_round_id, p_user_id, p_bet_type, p_bet_value, p_stake)`
   - security definer
   - validates auth match
   - validates current round is still in `waiting` and not expired
   - validates stake and supported bet value
   - deducts balance immediately
   - inserts user bet row

3. `advance_roulette_round_if_due(p_table_key text default 'main')`
   - security definer, idempotent
   - locks the active round row
   - if waiting and expired: generates winning result, marks `spinning`
   - if spinning and reveal duration has elapsed: settles bets, updates balances, marks `settled`, creates next waiting round
   - safe for many clients to call because only one lock-holder should advance state

4. `get_recent_roulette_spins(p_table_key text default 'main', p_limit integer default 10)`
   - returns settled round history

5. `get_recent_roulette_wins(p_table_key text default 'main', p_limit integer default 20)`
   - returns recent winning bet rows joined to profile username/avatar for feed rendering

### Why this is the minimal robust path
- No external scheduler is required to ship the first version.
- Any connected client can safely trigger due-state advancement through an idempotent RPC.
- The database remains authoritative for:
  - whether betting is open,
  - the winning number,
  - payout calculations,
  - wallet updates,
  - round creation.

## Realtime design

### Recommendation
- Subscribe clients to `casino_roulette_rounds` Postgres Changes for shared phase updates.
- On relevant round changes, refetch the compact derived datasets:
  - current round
  - recent spins
  - recent wins
  - current user bets for active round if shown

### Why refetch-on-round-change is the best fit here
- Round transitions are infrequent.
- It matches existing repo patterns in notifications/home.
- It avoids pushing too much denormalized event logic into the client.
- It reduces the need for many parallel realtime subscriptions with joins the client cannot do directly.

### Important Supabase requirement
- Shared roulette tables must be added to the `supabase_realtime` publication, otherwise Postgres Changes subscriptions will not fire.

## Frontend architecture for synced countdown / spin / result

### Recommended shape

1. `CasinoPage` / `CasinoLobby`
   - keep auth/balance shell
   - compose shared roulette dashboard sections

2. New hook, e.g. `useRouletteTable()`
   - loads initial snapshot from RPCs
   - subscribes to `casino_roulette_rounds` changes
   - refetches on round transitions
   - exposes derived UI model:
     - `currentRound`
     - `phase`
     - `countdownMs`
     - `recentSpins`
     - `recentWins`
     - `activeUserBets`
     - `placeBet()`
     - `refresh()`

3. `RouletteGame`
   - becomes orchestration/composition only
   - should stop owning round truth in local component state
   - should instead render from shared round data and local form state

4. `RouletteWheel`
   - receives authoritative `winningNumber`, `phase`, and phase timestamps
   - computes wheel landing angle deterministically from server result
   - animation starts from `spin_started_at`, not from button click
   - if user joins mid-spin, component derives remaining animation duration from server timestamp and still lands on the same number

5. Recent panels
   - `RecentSpins`: settled round history strip/list
   - `RecentWinsFeed`: recent win rows with username + amount

### State model to preserve sync
- The server round row is the source of truth.
- The client only derives:
  - remaining countdown from `betting_closes_at - now`
  - remaining spin reveal time from `spin_started_at`
  - current wheel angle from authoritative `winning_number`
- Do not start spin based on local submit success; start spin when the shared round transitions to `spinning`.

## Patterns to follow

1. **Keep Supabase authoritative for all balance-changing actions**
   - Matches current repo pattern (`place_bet_secure`, `play_roulette_round`).

2. **Use feature-local API wrappers and hooks**
   - Matches `src/features/.../api/*` and current feature structure.

3. **Use repo realtime cleanup patterns**
   - Follow `supabase.channel(...).on(...).subscribe()` plus `supabase.removeChannel(channel)` cleanup.

4. **Use RPCs for feed/history payloads**
   - Matches profile/social history access patterns already present in the app.

5. **Drive synced UI from timestamps, not hardcoded local timers**
   - Local timers should only derive display countdowns from server times.

6. **Respect reduced motion**
   - The wheel must still clearly reveal the winning number without requiring long animation.

## Risks

1. **Round advancement ownership risk**
   - Without an external scheduler, first-release round progression depends on clients calling the idempotent “advance if due” RPC.
   - The planner must make this function lock-safe and callable from multiple clients without double-settlement.

2. **Visual desync risk**
   - If the wheel animation is keyed off local submit timing instead of shared round timestamps, different users will see different spin phases.
   - The planner must key spin start and final angle off the round row only.

3. **Schema-overloading risk**
   - Reusing current `casino_rounds` for both shared round lifecycle and per-user settlement would make queries, history, and realtime semantics much harder.
   - The planner should preserve a clean split between “shared round” and “user bet”.

## Assumptions

- Launch scope is one global roulette room/table.
- Current simplified bet types can remain for the first shared realtime version.
- Betting window is exactly 15 seconds and should be stored as authoritative timestamps, not just implied in UI.
- Spin/reveal duration can be a fixed server-known duration after betting closes.
- Authenticated users only; no credentials should be stored in artifacts.

## What the planner must preserve

- Preserve `/casino` auth gating and current profile-loading behavior.
- Preserve Supabase as the source of truth for outcome, payout, and wallet balance.
- Preserve current balance refresh behavior via `refreshProfile()` after meaningful settlement updates.
- Preserve current MVP bet vocabulary unless product scope explicitly expands it.
- Preserve accessibility and reduced-motion support.
- Preserve the rule that UI presentation never becomes a second source of truth for the winning number.

## Likely files to modify

- `src/pages/CasinoPage.tsx`
- `src/features/casino/components/CasinoLobby.tsx`
- `src/features/casino/components/RouletteGame.tsx`
- `src/features/casino/components/RouletteBetForm.tsx`
- `src/features/casino/api/roulette.ts` or split into shared-round API modules
- `src/features/casino/lib/roulette.ts`
- `src/features/casino/components/RouletteGame.test.tsx`
- `src/index.css`
- `src/integrations/supabase/types.ts`
- new Supabase migration after `20260417011000_casino_roulette.sql`

## Likely files to add

- `src/features/casino/hooks/useRouletteTable.ts`
- `src/features/casino/components/RouletteWheel.tsx`
- `src/features/casino/components/RouletteRoundStatus.tsx`
- `src/features/casino/components/RouletteRecentSpins.tsx`
- `src/features/casino/components/RouletteRecentWinsFeed.tsx`
- optionally `src/features/casino/api/roulette-rounds.ts`
- optionally `src/features/casino/api/roulette-realtime.ts`
