# BSPLIC 2.0

An epic social betting arena: live coupons, rankings, user-driven bet proposals, and a full admin control panel.

## What Is This?

BSPLIC is a web app where:

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
