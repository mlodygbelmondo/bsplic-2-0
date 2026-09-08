# Casino regression pass

Reviewed the casino changes through `c9beb1c` and fixed a blackjack return-to-page defect.

Blackjack previously loaded its server snapshot only on mount. Returning to an existing page could leave an outdated hand and wallet visible. The hook now refreshes on visible focus or visibility change. It defers the refresh until an active action and dealer reveal finish, ignores hidden focus events, and removes listeners on unmount.

The new focus test failed before the fix, retaining 104 cards instead of the updated server value of 80. It passes after the fix. Coverage also checks hidden/visible transitions, cleanup, and returning during an unresolved hit. A browser scenario changes the server fixture from playing to lost and verifies that focus displays the result without sending a game action.

## Verification

- Casino, slots, and casino page Vitest coverage: 180 tests across 21 files. The expanded run found one invalid synchronous wallet mock; after correcting it to match the Promise contract, all 17 blackjack hook tests passed. The other 163 tests passed in the expanded run.
- `npx playwright test --config playwright.casino.config.ts`: 16 passed, 2 intentionally skipped desktop cases. Covers desktop Chromium, iPhone WebKit, and a 320 × 568 viewport.
- `npx playwright test --config playwright.slots.config.ts`: 18 passed. Covers all four games, net loss, retry identity after reload, automatic bonus completion, pause/resume, and stopping before a paid spin.
- `bash scripts/test-casino-slots.sh`: all isolated PostgreSQL checks passed, including wallet deductions, payout rounding, bonus consumption, replay, and simultaneous requests for the last free spin without a paid charge.
- `npm run lint`: no errors, 16 existing warnings.
- `npm run build`: passed, including PWA generation.
- `git diff --check`: passed.
- Inspected the compact blackjack and iPhone roulette screenshots. Controls remain above navigation; the blackjack hand remains above its decision controls.

## Limits

Browser tests use controlled HTTP responses. SQL tests run in a disposable local database. No production wagers, deployment, or native Expo device testing occurred. Browser focus and visibility events cover lifecycle handling but do not reproduce operating-system suspension. Roulette cycle and resume behavior are covered by existing unit tests; the browser roulette scenario covers selection and submission rather than a complete live round.
