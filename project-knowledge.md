# Project Knowledge (Lovable)

## App Purpose and Target Users

- **Product:** BSPLIC 2.0
- **Domain:** Social sports betting simulation with coupons, rankings, badges, and admin moderation.
- **Primary users:**
  - **Players** who browse bets, place single/AKO coupons, top up demo balance, and track profile progress.
  - **Community contributors** who propose new bets for admin approval.
  - **Admins** who create/resolve bets, manage proposals, and manage categories.

## Core User Flows

- Authentication (email/password) via Supabase Auth.
- Browse active bets on home page with category filters and sorting.
- Add selections to coupon drawer and place coupon.
- Propose bet ideas via modal.
- View rankings and profile stats/badges.
- Admin panel: create bet, resolve results, review/accept/reject proposals, manage categories.

## Tech Stack and Architecture

- **Frontend:** Vite + React 18 + TypeScript + Tailwind CSS + shadcn/ui.
- **State/context:** `AuthContext`, `CouponContext`.
- **Data layer:** Supabase client (`src/integrations/supabase/client.ts`) + typed domain models in `src/types/database.ts`.
- **Project structure (important):**
  - `src/pages/` -> route-level pages
  - `src/components/` -> shared UI components
  - `src/features/home/` -> feature-specific API/hooks/layout components
  - `src/contexts/` -> shared app state providers
  - `src/integrations/supabase/` -> Supabase bootstrap/types

## API and Data Notes

- Supabase tables commonly used by app logic:
  - `profiles` (balance, streaks, top-up metadata)
  - `user_roles` (admin role)
  - `categories`
  - `bets` (`ends_at` is `TIMESTAMPTZ`)
  - `placed_bets`
  - `coupons`
  - `bet_proposals`
  - `badges`
- Realtime subscriptions are used for categories and bets updates.
- Use explicit error handling for every write/query path that affects UX.

## Project-Specific Rules and Constraints

- Keep main page in `h-screen` layout where only bet list is scrollable.
- Coupon drawer and category panel should keep stable responsive behavior and visual consistency.
- For bet types `12` and `1x2`, option count is fixed (no add/remove options), but labels and odds can be edited by admin.
- Home sorting:
  - `Popularne` -> sort by `bet_count` descending (with sensible tie-breaker)
  - `Najnowsze` -> sort by `created_at` descending
- Bet card center label should display end **date/time** (not countdown hours).

## Clean Code Requirements for Generated Code

- Prefer small, focused components and hooks over large multi-responsibility files.
- Separate layers: `ui -> hooks -> api`.
- Avoid direct Supabase calls inside presentation-heavy components when possible.
- Keep naming explicit (`hasFixedOptionCount`, `fetchActiveBets`, `useCouponPlacement`, etc.).
- Use early returns and simple conditionals instead of deeply nested logic.
- Preserve existing app behavior unless a requirement explicitly changes it.

## Non-Functional Expectations

- No secret keys in source files.
- Keep changes scoped; avoid unrelated refactors.
- Follow existing visual language and responsiveness patterns.
