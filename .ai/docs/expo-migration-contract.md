# BSPLIC Expo native rewrite — contract v2

Status: requested by Piotr on 2026-10-21. Replaces the v1 contract and the old `mobile/` port, which was deleted.

This is the authoritative scope and acceptance reference for the native app in `mobile/`. Read it before changing anything there. When implementation pressure conflicts with it, keep the contract and report the blocker.

## Outcome

- A fresh Expo app with **100% feature parity** with the production PWA at phone size (the web layout below 1024 px wide), implemented natively and tuned for performance.
- Same product: features, business rules, roles, data, Polish copy, brand, light/dark themes, casino art direction and motion character. Native components replace web ones wherever the platform does it better (tabs, stacks, sheets, menus, lists, gestures, haptics), without redesigning the product.
- Parity is tracked per surface in `docs/expo-rewrite/PARITY.md` as `complete`, `partial`, `blocked` or `not started`. Never claim parity for an item that was not verified.
- Per-surface web specs live in `docs/expo-rewrite/spec/*.md`. They are a map, not a substitute: when in doubt, read the web source under `src/` — it is the reference implementation.

## Scope

In scope: every production route and surface of the PWA, including registration (the web login page has it), password recovery, sportsbook, coupon, jackpot (card and draw), wallet (top-up, transfers, history), profile (own/public, avatar, badges, histories), replay, rankings, social (feed, posts, images, stories, comments, mentions, reactions, Eniu, YouTube/Spotify, deep links, coupon copying, sharing), casino hub, roulette, blackjack, slots, bonus campaigns, feature polls, in-app notifications, maintenance mode, connectivity state, and the full admin/moderator panel (dashboard, bets, create bet, AKO exclusions, proposals, categories, Eniu, bonus campaigns, feature polls, agent runs).

Out of scope: dev-only routes (`/casino/roulette/dev`, `/dev/jackpot`), the unused magic-link API and dead `AuthModal`, the PWA service-worker update prompt and `document.title` (no native equivalent), push notifications, biometrics, Apple/Google sign-in, and any new product feature.

## Platforms

- iOS and Android from one codebase. Interactive QA runs on the iOS simulator only (host RAM); Android must stay statically valid (`expo export --platform android`, Expo Doctor).
- Development builds (`expo run:ios`), not Expo Go: the app uses native modules (MMKV, Skia, keyboard controller, glass, fonts plugin).
- `ios/` and `android/` are generated (CNG) and never committed or edited by hand.

## Repository layout

- `mobile/` — the Expo app. The Vite/PWA app at the repository root stays untouched.
- `mobile/src/app/` — Expo Router routes only. Every other module lives outside it.
- `mobile/src/features/<area>/` — feature code (api, hooks, components, logic) owned per area.
- `mobile/src/ui/` — shared primitives. `mobile/src/lib/` — infrastructure. `mobile/src/theme/` — tokens and styling helpers.
- Pure logic ported from the web (rules, formatters, parsers) is copied into the matching feature folder with its tests; do not import from the root `src/`.

## Stack (binding)

- Expo SDK 58, React Native 0.88 (New Architecture), React 19.3, React Compiler on, typed routes.
- Navigation: Expo Router. `NativeTabs` (`expo-router/native-tabs`) for the five primary tabs, native stacks inside tabs, native `formSheet`/`modal`/`fullScreenModal` presentations for drawers, dialogs and viewers, `Stack.Protected` for auth gating.
- Styling: React Native styles via `createStyles` from `@/theme` (styles built once per scheme). No NativeWind, no Tailwind runtime. Port CSS gradients with the native `backgroundImage` CSS-string style prop, shadows with `boxShadow` strings, `filter`/`mixBlendMode` where they help. Inter is embedded; select faces with `fontFamily: 'Inter'` + `fontWeight`.
- Motion: Reanimated 4 on the UI thread (CSS-style keyframes/transitions API is allowed). No JS timers driving visual motion. Gestures: react-native-gesture-handler.
- Graphics: `@shopify/react-native-skia` for wheels, confetti, charts, posters and effects plain views cannot do; `react-native-svg` + `lucide-react-native` for icons (same icon names as the web); SF Symbols (`expo-symbols`) for native tab/toolbar icons.
- Glass: `expo-glass-effect` (iOS 26 Liquid Glass) with `expo-blur`/solid fallback; respect Reduce Transparency.
- Lists: `@shopify/flash-list` v2 for every long or paginated list.
- Images: `expo-image` (memory+disk cache, `recyclingKey` in lists); `expo-image-picker` + `expo-image-manipulator` for uploads.
- Data: `@supabase/supabase-js` against the production project; TanStack Query v5 with the MMKV-persisted cache (`@/lib/query-client`); zustand for client state; `react-native-mmkv` storage; session encrypted at rest (`@/lib/storage` `secureKv`).
- Feedback: `sonner-native` toasts (top-center, rich colors, 2200 ms default, same ids/durations as the web), `expo-haptics`, `expo-audio`.
- Keyboard: `react-native-keyboard-controller`. Web content: `react-native-webview`. Sharing: native share sheet, `expo-sharing`, `expo-clipboard`.
- Adding a dependency requires a reason in the commit message; install with `npx expo install`.

## Navigation map

| Web path | Native route file | Presentation |
|---|---|---|
| `/` | `src/app/(tabs)/(home)/index.tsx` | tab “Zakłady” |
| `/social` | `src/app/(tabs)/social/index.tsx` | tab “Social” |
| `/casino` | `src/app/(tabs)/casino/index.tsx` | tab “Gry” |
| `/casino/roulette` | `src/app/(tabs)/casino/roulette.tsx` | push in Gry stack |
| `/casino/blackjack` | `src/app/(tabs)/casino/blackjack.tsx` | push in Gry stack |
| `/casino/slots/:game` | `src/app/(tabs)/casino/slots/[game].tsx` | push in Gry stack |
| `/rankings` | `src/app/(tabs)/rankings/index.tsx` | tab “Rankingi” |
| `/profile` | `src/app/(tabs)/profile/index.tsx` | tab “Profil” |
| `/profile/:userId` | `src/app/profile/[userId].tsx` | push over tabs |
| `/social/:itemType/:itemId` | `src/app/social/[itemType]/[itemId].tsx` | push over tabs |
| `/replay` | `src/app/replay.tsx` | push over tabs |
| `/jackpot/draw/:roundId` | `src/app/jackpot/draw/[roundId].tsx` | full-screen modal |
| `/admin` | `src/app/admin/…` | push over tabs, own stack |
| `/reset-password` | `src/app/reset-password.tsx` | public |
| login / register / forgot | `src/app/sign-in.tsx` | public, replaces tabs when signed out |
| header menu, top-up, wallet, notifications, coupon, propose bet, composers, reactors, story viewer, image viewer, stake drawer, slot rules | `src/app/sheets/…` | native form sheets / modals |

Every supported web path must open the matching native screen from a universal link (`https://bsplic.vercel.app/...`) and from `bsplic://`.

## Product rules

- Polish copy verbatim from the web, including toasts, empty/error states and accessibility labels. Web uses raw Supabase error text in some places; keep that unless the web maps it.
- Theme: light by default (web `readStoredTheme`), dark on toggle, stored preference. On phones the Social page uses its own light Facebook-like palette in both themes (`socialMobileColors`).
- Header (web `Navbar`, mobile part): gradient bar with the italic “BSPLIC 2.0” wordmark, balance chip (opens top-up), notifications bell, menu button. Bottom tabs: Zakłady, Social, Gry, Rankingi, Profil, minimizing on scroll.
- Roles: `isAdmin`/`isModerator` from `user_roles`; admin entry only for admins/moderators.
- Live server state is authoritative: never show a cached live roulette round, blackjack game, jackpot draw or slot spin; always fetch fresh. Never assume timers or animations kept running while the app was in the background — resume from server state on foreground.
- Offline: cached reads stay visible; wagering, casino, financial, social and admin writes are disabled with a clear message, never queued.
- Realtime channels open only while their screen is focused and the app is active, and are always removed on blur/background/unmount.
- Decorative infinite animations stop under `useLiteMotion()` (reduced motion or Low Power Mode); heavy glass/blur falls back to plain surfaces.
- Accessibility: labels on icon buttons, 44 pt touch targets, Dynamic Type not breaking layouts, reduced motion honored.

## Performance rules

- 60/120 fps scrolling: FlashList with stable keys, memoized rows, `expo-image` with fixed sizes, no layout thrash in rows.
- Subscribe narrowly: zustand selectors, query `select`, no context that re-renders the tree on every balance tick.
- Cold start: the native splash hands over to the in-app boot overlay; a signed-in cold start renders the first screen from the cached identity and persisted query cache, then refreshes in the background.
- `NativeTabs` mounts every tab eagerly: tab roots must defer heavy work (queries, realtime, images) until first focus.
- Measure, don't guess: check the JS and UI thread FPS in the perf monitor on heavy screens (feed, bet list, roulette, blackjack, slots, jackpot draw).

## Identity, links, auth

- Display name `BSPLIC 2.0`, scheme `bsplic`, bundle id / package `pl.bsplic.app`, web fallback `https://bsplic.vercel.app`.
- Universal Links / App Links for `bsplic.vercel.app`; activation needs the Apple Team ID, `apple-app-site-association`, `assetlinks.json` and Supabase redirect allow-list entries — document, don't fake.
- Email/password login, registration, forgot password, password recovery via universal link, persistent session, logout. Sessions are not shared with the browser.

## Git and safety

- Branch `expo-native-rewrite` in its own worktree. Small logical commits. Never push.
- Never commit secrets, `.env*.local`, signing material or test credentials (`.test-credentials.local.md`).
- Production Supabase stays the backend. New SQL only if strictly required, as a new migration with tests, never applied to production.
- QA on production data: low-value actions on the reusable test account are fine; admin QA must be reversible and cleaned up; never settle real bets, reset seasons or touch other users' data.

## Definition of done (per surface)

A surface is `complete` only when it uses the real Supabase contract; handles loading, empty, error, offline, auth and role states; has full navigation with no fake stubs; matches the PWA at phone size in both themes; and was exercised on the iOS simulator or covered by a credible test.

## Verification

`npm run typecheck`, `npm run lint`, `npm test` (pure logic), `npx expo-doctor`, `npx expo export` for iOS and Android, iOS simulator walkthroughs with side-by-side PWA screenshots, and an independent review of the full diff before final delivery. Root web checks (`npm run lint`, `npm run build`) must keep passing.
