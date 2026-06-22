# Daily Jackpot Funding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change Jackpot Dnia funding to 20% of previous-day lost sportsbook stakes plus 100% of purchased tickets, without rolling refunded ticket money into the next pool.

**Architecture:** Keep the database as the source of truth. Add a fresh Supabase migration that updates the funding entry contract, rewrites the jackpot funding sync, rewrites ticket purchase funding, and excludes ticket purchase entries from insufficient-participant rollover. Keep frontend changes limited to the info modal copy and trigger placement.

**Tech Stack:** Supabase/Postgres PL/pgSQL, Vite, React, TypeScript, Vitest.

---

### Task 1: Migration Tests

**Files:**
- Modify: `src/features/jackpot/api/jackpotMigration.test.ts`

- [x] **Step 1: Add failing tests**

Add tests that assert the newest migration:
- allows `ticket_purchase` funding entries,
- uses `ROUND(c.stake * 0.20, 2)` for lost coupons,
- inserts a ticket purchase funding entry from `buy_daily_jackpot_ticket`,
- excludes `ticket_purchase` when rolling funds into the next pool.

- [x] **Step 2: Run focused test**

Run: `npm run test -- src/features/jackpot/api/jackpotMigration.test.ts`

Expected: FAIL because the migration does not exist yet.

### Task 2: Supabase Migration

**Files:**
- Create: `supabase/migrations/<timestamp>_daily_jackpot_funding_fairness.sql`

- [x] **Step 1: Create migration with Supabase CLI**

Run: `supabase migration new daily_jackpot_funding_fairness`

- [x] **Step 2: Implement SQL**

In the new migration:
- add nullable `ticket_id` to `public.daily_jackpot_funding_entries`,
- add a foreign key from `ticket_id` to `public.daily_jackpot_tickets(id)`,
- change source type check to `lost_coupon`, `rollover`, `ticket_purchase`,
- add a unique index for `ticket_purchase` by `ticket_id`,
- rewrite `private.sync_daily_jackpot_funding(date)` with `ROUND(c.stake * 0.20, 2)`,
- rewrite `public.buy_daily_jackpot_ticket(uuid)` to insert ticket, insert funding entry, recalculate `prize_amount`, and return the updated snapshot,
- rewrite the finalize path used for insufficient participants so rollover excludes `ticket_purchase`.

- [x] **Step 3: Run focused migration tests**

Run: `npm run test -- src/features/jackpot/api/jackpotMigration.test.ts`

Expected: PASS.

### Task 3: Frontend Info Modal

**Files:**
- Modify: `src/features/jackpot/components/DailyJackpotCard.tsx`
- Modify: `src/features/jackpot/components/DailyJackpotCard.test.tsx`
- Modify: `src/features/jackpot/styles/dailyJackpotCard.css`

- [x] **Step 1: Add failing component test**

Test that an accessible info button appears directly next to `Pula`, opens a dialog, and shows the approved copy.

- [x] **Step 2: Run focused component test**

Run: `npm run test -- src/features/jackpot/components/DailyJackpotCard.test.tsx`

Expected: FAIL because the info button/modal does not exist yet.

- [x] **Step 3: Implement modal**

Use existing shadcn `Dialog` and lucide `Info`. Keep the trigger as a small circular icon to the right of `Pula`; keep the dialog read-only with close support.

- [x] **Step 4: Run focused component test**

Run: `npm run test -- src/features/jackpot/components/DailyJackpotCard.test.tsx`

Expected: PASS.

### Task 4: Verification

**Files:**
- Verify all files touched above.

- [x] **Step 1: Run targeted tests**

Run:
- `npm run test -- src/features/jackpot/api/jackpotMigration.test.ts`
- `npm run test -- src/features/jackpot/components/DailyJackpotCard.test.tsx`

- [x] **Step 2: Run lint**

Run: `npm run lint`

- [x] **Step 3: Report caveats**

Report whether tests/lint passed and whether any pre-existing dirty files were left untouched.
