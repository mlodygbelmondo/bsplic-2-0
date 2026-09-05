# BSPLIC Replay

Read-only sportsbook summary at **Profil → Replay** (`/replay`). Only your own profile has the entry point. The route uses the existing authentication guard. No demo mode or auth bypass is shipped, and public profile usernames are not reserved or shadowed by a new route.

## Design and walkthrough

Replay is a summary-first profile feature, not a separate presentation. It reuses the existing Navbar, app surfaces, Inter typography, theme tokens and buttons in light and dark mode. No introduction, chapters, autoplay, decorative receipt, slogans or generated UI image.

The first card shows the settled net result, a scrubbable curve and four metrics. Below are the highest actual winning payout (or latest coupon when there is no win) and newest-first history. Outcome filters and native disclosure rows let users inspect actual coupon and leg details. History renders 20 at a time, up to all 200 loaded coupons. Filters and pagination make no extra requests. Chart selection is identity-based and survives replacement snapshots without stale offsets.

**Jak liczymy?** discloses calculation details. Partial coverage and stale-data warnings remain visible. Empty states offer older history instead of encouraging new bets.

**Udostępnij** opens the app dialog and only then imports the PNG renderer. The real 1080 × 1920 image uses the current theme, with an optional bounded nickname, actual statistics, dates, coverage and a virtual-currency caveat. Closing the dialog revokes its object URL and resets nickname consent. Native file sharing requires an explicit click, with PNG download as fallback. Nothing is uploaded or published.

## Data semantics

`useReplayHistory` calls the existing permission-checked `get_user_coupon_history` RPC for the authenticated user. A single request reads 201 rows: 200 are retained, with the extra row only detecting truncation. Queries are cancellable, identity-keyed, do not refetch on focus, and drop unused history on unmount.

Periods use coupon creation dates, not settlement dates. The 7/30-day choices are rolling 24-hour windows relative to capture time; dates use Europe/Warsaw. **Ostatnie kupony** is not lifetime statistics. Partial coverage is disclosed in the UI and export.

The validated model sums money in integer cents. Net result is recorded settled payout minus settled stake, including refunds and excluding pending coupons. Accuracy is wins / (wins + losses), excluding refunds and pending coupons. The chart applies current settled results in placement order: it is not wallet history or a settlement-time ledger. Casino, top-ups and transfers are excluded. Pending-only histories show no invented settled zero or success rate.

Invalid responses fail visibly. Loading, empty, retry and failed-refresh-with-preserved-snapshot states are explicit. No database migration, balance mutation, new dependency, paid service or global theme change is included. The Expo application and existing PWA precache behavior are unchanged.

## Verification

```sh
npm ci --legacy-peer-deps
export TZ=Europe/Warsaw
export VITE_SUPABASE_URL=https://replay-test.supabase.co
export VITE_SUPABASE_PUBLISHABLE_KEY=replay-test-public-key-not-a-secret
npm run test
npm run lint
node scripts/check-replay-types.mjs
npm run perf:build
npx playwright install --with-deps chromium webkit
npx playwright test --config playwright.replay.config.ts
```

Browser tests exercise the production build and real app/provider/router with deterministic intercepted HTTP fixtures. Live requests, writes and service workers are blocked. Desktop Chromium and iPhone-sized WebKit cover immediate results, profile entry/return, signed-out isolation, filters/pagination, keyboard disclosure and chart scrubbing, light/dark layouts, reduced motion, 320px/long-title handling, the 200-row cap, errors/retry/stale snapshots, loss/pending/replacement states, dialog focus and consent, and real PNG signature/dimensions/decoding.

`Replay quality` runs the full unit suite, lint, the scoped type gate, production build and browser suite. Its `replay-browser-evidence` artifact contains screenshots, exported PNGs, reports, failure traces and unit results. Consult the actual run on the final PR SHA; this document does not imply that checks passed. Generated outputs must not be committed.

### Boundaries

Full-project TypeScript already has diagnostics outside Replay. The scoped gate checks the complete program but blocks diagnostics only in Replay, App.tsx and ProfilePage.tsx, reporting the limitation explicitly. This is not a clean whole-project type check. Existing dependency-audit findings and unrelated lint warnings are not remediated; dependencies and lockfile are unchanged.

HTTP fixtures do not verify a live Supabase account, a physical iPhone or native OS share sheet. An authorized signed-in deployment smoke test and physical-device sharing check remain manual. No test uses live balances or publishes data.

## Rollout / rollback

Use normal review and deployment. No migration, secret or backfill is needed. Reverting the PR removes the entry point and summary without changing stored data. Keep the PR unmerged until normal code and design review.
