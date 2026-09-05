# BSPLIC Replay

A private, read-only sportsbook overview for the web/PWA. Open **Profil → Replay**, or `/replay` while signed in. The entry card appears only on your own profile; the existing authentication guard protects the route. No demo mode or authentication bypass is shipped.

## Design and walkthrough

Replay uses the existing application navbar, Inter typography, theme tokens, card surfaces, buttons and dialogs. It follows the user's light/dark preference; there is no independent burgundy/cream/gold palette. The earlier receipt, orbit decoration, five chapters, autoplay and promotional captions have been removed.

The result, chart and coupons are available immediately. Choose 7 days, 30 days or latest coupons. Scrub the chart with touch or keyboard to inspect cumulative results. Select a coupon in the status grid to inspect it; expand its details to see individual legs. The default selection is the largest actual winning payout, or the latest coupon when there is no win. Dense histories expand from 40 visible tiles to all 200 loaded coupons.

**Udostępnij Replay** opens an explicit preview dialog. It prepares a real 1080 × 1920 PNG on-device, using the current app theme. Nickname inclusion is opt-in. Save the image or invoke native file sharing where supported; nothing is uploaded or posted automatically. Closing the dialog returns focus to the trigger. Calculation notes are available under **Jak liczymy wynik?**, not repeated around the main interface.

## Data semantics and safety

`useReplayHistory` calls the existing permission-checked `get_user_coupon_history` RPC for the authenticated user. It requests 201 rows once: at most 200 enter Replay and the extra row detects truncation. This avoids unbounded fetching and inconsistent offset pages. The query is identity-keyed, cancellable, has no focus refetch, and drops unused cached history on unmount. Period changes are computed locally without another request.

Periods use **coupon creation dates**, not settlement dates. The 7/30-day windows are rolling 24-hour periods relative to capture time; dates use `Europe/Warsaw`. The broadest choice is **Ostatnie kupony**, not lifetime statistics. Partial periods are disclosed in the overview and exported image.

The existing validated model sums integer cents. Net result is recorded settled payout minus settled stake, including refunds and excluding pending coupons. Accuracy is wins / (wins + losses), excluding refunds and pending coupons. The chart applies settled results in coupon-placement order: **it is not a wallet-balance graph or a settlement-time ledger**. Casino results, top-ups and other balance movements are excluded. Pending-only history shows no settled result or invented zero-profit curve; losses do not produce a fictional winning highlight.

Invalid response shapes, statuses, timestamps and monetary values fail visibly instead of being silently converted to an empty success. Loading, empty, retry and stale-refresh states remain supported. Chart and coupon selection use identity rather than a brittle position during refresh.

No database migration, balance mutation, paid service, new runtime dependency, global theme change or production authentication bypass is included. The feature is scoped to the web/PWA; the Expo app is unchanged. Route code/CSS and the poster renderer remain lazy-loaded. The profile entry does not fetch history.

## Export and accessibility

Only summary statistics, period/coverage and an optional bounded nickname are drawn. No account IDs, individual coupon details, external images or uploads are involved. The file is prepared before the share-button click to preserve user activation. Unsupported sharing and non-cancellation failures keep a PNG fallback; object URLs are revoked on regeneration/unmount. Changing the app theme regenerates the preview.

Native range controls retain arrow-key behavior. Grid statuses combine symbols, text labels and color. Controls use at least 44px targets, the dialog has a visible close control, reduced-motion settings are respected, and narrow/long-content layouts are checked. This is not a claim of a complete accessibility certification or a physical-device test.

## Reproducing verification

```sh
npm ci --legacy-peer-deps
export TZ=Europe/Warsaw
export VITE_SUPABASE_URL=https://replay-test.supabase.co
export VITE_SUPABASE_PUBLISHABLE_KEY=replay-test-public-key-not-a-secret
npm test
npm run lint
node scripts/check-replay-types.mjs
npm run perf:build
npx playwright install --with-deps chromium webkit
npx playwright test --config playwright.replay.config.ts
```

The dedicated Playwright configuration exercises the production build in desktop Chromium and mobile WebKit. Deterministic HTTP fixtures drive the real app/provider/router path; service workers and live outbound requests are blocked. There are no real account credentials or financial writes. Cases cover profile navigation, signed-out isolation, immediate overview, chart/grid interaction, dialog focus, PNG signature/dimensions, opt-in name, 320px layouts, both app themes, filters, empty/error/stale states, negative/pending results and the 200-coupon cap.

The `Replay quality` workflow runs the full Vitest suite, lint, scoped TypeScript check, production bundle report and browser suite. `replay-browser-evidence` contains the HTML report, screenshots, exported PNGs and unit results; `replay-build` contains the built application. Consult the latest run on the PR for actual outcomes, not this description of the checks.

Local visual review can also render the real Replay components and app navbar with fixture auth/history hooks. Those screenshots are explicitly sample data, not proof of the full hosted integration. CI browser runs remain the integration check.

### Verification boundaries

Full-project TypeScript errors outside Replay already exist. The scoped gate checks the complete program but gates Replay, `App.tsx` and `ProfilePage.tsx` diagnostics and explicitly reports the remaining diagnostics. Existing dependency audit findings and unrelated lint warnings are not remediated by this design revision.

HTTP-fixture browser checks do not verify a live Supabase account, a physical iPhone or its native operating-system share sheet. An authorized signed-in deployment smoke test and native sharing check remain manual. No green-check or deployment claim is implied by this document.

## Rollout and rollback

No migration, secret, backfill or service configuration is required. Deploy through the normal application pipeline. Reverting the PR removes the profile card and route without changing stored user data. Keep the PR unmerged until design and normal code review are complete.
