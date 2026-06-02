# AGENTS.md

## Purpose

- This file is the operating guide for coding agents working in this repository.
- Follow existing project patterns first, then apply the conventions below.
- Keep changes focused; avoid broad refactors unless explicitly requested.

## Rule Files Status

- Checked paths: `.cursor/rules/`, `.cursorrules`, `.github/copilot-instructions.md`.
- Result: no Cursor or Copilot rule files are currently present.
- Therefore, this `AGENTS.md` is the primary rule source for agent behavior in this repo.

## Project Snapshot

- Stack: Vite 5 + React 18 + TypeScript + Tailwind CSS + shadcn/ui + Supabase.
- Package manager: use `npm` commands by default.
- Test stack: Vitest + Testing Library (`jsdom` environment).
- E2E tooling exists: Playwright config is present.
- PWA support exists via `vite-plugin-pwa`; build outputs may update `dist/` and `dev-dist/`.
- Motion/visual effects use `framer-motion` and targeted libraries like `canvas-confetti`.
- Dev server: Vite on port `8080`.

## Repository Layout

- App source: `src/`
- UI primitives: `src/components/ui/`
- Pages: `src/pages/`
- Context/state: `src/contexts/`
- Shared types: `src/types/`
- Supabase client/types: `src/integrations/supabase/`
- Casino feature modules: `src/features/casino/`
- Social feature modules: `src/features/social/`
- Unit tests: `src/**/*.{test,spec}.{ts,tsx}`
- Test setup: `src/test/setup.ts`
- DB migrations: `supabase/migrations/`
- Static casino/PWA assets: `public/`

## Environment Notes

- Required env vars include:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
- Keep secrets out of source code and commits.

## Core Commands

- Install dependencies: `npm install`
- Start dev server: `npm run dev`
- Build production bundle: `npm run build`
- Build in development mode: `npm run build:dev`
- Build production bundle and report asset sizes: `npm run perf:build`
- Preview production build: `npm run preview`
- Lint codebase: `npm run lint`
- Run all tests once: `npm run test`
- Run tests in watch mode: `npm run test:watch`

## Single-Test Commands (Important)

- Run one test file:
  - `npm run test -- src/test/example.test.ts`
- Run one test by name pattern:
  - `npm run test -- -t "should pass"`
- Run one file and one test name together:
  - `npm run test -- src/test/example.test.ts -t "should pass"`
- Watch a single file:
  - `npm run test:watch -- src/test/example.test.ts`
- Direct Vitest fallback:
  - `npx vitest run src/test/example.test.ts`

## Optional/Ancillary Commands

- Run eslint on specific files:
  - `npx eslint src/pages/Index.tsx`
- Run Playwright tests (no npm script defined):
  - `npx playwright test`

## Agent Workflow Expectations

- Before editing, read related files and follow local conventions.
- After changes, run targeted checks first, then broader checks:
  - Minimum: relevant test file(s) and `npm run lint` for touched TS/TSX.
  - Prefer: `npm run test` if changes affect shared logic or contexts.
- Do not fix unrelated lint/style issues unless requested.

## TypeScript Guidance

- TS config in app is intentionally permissive (`strict: false`, `noImplicitAny: false`).
- Even so, new code should still prefer explicit and safe typing.
- Avoid introducing new `any`; use concrete interfaces or `unknown` + narrowing.
- Reuse domain types from `src/types/database.ts` when possible.
- For Supabase rows, cast carefully and keep casts narrow.

## Imports and Module Conventions

- Use path alias `@/` for imports under `src/`.
- Prefer import grouping order:
  1. external packages
  2. internal alias imports (`@/...`)
  3. relative imports (`./...`)
- Keep import lists minimal; remove unused imports.
- Match existing quote style in the file you edit:
  - Feature/app files commonly use single quotes.
  - Some generated/shadcn files use double quotes.
  - Do not reformat entire files only to change quote style.

## React and Component Patterns

- Use function components and hooks (no class components).
- Keep components focused; extract helpers when JSX becomes dense.
- Keep state local unless shared state is clearly needed.
- Shared app state belongs in contexts under `src/contexts/`.
- Use `useEffect` cleanup for subscriptions/channels/timers.
- For lists, use stable keys from IDs, not array index (unless static placeholders).

## Performance Conventions

- Keep the logged-out root/login path lightweight. Do not import sportsbook home, casino, admin, social, ranking, or other feature-heavy modules before they are needed.
- Preserve route-level lazy loading for non-root pages and heavy surfaces such as Social, Rankings, Profile, Admin, Casino, roulette, blackjack, and reset password.
- Keep admin tab bodies lazy-loaded so ordinary users, and admin users on other tabs, do not download every admin surface upfront.
- Home data hooks that fetch active bets/categories or open realtime channels should live under the lazy authenticated home surface so they are not imported or run on the logged-out root path.
- Realtime subscriptions should be opened only for visible/useful surfaces and must always be cleaned up.
- Service-worker registration should stay off the critical first-render path while preserving PWA auto-update behavior.
- When changing bundle shape, run `npm run perf:build` and compare the largest JS chunk and gzip sizes with the previous output.

## Supabase and Data Access

- Supabase client lives in `src/integrations/supabase/client.ts`.
- Treat `src/integrations/supabase/client.ts` as generated/bootstrap code.
- Prefer typed query handling and explicit error checks.
- Pattern for writes:
  - perform request
  - check `error` and throw/handle
  - update UI state
  - notify user (`toast`) where appropriate
- Realtime channels must be unsubscribed/removed in cleanup.
- For new RPCs, add a migration under `supabase/migrations/` and keep `src/integrations/supabase/types.ts` in sync if generation is not available.
- Never edit or extend an already existing Supabase migration file if it has been deployed; create a new timestamped migration file for every follow-up change.
- For performance-sensitive schema/RPC work, add new indexes or RPC rewrites in a fresh migration and validate with `EXPLAIN ANALYZE` in Supabase SQL editor or another admin SQL session when available.
- Current app-level RPCs include sportsbook coupon history/rankings, public profiles, social feeds/comments/reactions, daily top-up, admin balance credit, roulette table state/actions, blackjack actions, casino history, and casino rankings.
- Casino roulette uses realtime-backed shared table data in `casino_roulette_rounds` and `casino_roulette_bets`; blackjack uses server-authoritative `casino_blackjack_games` plus action RPCs.
- RLS can prevent direct profile/history reads for other users; prefer SECURITY DEFINER RPCs for public profile, public history, and ranking views.

## Error Handling

- Wrap async UI actions in `try/catch/finally` when loading state is involved.
- Always reset loading flags in `finally`.
- Show user-facing feedback for success/failure (`sonner` toasts are standard here).
- Do not swallow errors silently.
- Prefer friendly, actionable error messages for users.

## Styling and UI Conventions

- Tailwind is the default styling approach.
- Reuse existing design tokens and utility classes from `src/index.css`.
- Use `cn(...)` from `src/lib/utils.ts` for conditional className composition.
- Prefer existing shadcn/ui primitives before creating custom base components.
- Keep responsive behavior intact for mobile and desktop.
- Casino pages intentionally use dark, image-backed shells and motion-heavy presentation; preserve that visual direction when changing casino UI.
- Social feed cards should keep coupon/casino activity visually aligned: compact header, rounded card, clear stake/payout block, reactions and comments below.

## Naming Conventions

- Components/pages: `PascalCase` file names and exports.
- Hooks: `useXxx` naming; files may be `use-xxx.ts(x)` per existing project style.
- Context providers: `XxxProvider`; hooks: `useXxx`.
- Variables/functions: `camelCase`.
- Constants: `UPPER_SNAKE_CASE` for true constants.
- Types/interfaces: `PascalCase`.

## Testing Conventions

- Use Vitest APIs (`describe`, `it`, `expect`).
- Prefer Testing Library for component behavior tests.
- Keep tests near source under `src/` with `.test.ts`/`.test.tsx` or `.spec.ts`/`.spec.tsx`.
- Use `src/test/setup.ts` defaults (`jest-dom`, `matchMedia` polyfill).
- Test behavior and outcomes, not implementation details.

## Lint and Formatting

- ESLint config: `eslint.config.js`.
- Current notable rule behavior:
  - React hooks recommended rules enabled.
  - `react-refresh/only-export-components` warns.
  - `@typescript-eslint/no-unused-vars` is currently off.
- No Prettier config is present; preserve existing formatting patterns.

## Generated and High-Churn Files

- Be careful editing generated or scaffolded code.
- `src/integrations/supabase/types.ts` is typically generated from schema.
- If schema changes, prefer regeneration workflow over manual large edits.
- Manual narrow edits to `src/integrations/supabase/types.ts` are acceptable when adding a migration in the same change and Supabase type generation is unavailable.
- Treat `dist/` and `dev-dist/` as build outputs; do not edit them manually.
- Avoid cosmetic churn in `src/components/ui/*` unless needed for the task.

## Change Scope and Safety

- Make the smallest change that solves the requested problem.
- Avoid unrelated renames/moves.
- Do not commit `.env` or secrets.
- If adding dependencies, justify why and keep versions compatible with Vite/React stack.

## Quick Pre-PR Checklist for Agents

- Code builds: `npm run build`
- Bundle-size-impacting changes measured: `npm run perf:build`
- Lint passes: `npm run lint`
- Relevant tests pass; include at least one single-test command when useful.
- No unintended edits to generated files.
- Imports cleaned; no dead code introduced.
- User-visible errors handled with clear feedback.
