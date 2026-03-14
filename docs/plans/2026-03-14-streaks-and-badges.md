# Streaks & Badges Backend Implementation Plan

**Date:** 2026-03-14
**Status:** Ready for execution

## Problem

The streak and badge features have complete frontend UI but zero backend logic.
`current_streak`, `longest_streak`, `last_bet_date` are never written.
The `badges` table is never inserted into.
`coupons.status` stays `'pending'` forever because `resolveBet` never updates it.

## Scope

1. SQL migration with functions + triggers for streaks, badges, and coupon resolution
2. Minor fix in `AdminPage.tsx` to update `coupons.status` during bet resolution
3. Backfill function for existing data

## Non-goals

- Changing badge definitions or adding new ones
- Modifying the frontend display logic (already works)
- Changing the rankings page (separate task)

---

## Task 1: Streak calculation trigger

**File:** `supabase/migrations/<timestamp>_streaks_and_badges.sql`

Create function `update_user_streak()` triggered AFTER INSERT on `placed_bets`.

Logic:
```
given: NEW.user_id, today = CURRENT_DATE
fetch: last_bet_date from profiles where id = NEW.user_id

if last_bet_date = today → do nothing (already counted today)
if last_bet_date = today - 1 → current_streak += 1
else → current_streak = 1

longest_streak = GREATEST(longest_streak, current_streak)
last_bet_date = today
```

**Trigger:** `AFTER INSERT ON placed_bets FOR EACH ROW`

---

## Task 2: Badge awarding function

Create `SECURITY DEFINER` function `award_badge(p_user_id UUID, p_badge_key TEXT)` that:
- Inserts into `badges(user_id, badge_key)` with `ON CONFLICT DO NOTHING`
- Uses `SECURITY DEFINER` to bypass the SELECT-only RLS policy on `badges`

---

## Task 3: Badges on bet placement (INSERT trigger)

Create function `check_badges_on_bet_insert()` triggered AFTER INSERT on `placed_bets`.

Badges checked:
- `debiutant` — bet_count = 1 (profile already incremented by existing trigger)
- `wieloryb` — NEW.amount >= 500
- `kuponista` — NEW.coupon_id IS NOT NULL (first AKO bet)
- `ryzykant` — coupon has 5+ events (count placed_bets with same coupon_id)
- `multi_fan` — user has 10+ distinct coupon_ids in placed_bets
- `wszechstronny` — user has bets in 4+ distinct categories

---

## Task 4: Badges on bet resolution (UPDATE trigger)

Create function `check_badges_on_bet_result()` triggered AFTER UPDATE on `placed_bets` when `NEW.result IS DISTINCT FROM OLD.result`.

Badges checked:
- `trafiony` — NEW.result = 'won' and it's the user's first win
- `goraca_passa` — 3 consecutive wins (by created_at order)
- `nie_do_zatrzymania` — 5 consecutive wins
- `mistrz_serii` — 10 consecutive wins
- `pierwszy_tysiac` — sum of (potential_win for result='won') > 1000
- `analityk` — win_rate > 60% with at least 20 resolved bets

Consecutive wins logic:
```sql
SELECT result FROM placed_bets
WHERE user_id = NEW.user_id AND result IS NOT NULL
ORDER BY created_at DESC
LIMIT N
-- check if all N are 'won'
```

---

## Task 5: Badge on proposal acceptance

Create function `check_badge_on_proposal_accept()` triggered AFTER UPDATE on `bet_proposals` when `NEW.status = 'accepted' AND OLD.status != 'accepted'`.

Badge: `pomyslodawca` — awarded to `NEW.user_id` (the proposer).

---

## Task 6: Streak-based badges

Add to `update_user_streak()` (Task 1) or create separate post-streak check:
- `staly_bywalec` — current_streak >= 7
- `legenda` — current_streak >= 30

---

## Task 7: Coupon status resolution

### 7a: SQL function `resolve_coupon_status()`

After each `placed_bets` UPDATE (result change), check if all bets for the same coupon are resolved:
```sql
-- if any bet in the coupon lost → coupon status = 'lost'
-- if all bets in the coupon won → coupon status = 'won'
-- otherwise (some still null) → leave as 'pending'
```

This runs as part of the bet-result UPDATE trigger.

### 7b: AdminPage.tsx fix

In `resolveBet` function (~line 440), after updating `placed_bets.result` and `profiles.balance`, also call the coupon resolution logic. Two options:

**Option A (preferred):** Let the SQL trigger handle it automatically (from 7a). No frontend change needed.

**Option B (fallback):** Add explicit Supabase call in `resolveBet`:
```ts
// After updating placed_bets result, resolve coupon if applicable
if (bet.coupon_id) {
  // check all bets in coupon, update coupons.status
}
```

We'll use **Option A** — the trigger handles everything.

---

## Task 8: Backfill function

Create `backfill_streaks_and_badges()` function (one-time, called manually):

1. **Streaks:** For each user, scan placed_bets by date, compute current/longest streak
2. **Badges:** For each user, run all badge condition checks and award

Called via: `SELECT backfill_streaks_and_badges();` after migration.

---

## Task 9: AdminPage.tsx — minor fix

Even with Option A (trigger), the `resolveBet` function should be reviewed:
- Currently it doesn't check if bet already resolved (can double-pay)
- Add guard: skip if `placed_bets.result` is already set

---

## Implementation order

1. Task 2 (award_badge helper) — no dependencies
2. Task 1 + 6 (streak trigger + streak badges)
3. Task 3 (badges on INSERT)
4. Task 7a (coupon resolution trigger)
5. Task 4 (badges on UPDATE/result)
6. Task 5 (proposal badge)
7. Task 8 (backfill)
8. Task 9 (AdminPage guard)
9. Tests + build + lint

All SQL goes in a single migration file. AdminPage change is a separate commit.

---

## Files to create/modify

| File | Action |
|------|--------|
| `supabase/migrations/<timestamp>_streaks_and_badges.sql` | CREATE — all functions + triggers |
| `src/pages/AdminPage.tsx` | MODIFY — add resolution guard (~5 lines) |
| `src/test/streaks-badges.test.ts` | CREATE — unit tests for logic verification |

## Risks

- **Trigger ordering:** Two AFTER INSERT triggers on `placed_bets` (`increment_bet_count` exists). Postgres doesn't guarantee order but both are independent — safe.
- **Performance:** Badge checks query `placed_bets` on every insert/update. For this app's scale (small user base), this is fine. Index on `(user_id, created_at)` already exists.
- **RLS bypass:** `award_badge` uses SECURITY DEFINER which is standard practice for server-side inserts that need to bypass row-level security.
