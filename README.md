# BSPLIC 2.0

An epic social betting arena: live coupons, rankings, user-driven bet proposals, and a full admin control panel.

## What Is This?

BSPLIC is a web app where you can:

- players place bets on active events (single / AKO),
- build streaks and unlock badges,
- submit their own bet proposals,
- admins moderate, publish, and settle outcomes.

This is not plain CRUD. It is a betting feed + realtime updates + wallet economy + gameplay loop.

## Core Features

- **Home betting feed** with categories and `Popularne` / `Najnowsze` sorting
- **Coupon Drawer** (desktop + mobile) for building and placing coupons
- **Community bet proposals** with accept/reject moderation workflow
- **Admin panel** for creating, settling, and managing bets
- **Rankings and profile** with streaks, balance, and achievements
- **Supabase realtime** for live, no-refresh updates

## Stack

- Vite
- React 18 + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (Auth + DB)
- Vitest + Testing Library

## Quick Start

### 1) Requirements

- Node.js 18+
- npm

### 2) Install

```bash
npm install
```

### 3) Configure `.env`

Create `.env` and add:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

Market quotes/search now go through Supabase Edge Function `market-data`.
Set provider key as Supabase secret (not in frontend env):

```bash
supabase secrets set TWELVEDATA_API_KEY=...
supabase functions deploy market-data
```

Then configure a scheduled invocation for `market-data` with body:

```json
{ "action": "refresh" }
```

Simple schedule (every 15 minutes):

```text
*/15 * * * *
```

If schedule UI is unavailable in your dashboard, run SQL once as admin:

```sql
select public.setup_market_data_refresh_cron(
  p_project_url := 'https://<project-ref>.supabase.co',
  p_anon_key := '<SUPABASE_ANON_KEY>',
  p_schedule := '*/15 * * * *'
);
```

Recommended low-usage profile (peak 10-16 twice/hour, off-peak every 2h, max 25/day):

```sql
select * from public.setup_market_data_refresh_cron_profile(
  p_project_url := 'https://<project-ref>.supabase.co',
  p_anon_key := '<SUPABASE_ANON_KEY>',
  p_peak_start_hour := 10,
  p_peak_end_hour := 16,
  p_offpeak_step_hours := 2
);
```

Disable scheduled refresh jobs:

```sql
select public.disable_market_data_refresh_cron();
```

For local seeding (dev DB only), also provide in shell:

```bash
SUPABASE_SERVICE_ROLE_KEY=...
SEED_TEST_PASSWORD=...
# Optional (defaults shown)
# SEED_TEST_EMAIL_PREFIX=testuser
# SEED_TEST_EMAIL_DOMAIN=bsplic.dev
# SEED_TEST_USERS_COUNT=4
# SEED_TEST_BALANCE=1000
```

### 4) Run locally

```bash
npm run dev
```

Default dev port is `8080`.

## Commands

```bash
npm run dev         # local development
npm run build       # production build
npm run build:dev   # development-mode build
npm run preview     # preview production build
npm run lint        # eslint
npm run test        # vitest (single run)
npm run test:watch  # vitest watch mode
npm run seed:dev    # seed/update 4 dev test accounts
```

Optional integration test for asset-backed single-coupon settlement (requires local/dev Supabase env vars):

```bash
TEST_SUPABASE_URL=http://127.0.0.1:54321 \
TEST_SUPABASE_ANON_KEY=... \
TEST_SUPABASE_SERVICE_ROLE_KEY=... \
npm run test -- src/features/integration/asset-stake-settlement.integration.test.ts
```

Run a single test file:

```bash
npm run test -- src/test/example.test.ts
```

## Project Structure

```text
src/
  components/                # shared components
  components/ui/             # shadcn/ui primitives
  contexts/                  # AuthContext, CouponContext
  features/
    home/
      api/                   # Supabase queries/mutations
      hooks/                 # home view logic
      layout/                # home screen composition
  integrations/supabase/     # client + generated types
  pages/                     # route-level pages
  types/                     # domain types
```

## Project Rules (Important)

- Keep a clean layering model: `UI -> hooks -> api`.
- Never commit secrets.
- Keep the home layout in `h-screen`; only intended sections should scroll.
- For bet types `12` and `1x2`, option count is fixed (no add/remove).
- `Popularne` must sort by `bet_count` descending.

Full workflow and coding rules: `AGENTS.md`.

## Code Quality Principles

- Prefer small, focused, readable components.
- Every async flow with loading state should use `try/catch/finally`.
- Surface failures to users with toasts; do not swallow errors.
- Keep change scope tight to the current task.

## Next-Level Roadmap

- more bet formats,
- deeper player analytics,
- stronger E2E coverage for critical flows,
- extra mobile UX polish.

---

First run? Configure `.env`, run `npm install`, then `npm run dev` and you are in.
