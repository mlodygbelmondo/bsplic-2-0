# BSPLIC Replay

A personal, read-only sportsbook recap for the web/PWA. Open **Profil → BSPLIC Replay**, or `/replay` while signed in. The entry card only appears on your own profile. The existing authentication guard protects the route; no demo mode or authentication bypass is shipped.

## Reviewer walkthrough

1. Choose 7 days, 30 days, or latest coupons. Step through the five chapters manually; optional playback advances every seven seconds and pauses on interaction or a hidden tab. Reduced-motion users get manual navigation.
2. Scrub the **Bilans** curve with touch or keyboard. Inspect the highlighted coupon, then select tiles in **Mapa** and expand their leg details. A dense history can expand from 40 tiles to all 200 loaded coupons.
3. In **Finał**, download the real 1080 × 1920 PNG. The preview omits your nickname until you explicitly opt in. Native file sharing is offered where supported; downloading remains available. Nothing is uploaded or posted automatically.

The design uses the app's Polish voice and late-night palette, with a cream receipt, burgundy surfaces, yellow highlights, large typography and restrained transitions. No external imagery, new font download, chart dependency or paid service is required.

## Data semantics

`useReplayHistory` calls the existing permission-checked `get_user_coupon_history` RPC for the authenticated user. It requests 201 rows once: at most 200 enter the experience, and the extra row only detects truncation. This avoids unbounded fetching and inconsistent offset pages. The query is identity-keyed, cancellable, has no focus refetch, and drops unused cached history on unmount.

The three choices describe **coupon creation dates**, not settlement dates. The 7/30-day windows are rolling 24-hour periods relative to capture time; display dates and active-day grouping use `Europe/Warsaw`. The all-history choice is deliberately called **Ostatnie kupony**, not lifetime statistics. Partial periods are disclosed in both the UI and exported image. Period changes are computed locally without another request.

Money is normalized and validated at the API boundary, then summed in integer cents. Net result is recorded settled payout minus settled stake, including refunds and excluding pending coupons. Accuracy is wins / (wins + losses), excluding refunds and pending coupons. The curve applies those settled results in coupon-placement order: **it is not a wallet-balance graph or a settlement-time ledger**. Casino results, top-ups and other balance movements are not included. The feature never estimates future results or invents a winning highlight.

The model and renderer are separate from the query and presentation. Data with an invalid shape, status, timestamp or monetary value fails visibly rather than turning into an empty or misleading success. Loading, initial failure, retry, empty periods and failed-refresh-with-previous-snapshot states have explicit UI.

## Export and accessibility

The poster is rendered with the Canvas API on the user's device, without external images or uploads. Only summary statistics, period/coverage and an optional bounded nickname are drawn; account IDs and coupon details are not exported. The shareable file is prepared before a share-button click to preserve browser user activation. Unsupported sharing and non-cancellation failures keep a PNG fallback; object URLs are revoked on regeneration/unmount.

Manual navigation maintains a visible chapter control and keyboard focus when a scene unmounts. Range-input arrow keys are not intercepted by chapter navigation. Status tiles combine symbols, text labels and color; touch controls are at least 44px. Motion is opt-in for playback, and CSS/JavaScript honor reduced-motion preferences.

## Reproducing verification

```sh
npm ci --legacy-peer-deps
TZ=Europe/Warsaw npm test
npm run lint
node scripts/check-replay-types.mjs

VITE_SUPABASE_URL=https://replay-test.supabase.co \
VITE_SUPABASE_PUBLISHABLE_KEY=replay-test-public-key-not-a-secret \
npm run perf:build

npx playwright install --with-deps chromium webkit
npx playwright test --config playwright.replay.config.ts
```

The dedicated Playwright config intentionally does not depend on the existing Lovable-specific config. Tests run the production build in desktop Chromium and an iPhone-sized WebKit context. Deterministic HTTP fixtures exercise the real app/provider/router/rendering path; service workers and outbound live requests are blocked. There are no real account credentials, database writes or balance changes. Checks include profile entry/return, signed-out isolation, all chapters, keyboard behavior, 320px layouts and long titles, filters, empty/error/retry/stale states, negative/pending results, the 200-row cap, and the PNG file signature and dimensions.

The `Replay quality` workflow also runs the entire Vitest suite, lint, a scoped TypeScript gate and a production bundle report. Its `replay-browser-evidence` artifact contains the HTML browser report, completed-transition screenshots, actual exported PNGs, and machine-readable unit results (14-day retention). `replay-build` is retained for seven days. Generated reports are ignored by Git.

### Boundaries of verification

- The repository already has full-project TypeScript errors outside Replay. `check-replay-types.mjs` checks the complete program but only gates diagnostics in Replay, `App.tsx` and `ProfilePage.tsx`; it explicitly reports outside-scope diagnostics. It does not claim a clean whole-project type check. Existing dependency-audit findings are not remediated by this feature; dependencies and lockfile are unchanged.
- Browser verification uses HTTP fixtures, not a live production Supabase account. It verifies browser engines and emulated viewports, not a physical iPhone or an operating-system share sheet. A signed-in production smoke test and native-share-sheet check remain manual deployment checks.
- This is a web/PWA feature; the separate Expo application is unchanged. The existing PWA precache strategy is also unchanged. Route code/CSS and the poster renderer are lazy-loaded rather than included in the login entry bundle.

## Rollout and rollback

No migration, secret, service configuration or data backfill is needed. Merge and deploy through the normal application pipeline. Reverting the PR removes the profile card and route without changing any stored user data. Keep the PR unmerged until the normal review/deployment decision.
