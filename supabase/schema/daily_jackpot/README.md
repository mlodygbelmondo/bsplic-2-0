# Jackpot Dnia — canonical lifecycle definitions

These files mirror the **current** definitions of the Jackpot Dnia lifecycle
functions, so nobody has to hunt through `supabase/migrations/` for the newest
of several `CREATE OR REPLACE` copies.

Rules of the directory:

- **The database is changed only by migrations.** These files are a read
  mirror, never applied directly.
- **Every change to a lifecycle function lands as a fresh migration AND
  updates the mirror file here.**
  `src/features/jackpot/api/jackpotLifecycleConsolidation.test.ts` fails when
   a mirror file stops matching that function's newest migration definition.

Lifecycle overview:

- `daily_jackpot_rules()` — single authority for rule constants
  (max tickets per player, defaults for empty snapshots).
- `sync_daily_jackpot_funding(date)` — idempotently rebuilds funding entries
  (20% of previous-day lost coupon stakes, per the 2026-06-22 funding spec).
- `finalize_daily_jackpot_pool(date, user)` — locks a due pool, then either
  draws a winner or (too few players) refunds every ticket and rolls
  non-ticket funding to the next day.
- `get_daily_jackpot_state()` — the polled read; it also syncs funding and
  finalizes due pools so the 20:00 draw is visible immediately. The pg_cron
  job `maintain_daily_jackpot` (every 5 minutes) is the backstop when nobody
  is polling.
- `buy_daily_jackpot_ticket(pool)` — balance-checked ticket purchase; ticket
  price funds the active pool (`ticket_purchase` entries).
- `get_daily_jackpot_snapshot` / `get_empty_daily_jackpot_snapshot` /
  `get_daily_jackpot_draw` — spoiler-free snapshot builders for the client.

Reveal/claim/auto-credit functions (reward flow) are stable since June 2026
and still live in `20260619024554_jackpot_reward_claim_flow.sql` with patches
through `20260622184727`; fold them in here the next time they change.
