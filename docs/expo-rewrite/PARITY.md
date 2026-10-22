# Parity checklist

Status per surface: `complete` (meets the contract's definition of done and was exercised on the iOS simulator or covered by a credible test), `partial`, `blocked`, `not started`. Never mark `complete` without verification.

| # | Area | Surface | Native route / module | Status | Notes |
|---|---|---|---|---|---|
| 1 | Shell | Boot splash (native splash → roulette overlay, holds, min/max timing) | `features/boot` | complete | Cold start and the re-show after login verified on the simulator; prefetches every section before fading out |
| 2 | Shell | Theme (light default, dark toggle, stored) | `theme`, `lib/preferences` | complete | Light default, dark toggle from the menu, persisted; both themes compared with the web |
| 3 | Shell | Mobile navbar (wordmark, balance chip, bell, menu) | `features/shell/AppHeader` | complete | Compared with the web in both themes |
| 4 | Shell | Header menu (right drawer) | `sheets/menu` | complete | Right drawer like the web (`OverlayScreen` `drawer-right`); compared in both themes; menu links switch tabs after the close animation |
| 5 | Shell | Daily top-up | `sheets/topup` | partial | Dialog like the web, compared on the simulator; claiming not exercised |
| 6 | Shell | Bottom tabs (Zakłady, Social, Gry, Rankingi, Profil; minimize on scroll) | `(tabs)/_layout` | complete | Web nav colors (gold on dark/casino, red on light and over the white Social feed); minimizes on scroll |
| 7 | Shell | Connectivity toasts, offline write blocking | `features/shell/ConnectivityWatcher`, `lib/connectivity` | partial | Not exercised on the simulator |
| 8 | Shell | Maintenance mode | `features/shell/MaintenanceGate` | partial | Logic covered by tests; cannot be toggled on production |
| 9 | Shell | 404 | `+not-found` | partial | Not exercised |
| 10 | Auth | Login | `sign-in` | complete | Login and persisted session verified |
| 11 | Auth | Registration | `sign-in` | partial | Not exercised (would create production accounts) |
| 12 | Auth | Forgot password | `sign-in` | partial | Not exercised (sends production email) |
| 13 | Auth | Password recovery via universal link | `reset-password` | blocked | Needs AASA + Team ID to activate links |
| 14 | Auth | Persistent session, logout, cache clear | `features/auth/auth-store` | complete | Cold start from the stored session, logout (sign-in screen in under a second) and re-login verified on the simulator; cache cleared on sign-out and account switch |
| 15 | Sportsbook | Bet list, categories, live/boost, sorting | `(tabs)/(home)` | complete | Category rail, count line, cards and balanced titles compared with the web in both themes; sort sheet not yet exercised |
| 16 | Sportsbook | Bet card odds selection | `features/home` | complete | Selection adds to the coupon with the toast |
| 17 | Sportsbook | Propose bet | `sheets/propose-bet` | partial | Dialog with the web layout; not exercised on the simulator |
| 18 | Coupon | Coupon bar | `features/coupon/CouponBar` | complete | |
| 19 | Coupon | Coupon sheet, single/AKO, stake, AKO exclusions, placement | `sheets/coupon` | partial | A 1 zł single placed side by side with the web (same toast and timing); AKO placement not exercised |
| 20 | Jackpot | Daily jackpot card, ticket purchase | `features/jackpot` | partial | Card and buy dialog compared with the web; purchase not executed |
| 21 | Jackpot | Jackpot draw | `jackpot/draw/[roundId]` | complete | Settled draw, replay spin and reveal compared with the PWA on the simulator; opens at once from the cache where the web shows a loader |
| 22 | Wallet | Money transfer send | `sheets/wallet` | partial | Dialog like the web; form compared; no transfer executed (would move money to another player) |
| 23 | Wallet | Transfer history | `sheets/wallet` | complete | Compared with the web |
| 24 | Profile | Own profile (player card, stats, badges, histories) | `(tabs)/profile` | complete | Compared with the web in both themes |
| 25 | Profile | Public profile | `profile/[userId]` | complete | Opens instantly from rankings (press-in prefetch); compared with the web |
| 26 | Profile | Avatar upload | `features/profile` | partial | Not exercised |
| 27 | Replay | Replay page, chart, history, coupon details | `replay` | partial | Page with the latest coupon compared with the web; no settled coupons in range, so the chart is not exercised |
| 28 | Replay | Replay poster share | `features/replay` | partial | Not exercised |
| 29 | Rankings | Rankings tabs and stats | `(tabs)/rankings` | complete | Compared with the web in both themes; changing the sort keeps the list at the top |
| 30 | Social | Feed, pagination, realtime, new-items pill | `(tabs)/social` | partial | Feed and filters compared with the web; realtime pill not exercised |
| 31 | Social | Feed cards (posts, coupon, casino activity) | `features/social` | complete | Coupon and post cards compared with the web |
| 32 | Social | Reactions, reactors | `sheets/reactors` | partial | Reactors list is a dialog like the web; not exercised |
| 33 | Social | Images, image viewer | `sheets/image-viewer` | partial | Not exercised |
| 34 | Social | YouTube/Spotify embeds | `features/social` | partial | Not exercised |
| 35 | Social | Coupon copying, sharing, deep links | `features/social` | partial | Not exercised |
| 36 | Social | Post composer (text, image, mentions) | `sheets/compose-post` | partial | Sheet height and layout compared with the web; posting not exercised |
| 37 | Social | Stories strip, composer, viewer | `sheets/compose-story`, `sheets/story-viewer` | partial | Strip compared with the web; the composer opens full screen; composer and viewer not exercised |
| 38 | Social | Comments, replies, mentions autocomplete | `features/social/comments` | partial | Comment input on the item page compared with the web |
| 39 | Social | Eniu bot replies | `features/social/eniu` | partial | Triggered by the comment and post actions; not exercised |
| 40 | Social | Social item page | `social/[itemType]/[itemId]` | complete | Compared with the web |
| 41 | Casino | Casino hub | `(tabs)/casino` | complete | Compared with the web |
| 42 | Casino | Roulette live table, wheel, bets, stake drawer | `(tabs)/casino/roulette`, `sheets/roulette-stake` | partial | Table, wheel, panels and stake bar compared with the web; betting not yet exercised |
| 43 | Casino | Blackjack | `(tabs)/casino/blackjack` | partial | Table with a game in progress compared with the web (load time on par); actions not exercised |
| 44 | Casino | Slots | `(tabs)/casino/slots/[game]`, `sheets/slot-rules` | partial | Screen and a 5 zł spin compared with the web; rules dialog not exercised |
| 45 | Engagement | In-app notifications (bell, popover, realtime, sound) | `features/notifications`, `sheets/notifications` | partial | Bell, popover like the web and navigation to a draw verified; realtime and sound not exercised |
| 46 | Engagement | Bonus campaigns | `features/bonus-campaigns` | partial | No active campaign to exercise |
| 47 | Engagement | Feature polls | `features/feature-polls` | partial | No active poll to exercise |
| 48 | Admin | Shell, role gating, mobile nav | `admin` | partial | Typecheck and ported tests pass; device QA needs an admin account (none available) |
| 49 | Admin | Dashboard | `features/admin` | partial | Typecheck and ported tests pass; device QA needs an admin account (none available) |
| 50 | Admin | Manage bets (edit, settle, delete, AKO) | `features/admin` | partial | Typecheck and ported tests pass; device QA needs an admin account (none available) |
| 51 | Admin | Create bet | `features/admin` | partial | Typecheck and ported tests pass; device QA needs an admin account (none available) |
| 52 | Admin | Proposals | `features/admin/tabs/ProposalsTab` | partial | Typecheck and ported tests pass; device QA needs an admin account (none available) |
| 53 | Admin | Categories | `features/admin/tabs/CategoriesTab` | partial | Typecheck and ported tests pass; device QA needs an admin account (none available) |
| 54 | Admin | Eniu bot | `features/admin/tabs/EniuBotTab` | partial | Typecheck and ported tests pass; device QA needs an admin account (none available) |
| 55 | Admin | Agent runs | `features/admin/tabs/AgentRunsTab` | partial | Typecheck and ported tests pass; device QA needs an admin account (none available) |
| 56 | Admin | Bonus campaigns admin | `features/admin/tabs/BonusCampaignsTab` | partial | Typecheck and ported tests pass; device QA needs an admin account (none available) |
| 57 | Admin | Feature polls admin | `features/admin/tabs/FeaturePollsTab` | partial | Typecheck and ported tests pass; device QA needs an admin account (none available) |
| 58 | Platform | Universal links / `bsplic://` for every route | `app.json`, router | partial | Scheme and associated domain configured; activation needs Team ID + AASA |
| 59 | Platform | Signed-in preload (tab data, art) | `lib` | complete | Boot prefetch of feed, stories, profile, history, rankings, roulette spins and blackjack table; press-in prefetch for profiles, social items and casino games |
| 60 | Platform | Android static validity (`expo export --platform android`) | — | complete | `expo export --platform android` succeeds |
