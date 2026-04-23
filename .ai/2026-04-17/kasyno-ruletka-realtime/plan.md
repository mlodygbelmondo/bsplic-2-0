# Kasyno + ruletka realtime — implementation plan

## goal
- Build one synchronized realtime roulette table in the existing `/casino` flow with premium dark-casino presentation, 15-second shared betting windows, recent spins/wins, and Supabase-authoritative round lifecycle and settlement.

## architecture
- Keep Supabase as the only authority for active round state, winning number, bet acceptance, settlement, and balance updates.
- Introduce separate shared-round and per-bet tables: one row for the table round lifecycle, many rows for user bets inside that round.
- Drive the frontend from round timestamps plus Realtime subscriptions: clients render countdown/spin/history from server state and only use local timers for display.

## scope
- shared single-table roulette round loop,
- premium dark-luxury UI upgrade for the casino section,
- recent spins and recent wins surfaces,
- backend migration/RPC update for synchronized rounds,
- targeted tests and authenticated browser verification,
- fix for the existing ambiguous SQL `id` bug.

## assumptions
- Launch scope is one shared table only: `table_key = 'main'`.
- Bet scope stays limited to `straight`, `color`, `parity`, and `range`.
- Betting opens immediately for each new round and closes exactly 15 seconds later.
- A short fixed reveal/spin duration can be encoded server-side after betting closes.
- Existing auth gating on `CasinoPage` remains unchanged; no credentials are written into artifacts.

## exact likely schema / RPC / realtime approach

### new / updated Supabase schema
- Keep existing `public.casino_rounds` for legacy MVP history only; do not stretch it into shared realtime state.
- Add `public.casino_roulette_rounds`:
  - `id uuid primary key default gen_random_uuid()`
  - `table_key text not null default 'main'`
  - `round_number bigint not null`
  - `phase text not null check (phase in ('waiting', 'spinning', 'settled'))`
  - `betting_opens_at timestamptz not null`
  - `betting_closes_at timestamptz not null`
  - `spin_started_at timestamptz null`
  - `settled_at timestamptz null`
  - `winning_number integer null check (winning_number between 0 and 36)`
  - `winning_color text null check (winning_color in ('red','black','green'))`
  - `created_at timestamptz not null default now()`
  - unique index on active table sequencing such as `(table_key, round_number)`.
- Add `public.casino_roulette_bets`:
  - `id uuid primary key default gen_random_uuid()`
  - `round_id uuid not null references public.casino_roulette_rounds(id) on delete cascade`
  - `user_id uuid not null references public.profiles(id) on delete cascade`
  - `bet_type text not null check (bet_type in ('straight','color','parity','range'))`
  - `bet_value text not null`
  - `stake numeric(12,2) not null check (stake > 0)`
  - `payout numeric(12,2) not null default 0`
  - `is_win boolean null`
  - `created_at timestamptz not null default now()`
  - `settled_at timestamptz null`.
- Add indexes for `casino_roulette_rounds(table_key, phase, betting_closes_at desc)` and `casino_roulette_bets(round_id)`, `casino_roulette_bets(user_id, created_at desc)`.
- Enable RLS so users can only read their own bet rows directly; round rows can be readable to authenticated users for the shared table.
- Add both new tables to the `supabase_realtime` publication.

### likely RPC set
- `get_current_roulette_round(p_table_key text default 'main')`
  - returns one compact row with current round state.
- `place_roulette_bet(p_round_id uuid, p_user_id uuid, p_bet_type text, p_bet_value text, p_stake numeric)`
  - validates auth match,
  - validates supported bet,
  - locks the profile row,
  - confirms active round is still `waiting` and `now() < betting_closes_at`,
  - deducts stake immediately,
  - inserts bet row,
  - returns accepted bet payload.
- `advance_roulette_round_if_due(p_table_key text default 'main')`
  - locks the active round row,
  - if `waiting` and expired: computes authoritative winning number/color, writes `spin_started_at`, changes phase to `spinning`,
  - if `spinning` and reveal duration elapsed: settles all bets, credits balances, marks round `settled`, creates next `waiting` round,
  - idempotent and safe to call from many clients.
- `get_recent_roulette_spins(p_table_key text default 'main', p_limit integer default 10)`
  - returns latest settled rounds.
- `get_recent_roulette_wins(p_table_key text default 'main', p_limit integer default 20)`
  - returns recent winning bets joined to profile display name / avatar fields already used in app.
- Optional helper: `get_my_current_roulette_bets(p_round_id uuid)` if the UI shows the player’s accepted bets separately.

### realtime approach
- Subscribe to `public.casino_roulette_rounds` Postgres changes for `INSERT`/`UPDATE` on the shared table.
- On round change, refetch:
  - current round,
  - recent spins,
  - recent wins,
  - current user bets for the active round when shown.
- Also call `advance_roulette_round_if_due('main')` on initial load and on a lightweight interval while the page is open so the table keeps moving without a separate scheduler.

## exact likely files to create / modify

### frontend files to modify
- `src/pages/CasinoPage.tsx`
- `src/pages/CasinoPage.test.tsx`
- `src/features/casino/components/CasinoLobby.tsx`
- `src/features/casino/components/RouletteGame.tsx`
- `src/features/casino/components/RouletteGame.test.tsx`
- `src/features/casino/components/RouletteBetForm.tsx`
- `src/features/casino/api/roulette.ts`
- `src/features/casino/lib/roulette.ts`
- `src/features/casino/lib/roulette.test.ts`
- `src/index.css`
- `src/integrations/supabase/types.ts`

### frontend files to create
- `src/features/casino/hooks/useRouletteTable.ts`
- `src/features/casino/components/RouletteWheel.tsx`
- `src/features/casino/components/RouletteRoundStatus.tsx`
- `src/features/casino/components/RouletteRecentSpins.tsx`
- `src/features/casino/components/RouletteRecentWinsFeed.tsx`
- `src/features/casino/components/RouletteTableState.tsx` (optional composition wrapper if `RouletteGame` gets too large)
- `src/features/casino/api/roulette-rounds.ts`
- `src/features/casino/api/roulette-realtime.ts` (optional if subscription logic is split from API calls)

### Supabase files to modify / create
- Modify only if needed for a compatibility fix: `supabase/migrations/20260417011000_casino_roulette.sql`
- Create new migration after it, likely:
  - `supabase/migrations/20260417130000_casino_roulette_realtime.sql`
- Regenerate or align:
  - `src/integrations/supabase/types.ts`

## ordered implementation steps
1. Add the new realtime roulette migration with `casino_roulette_rounds`, `casino_roulette_bets`, RLS policies, indexes, publication updates, and the shared-round RPCs.
2. In that migration, seed or ensure one active `waiting` round exists for `table_key = 'main'`.
3. Fix the current ambiguous `id` bug in the legacy roulette SQL while touching backend migrations so local/runtime errors stop masking new work.
4. Extend `src/features/casino/api/roulette.ts` or split it into shared-round wrappers for current round, place bet, advance-if-due, recent spins, and recent wins.
5. Add `useRouletteTable.ts` to own initial fetch, Realtime subscription, derived countdown state, periodic `advance_roulette_round_if_due()` calls, and `placeBet()` orchestration.
6. Refactor `RouletteGame.tsx` from single-user submit/result state into shared table composition driven by `useRouletteTable()`.
7. Keep `RouletteBetForm.tsx` bet vocabulary, but update it for shared phases: open during `waiting`, disabled during `spinning`/`settled`, explicit accepted-bet feedback, and premium visual treatment.
8. Add `RouletteWheel.tsx` and `RouletteRoundStatus.tsx` so the wheel, countdown, and phase banner derive entirely from `winning_number`, `betting_closes_at`, and `spin_started_at`.
9. Add `RouletteRecentSpins.tsx` and `RouletteRecentWinsFeed.tsx` and place them in `CasinoLobby.tsx` around the shared table layout.
10. Apply dark luxury casino styling in `src/index.css` and touched components: dark felt base, metallic borders, red glow accents, strong contrast, and reduced-motion-safe fallbacks.
11. Update `CasinoPage.tsx` only as needed to preserve auth gating and provide a wider casino layout shell for the new table UI.
12. Update tests and regenerate Supabase types before final verification.

## plan for fixing the ambiguous `id` root cause
- Root cause is almost certainly in `play_roulette_round(...)` because `RETURNS TABLE (id uuid, ...)` creates an output variable named `id`, while the function body uses unqualified `WHERE id = p_user_id` and `UPDATE ... WHERE id = p_user_id`.
- Fix approach:
  - qualify all profile references with an alias, e.g. `FROM public.profiles AS p WHERE p.id = p_user_id` and `UPDATE public.profiles AS p ... WHERE p.id = p_user_id`,
  - keep `RETURNING casino_rounds.id` or alias it explicitly,
  - optionally rename the returned column from `id` to `round_id` in the legacy RPC only if compatibility impact is acceptable; otherwise prefer qualification only.
- Verify by executing the legacy RPC in SQL and from the app before starting the shared-round integration.

## UI / UX plan
- **Countdown / shared state**: top status rail with phase label (`Przyjmowanie zakładów`, `Koło się kręci`, `Runda rozliczona`), synchronized countdown ring/text, and one clear shared-table indicator.
- **Wheel**: original 2D/SVG premium wheel with fixed pointer, dark metallic materials, red glow, and deterministic landing based on server result; if a user joins mid-spin, compute remaining animation from `spin_started_at`.
- **Betting area**: keep simplified premium bet controls, show selected bet and stake clearly, disable changes when betting closes, and show accepted bets for the active round.
- **Recent spins**: compact history strip/cards with last numbers, color chips, and newest-first ordering from settled rounds.
- **Recent wins**: feed panel with username, bet type/value, payout amount, and round reference; keep it light enough to refresh on each settled round.
- **Shared table atmosphere**: `CasinoLobby` becomes a full table scene rather than a simple card stack; preserve mobile responsiveness and accessible contrast.
- **Feedback**: toasts remain for bet acceptance/errors, but major outcome feedback should live in the table UI rather than only in transient notifications.

## verification approach
- SQL / backend:
  - verify the new migration applies cleanly,
  - verify one active waiting round exists,
  - verify `place_roulette_bet` rejects late bets and insufficient balance,
  - verify `advance_roulette_round_if_due` is idempotent under repeated calls,
  - verify the legacy `play_roulette_round` no longer throws the ambiguous `id` error.
- Unit / component tests:
  - `npm run test -- src/features/casino/lib/roulette.test.ts`
  - `npm run test -- src/features/casino/components/RouletteGame.test.tsx`
  - `npm run test -- src/pages/CasinoPage.test.tsx`
- App quality gates:
  - `npm run lint`
  - `npm run build`
- Authenticated browser verification:
  1. Run the app and open `/casino` in an authenticated session.
  2. Confirm the page waits for profile load and then shows one shared table.
  3. Open two browser sessions/users on `/casino`.
  4. Confirm both see the same countdown and phase transitions.
  5. Place a bet in session A during the 15-second window and confirm accepted-bet state appears.
  6. Confirm both sessions observe the same spin result and updated recent spins.
  7. Confirm recent wins updates after settlement and balance refresh occurs for the betting user.
  8. Confirm no credentials or tokens were written into artifacts.

## explicit out-of-scope
- multiple roulette rooms/tables,
- full roulette board expansion beyond the chosen premium-simple bet set,
- 3D wheel / physics simulation,
- chat, spectatorship, or social reactions inside the table,
- fairness proofs / provably fair cryptography,
- admin controls or operational dashboards,
- storing raw credentials, tokens, or secrets in repo artifacts.

## follow-up / fix-only guidance if realtime sync or auth verification fails later
- If realtime sync fails but core SQL is correct, first fix publication/subscription wiring and refetch triggers; do not redesign the schema.
- If users see different spin timing, fix timestamp-derived animation math in `useRouletteTable` / `RouletteWheel` and avoid changing settlement logic.
- If balance refresh is wrong after settlement, inspect RPC settlement queries and `refreshProfile()` integration before touching UI.
- If auth verification fails only at `/casino`, fix only the gating/session/profile handoff in `CasinoPage` and keep the roulette feature contract unchanged.
- If client-driven round advancement proves unreliable in practice, the next fix-only step is moving `advance_roulette_round_if_due` to a scheduled server-side trigger/cron, not rewriting the rest of the feature.
