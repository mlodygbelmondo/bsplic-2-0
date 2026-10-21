# Parity checklist

Status per surface: `complete` (meets the contract's definition of done and was exercised on the iOS simulator or covered by a credible test), `partial`, `blocked`, `not started`. Never mark `complete` without verification.

| # | Area | Surface | Native route / module | Status | Notes |
|---|---|---|---|---|---|
| 1 | Shell | Boot splash (native splash → roulette overlay, holds, min/max timing) | `features/boot` | partial | Cold start verified on the simulator; login re-show not yet verified |
| 2 | Shell | Theme (light default, dark toggle, stored) | `theme`, `lib/preferences` | partial | |
| 3 | Shell | Mobile navbar (wordmark, balance chip, bell, menu) | `features/shell/AppHeader` | not started | |
| 4 | Shell | Header menu sheet | `sheets/menu` | not started | |
| 5 | Shell | Daily top-up | `sheets/topup` | not started | |
| 6 | Shell | Bottom tabs (Zakłady, Social, Gry, Rankingi, Profil; minimize on scroll) | `(tabs)/_layout` | partial | NativeTabs wired; not yet exercised |
| 7 | Shell | Connectivity toasts, offline write blocking | `features/shell/ConnectivityWatcher`, `lib/connectivity` | partial | |
| 8 | Shell | Maintenance mode | `features/shell/MaintenanceGate` | not started | |
| 9 | Shell | 404 | `+not-found` | not started | |
| 10 | Auth | Login | `sign-in` | not started | |
| 11 | Auth | Registration | `sign-in` | not started | |
| 12 | Auth | Forgot password | `sign-in` | not started | |
| 13 | Auth | Password recovery via universal link | `reset-password` | not started | Needs AASA + Team ID to activate links |
| 14 | Auth | Persistent session, logout, cache clear | `features/auth/auth-store` | partial | |
| 15 | Sportsbook | Bet list, categories, live/boost, sorting | `(tabs)/(home)` | not started | |
| 16 | Sportsbook | Bet card odds selection | `features/home` | not started | |
| 17 | Sportsbook | Propose bet | `sheets/propose-bet` | not started | |
| 18 | Coupon | Coupon bar | `features/coupon/CouponBar` | not started | |
| 19 | Coupon | Coupon sheet, single/AKO, stake, AKO exclusions, placement | `sheets/coupon` | not started | Store and pure helpers ported with tests |
| 20 | Jackpot | Daily jackpot card, ticket purchase | `features/jackpot` | not started | |
| 21 | Jackpot | Jackpot draw | `jackpot/draw/[roundId]` | not started | |
| 22 | Wallet | Money transfer send | `sheets/wallet` | not started | |
| 23 | Wallet | Transfer history | `sheets/wallet` | not started | |
| 24 | Profile | Own profile (player card, stats, badges, histories) | `(tabs)/profile` | not started | |
| 25 | Profile | Public profile | `profile/[userId]` | not started | |
| 26 | Profile | Avatar upload | `features/profile` | not started | |
| 27 | Replay | Replay page, chart, history, coupon details | `replay` | not started | |
| 28 | Replay | Replay poster share | `features/replay` | not started | |
| 29 | Rankings | Rankings tabs and stats | `(tabs)/rankings` | not started | |
| 30 | Social | Feed, pagination, realtime, new-items pill | `(tabs)/social` | not started | |
| 31 | Social | Feed cards (posts, coupon, casino activity) | `features/social` | not started | |
| 32 | Social | Reactions, reactors | `sheets/reactors` | not started | |
| 33 | Social | Images, image viewer | `sheets/image-viewer` | not started | |
| 34 | Social | YouTube/Spotify embeds | `features/social` | not started | |
| 35 | Social | Coupon copying, sharing, deep links | `features/social` | not started | |
| 36 | Social | Post composer (text, image, mentions) | `sheets/compose-post` | not started | |
| 37 | Social | Stories strip, composer, viewer | `sheets/compose-story`, `sheets/story-viewer` | not started | |
| 38 | Social | Comments, replies, mentions autocomplete | `features/social/comments` | not started | |
| 39 | Social | Eniu bot replies | `features/social/eniu` | not started | |
| 40 | Social | Social item page | `social/[itemType]/[itemId]` | not started | |
| 41 | Casino | Casino hub | `(tabs)/casino` | not started | |
| 42 | Casino | Roulette live table, wheel, bets, stake drawer | `(tabs)/casino/roulette`, `sheets/roulette-stake` | not started | |
| 43 | Casino | Blackjack | `(tabs)/casino/blackjack` | not started | |
| 44 | Casino | Slots | `(tabs)/casino/slots/[game]`, `sheets/slot-rules` | not started | |
| 45 | Engagement | In-app notifications (bell, sheet, realtime, sound) | `features/notifications`, `sheets/notifications` | not started | |
| 46 | Engagement | Bonus campaigns | `features/bonus-campaigns` | not started | |
| 47 | Engagement | Feature polls | `features/feature-polls` | not started | |
| 48 | Admin | Shell, role gating, mobile nav | `admin` | not started | |
| 49 | Admin | Dashboard | `features/admin` | not started | |
| 50 | Admin | Manage bets (edit, settle, delete, AKO) | `features/admin` | not started | |
| 51 | Admin | Create bet | `features/admin` | not started | |
| 52 | Admin | Proposals | `features/admin/tabs/ProposalsTab` | not started | |
| 53 | Admin | Categories | `features/admin/tabs/CategoriesTab` | not started | |
| 54 | Admin | Eniu bot | `features/admin/tabs/EniuBotTab` | not started | |
| 55 | Admin | Agent runs | `features/admin/tabs/AgentRunsTab` | not started | |
| 56 | Admin | Bonus campaigns admin | `features/admin/tabs/BonusCampaignsTab` | not started | |
| 57 | Admin | Feature polls admin | `features/admin/tabs/FeaturePollsTab` | not started | |
| 58 | Platform | Universal links / `bsplic://` for every route | `app.json`, router | partial | Scheme and associated domain configured; activation needs Team ID + AASA |
| 59 | Platform | Signed-in preload (tab data, art) | `lib` | not started | |
| 60 | Platform | Android static validity (`expo export --platform android`) | — | not started | |
