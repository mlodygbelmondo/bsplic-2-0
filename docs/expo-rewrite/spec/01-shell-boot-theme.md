# 01 Shell, boot, theme

Scope: app shell and provider tree, routing and auth gating, boot splash, preloading, theme, maintenance mode, connectivity toasts, toaster, perf-lite, scroll chrome, PWA update prompt, page titles, safe-screen CSS, the 404 page. Target is a 390px phone. Desktop (`lg:` and up) is noted in one line where it differs. Feature pages are owned by other specs and are referenced by route only.

Values are taken from source. `file:line` refs point at the file as it stood when this spec was written.

## Files covered

| Path | Lines |
|---|---|
| `src/App.tsx` | 208 |
| `src/main.tsx` | 41 |
| `index.html` | 338 |
| `src/lib/boot/boot-splash.ts` | 247 |
| `src/hooks/useBootSplash.ts` | 22 |
| `src/components/BootController.tsx` | 90 |
| `src/lib/boot/preload.ts` | 163 |
| `src/lib/boot/route-modules.ts` | 38 |
| `src/components/BrandedLoader.tsx` | 26 |
| `src/components/SectionLoader.tsx` | 41 |
| `src/pages/Index.tsx` | 33 |
| `src/pages/NotFound.tsx` | 32 |
| `src/contexts/ThemeContext.tsx` | 76 |
| `src/components/ui/sonner.tsx` | 64 |
| `src/components/ui/dialog.tsx` | 102 |
| `src/components/PwaUpdateModal.tsx` | 43 |
| `src/components/PwaUpdateDialog.tsx` | 86 |
| `src/lib/pwa-registration.ts` | 67 |
| `src/lib/pwa-update.ts` | 37 |
| `src/lib/maintenance-mode.ts` | 162 |
| `api/maintenance.ts` | 26 |
| `middleware.ts` | 55 |
| `public/maintenance.html` | 70 |
| `src/lib/perf-mode.ts` | 87 |
| `src/hooks/usePerfLite.ts` | 6 |
| `src/lib/scroll-chrome.ts` | 86 |
| `src/lib/query-client.ts` | 25 |
| `src/hooks/usePageTitle.ts` | 12 |
| `src/hooks/use-mobile.tsx` | 19 |
| `src/index.css` | 1790 (ranges only: 8-16, 143-146, 260-335, 404-406, 483-490, 670-675, 1657-1737, 1777-1790) |
| `src/App.css` | 42 (unused, see Edge cases) |

Referenced, owned by other specs (not covered here): `src/contexts/AuthContext.tsx` (236), `src/components/LoginPage.tsx` (260), `src/features/admin/components/AdminLayout.tsx` (gate at 176-177), `src/pages/AdminPage.tsx`, `src/pages/CasinoRouletteDevPage.tsx`.

## Surfaces

### Route table

Source: `src/App.tsx` 149-198. Every route is wrapped in `<Suspense fallback={<AppLoadingFallback />}>` (147), where `AppLoadingFallback` renders `BrandedLoader` (87-89).

| Path | Page (App.tsx line) | Auth requirement | Dev-only |
|---|---|---|---|
| `/` | `Index` (149) | Internal gate: loading shows BrandedLoader, no user shows LoginPage, otherwise lazy `AuthenticatedHome` | No |
| `/profile` | `ProfilePage` (150) | None at route | No |
| `/profile/:userId` | `ProfilePage` (151) | None at route | No |
| `/replay` | `ReplayPage` (152-159) | `AuthenticatedRoute` | No |
| `/rankings` | `RankingsPage` (160) | None at route | No |
| `/social` | `SocialPage` (161) | None at route | No |
| `/social/:itemType/:itemId` | `SocialItemPage` (162-165) | None at route | No |
| `/casino` | `CasinoLayout` (167-174) | `AuthenticatedRoute` | No |
| `/casino` (index) | `CasinoHub` (175) | Inherits from `/casino` | No |
| `/casino/roulette` | `CasinoRoulettePage` (176) | Inherits from `/casino` | No |
| `/casino/roulette/dev` | `CasinoRouletteDevPage` (177-180) | Inherits from `/casino` | No (no DEV gate, see Edge cases) |
| `/casino/blackjack` | `CasinoBlackjackPage` (181) | Inherits from `/casino` | No |
| `/casino/slots/:game` | `SlotsPage` (182) | Inherits from `/casino` | No |
| `/jackpot/draw/:roundId` | `JackpotDrawPage` (185-192) | `AuthenticatedRoute` | No |
| `/dev/jackpot` | `JackpotDevFlowPage` (193-195) | None at route | Yes: rendered only when `import.meta.env.DEV` (49-51) |
| `/admin` | `AdminPage` (196), renders `AdminLayout` | None at route. `AdminLayout` gates: loading returns null (176), `!isAdmin && !isModerator` returns `<Navigate to="/" />` (177) | No |
| `/reset-password` | `ResetPasswordPage` (197) | None | No |
| `*` | `NotFound` (198) | None | No |

Non-route surfaces mounted globally (App.tsx 136-145): `Sonner`, `ConnectionToasts`, `PwaUpdateModal`, `BootController`, `AuthenticatedBonusCampaignSurface`, `AuthenticatedFeaturePollSurface`. The two bonus and poll surfaces are owned by another spec.

### 1. App shell and provider tree

- Entry: `src/main.tsx` (41 lines). Before `createRoot(...).render(<App />)` it calls `initBootSplash()`, `startPerfModeDetection()`, `bindMaintenanceModeChecks()`.
- Provider order (`src/App.tsx` 133-206), outermost first:
  1. `ThemeProvider` (134)
  2. `QueryClientProvider` with `queryClient` (135)
  3. `<Sonner richColors />` (136)
  4. `ConnectionToasts` (137, renders null)
  5. `PwaUpdateModal` (138)
  6. `BrowserRouter future={{ v7_startTransition: true }}` (141)
  7. `AuthProvider` (142)
  8. `BootController` (143, renders null)
  9. `AuthenticatedBonusCampaignSurface`, `AuthenticatedFeaturePollSurface` (144-145)
  10. `CouponProvider` (146)
  11. `Suspense` with `AppLoadingFallback` (147), then `Routes` (148-199)
- Layout at 390px: the shell adds no chrome of its own. Routes render full-viewport. Navigation chrome belongs to other specs.
- Motion: `v7_startTransition` keeps the current screen on screen while the next route chunk loads (App.tsx 139-140). Layouts that stay mounted across child routes must reset their own scroll position.
- Sound and haptics: none in this surface.

### 2. Boot splash (`#initial-splash`)

- Entry: static markup in `index.html` (323-334). It is on screen before any JS runs. `initBootSplash()` takes over from `main.tsx`.
- Exit: `finish()` in `boot-splash.ts` when no holds remain, the app is mounted, and the minimum visible time has passed. A forced finish runs at `MAX_VISIBLE_MS`. The element fades out with `transition: opacity .45s ease, visibility .45s ease`. `.boot-splash-leaving` sets `pointer-events: none`. `.boot-splash-done` sets opacity 0 and visibility hidden. `.boot-splash-reopen` runs `boot-fade .3s ease both`.
- Markup (verbatim structure, index.html 323-334):
  ```html
  <div id="initial-splash" aria-hidden="true">
    <div class="boot-glow"></div>
    <div class="boot-wheel"><div class="boot-wheel-ring"></div><div class="boot-ball"></div></div>
    <div class="boot-wordmark">BSPLIC&nbsp;2.0</div>
    <div class="boot-below">
      <div class="boot-track"><div class="boot-bar"></div></div>
      <p class="boot-status" data-boot-status>Przygotowujemy wszystko…</p>
    </div>
  </div>
  ```
- Root container: `position: fixed; inset: 0; z-index: 9999; overflow: hidden; background: #0f0e16; color: #fff`. Font stack `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial`.
- Custom properties on `:root`: `--boot-progress: .06` (drives the bar) and `--boot-gold: hsl(46 98% 54%)`.

Layout at 390px (viewport about 390 x 844):

- Glow: full-bleed. Radial gradient at 50% 50%, `hsl(355 100% 42% / .28)` fading to transparent at 58%. Animation `boot-fade 1s ease both`.
- Wheel: square of `min(84vw, 330px)`, which is 327.6px at 390. Centered at 50%/50% with negative-half margins. Animation `boot-pop .9s cubic-bezier(.16,1,.3,1) both` (opacity 0 and scale .9 to none).
  - `::before`: inset 0. 2px border `hsl(46 90% 58% / .8)`. Box-shadow `0 0 42px hsl(355 100% 45% / .35)` and `inset 0 0 22px hsl(46 90% 50% / .18)`.
  - `::after`: inset 31px. 1px border `hsl(46 90% 58% / .45)`.
  - `.boot-wheel-ring`: inset 4px. Conic background: a green `#0f8a43` segment of 9.73deg, then `repeating-conic-gradient` alternating `#c1121f` and `#17141d` every 9.73deg (period 19.46deg). Mask is transparent at `calc(100% - 26px)` going to `#000` at `calc(100% - 25px)`. Animation `boot-spin 7s linear infinite`.
  - `.boot-ball`: inset 0. Animation `boot-spin-back 2.2s linear infinite`. `::after` is a 9px radial dot (`#fff`, `#c9c9d2` at 60%, `#7c7c88`), placed at `top: 36px`, glow `0 0 10px hsl(0 0% 100% / .55)`.
- Wordmark: text `BSPLIC 2.0` (non-breaking space). Centered on the wheel center. 38px, weight 900, italic, letter-spacing -0.03em, line-height 1, `white-space: nowrap`. Gradient `110deg, #fff 30%, hsl(46 98% 64%) 41%, hsl(355 100% 62%) 47%, #fff 58%`, background-size 250% 100%, text clipped to glyphs. Animation `boot-shimmer 2.6s ease-in-out .6s infinite` (0% at 100% position, 55% to 100% at 0%). Transform `translate(-50%, -50%)`, transition `transform .6s cubic-bezier(.16,1,.3,1)`. In the done state it scales to 1.08.
- Below block: `top: calc(50% + min(42vw, 165px) + 22px)`, which is 50% + 185.8px at 390. Flex column, centered, gap 12px, padding `0 24px`. Animation `boot-rise .6s cubic-bezier(.16,1,.3,1) .12s both` (opacity 0 with translateY 10px to none).
  - Track: 156px x 4px, radius 999px, background `hsl(0 0% 100% / .12)`, overflow hidden.
  - Bar: gradient 90deg from `hsl(46 80% 45%)` to `var(--boot-gold)`. `transform: scaleX(var(--boot-progress))`, transition `.5s cubic-bezier(.2,.8,.2,1)`.
  - Status `<p data-boot-status>`: margin 0, min-height 1.4em, 13px, weight 500, letter-spacing .01em, centered, color `hsl(0 0% 100% / .62)`. Each new message fades in over 260ms ease-out (opacity 0 to 1, translateY 4px to none).
- Reduced motion: every `#initial-splash *` animation runs at 0.01ms and 1 iteration.
- Icons: none. Images: none (CSS only). iOS startup images are separate: 14 `apple-touch-startup-image` links under `/splash/` (index.html 38-50), generated by `node scripts/generate-ios-splash.mjs`.
- Status copy, verbatim (`src/lib/boot/boot-splash.ts` 18-31):
  - app: "Przygotowujemy wszystko…", "Rozgrzewamy silniki…"
  - session: "Sprawdzamy, czy to na pewno Ty…", "Łączymy się z bukmacherem…"
  - assets: "Liczymy Twoje saldo…", "Układamy kursy…", "Odkurzamy Twoje kupony…", "Tasujemy karty…", "Rozkręcamy ruletkę…", "Ładujemy automaty…", "Polerujemy żetony…"
  - done: "Gotowe. Powodzenia!"
  - Rotates every 2100ms when the phase has two or more messages.
- Sound and haptics: none.

### 3. BrandedLoader (full-screen fallback)

- Entry: `AppLoadingFallback` (App.tsx 87-89) for the route Suspense and `AuthenticatedRoute` loading. Also used by `Index` while auth loads.
- Splash visible (`useBootSplashVisible()`): renders `<div class="min-safe-screen bg-[#0f0e16]" aria-hidden="true" />`. No spinner, so it does not compete with the splash.
- Otherwise: `role="status"`, `aria-label="Ładowanie"`, class `min-safe-screen flex items-center justify-center bg-background`. Child `span.brand-loader-delayed`, which fades in (`brand-loader-appear .2s ease .35s both`, opacity 0 to 1). Quick loads never show the spinner. It contains `span.brand-spinner`.
- Layout at 390px: full screen height (`min-safe-screen`), spinner centered. No text.
- Brand spinner (`index.css` 1657-1737):
  - 44px. `brand-spinner-sm` is 28px.
  - Animation `brand-spinner-spin .9s linear infinite`.
  - `::before`: conic gradient (transparent 0%, `hsl(355 100% 47% / .06)` 24%, `hsl(355 100% 47% / .55)` 62%, `hsl(355 100% 52%)` 88%, `hsl(46 98% 54%)` 100%), masked to a ring from `calc(100% - 4.5px)` to `calc(100% - 4px)`. Small variant masks at 3.5px and 3px.
  - `::after`: 20% gold dot `hsl(46 98% 56%)`, glow `0 0 10px 1px hsl(46 98% 56% / .65)`, placed at `top: -3.5%`.
  - Reduced motion: `.brand-spinner` animation none.
- Sound and haptics: none.

### 4. SectionLoader (inline loader)

- Entry: any section waiting on data. Owned by feature specs; the shared behavior is here. Calls `useBootHold()`, so it keeps the splash up if the splash is still visible.
- Props: `size` (`md` default, `sm`), `label` (default "Ładowanie...").
- Layout: `flex flex-col items-center justify-center gap-3`. `md` uses `py-14` (56px vertical). `sm` uses `py-7` (28px vertical).
- Spinner: `brand-spinner`. `sm` adds `brand-spinner-sm`.
- Label: `text-[13px] font-medium text-muted-foreground`.
- Sound and haptics: none.

### 5. Index (route `/`)

- File: `src/pages/Index.tsx` (33 lines). `usePageTitle('Zakłady')`.
- Gate: loading renders `BrandedLoader`. No user renders `LoginPage` (owned by 03-auth). Otherwise renders lazy `AuthenticatedHome` (`loadAuthenticatedHome`, in `route-modules.ts`). The home surface is owned by the sportsbook home spec.

### 6. Authenticated route gate (`AuthenticatedRoute`)

- Source: `src/App.tsx` 119-131.
- Logic: `loading || (user && !profile)` renders `AppLoadingFallback`. `!user || !profile` renders `LoginPage` at the same URL, with no redirect. Otherwise it renders children.
- Used by: `/replay`, `/casino` (and everything under it), `/jackpot/draw/:roundId`.
- Sound and haptics: none.

### 7. Connectivity toasts (`ConnectionToasts`)

- Source: `src/App.tsx` 63-85. Renders null. Listens to `window` `offline` and `online` events and removes both on cleanup.
- Offline: `toast.error("Brak połączenia z internetem", { id: "connection-status", duration: Number.POSITIVE_INFINITY })`. Stays until replaced.
- Online: `toast.success("Połączenie przywrócone", { id: "connection-status", duration: 3000 })`. Same `id`, so it replaces the error toast in place and then auto-dismisses after 3s.
- Styling: sonner toast from `src/components/ui/sonner.tsx`, top-center, `richColors`.
- Sound and haptics: none.

### 8. Toaster (`Sonner`)

- Source: `src/components/ui/sonner.tsx` (64 lines), mounted at `src/App.tsx` 136 as `<Sonner richColors />`.
- Props set by the wrapper: `theme="system"`, `position="top-center"`, `mobileOffset`, `offset`, `className="toaster group"`, default toast duration 2200ms.
- `offset` (default): top `calc(4.75rem + env(safe-area-inset-top, 0px))`, left and right 16px, bottom 16px.
- `mobileOffset`: top `calc(1rem + env(safe-area-inset-top, 0px))`, bottom `calc(1rem + env(safe-area-inset-bottom, 0px))`, left and right 16px. Sonner's own breakpoint for choosing `mobileOffset` was not re-verified here.
- Toast classes: `group-[.toaster]:bg-background`, `group-[.toaster]:text-foreground`, `group-[.toaster]:border-border`, `group-[.toaster]:shadow-lg`. Description `text-muted-foreground`. Action button `bg-primary text-primary-foreground`. Cancel button `bg-muted text-muted-foreground`.
- Icons: sonner defaults (not customized here).
- Sound and haptics: none.

### 9. Theme (`ThemeProvider`, no UI in this scope)

- Source: `src/contexts/ThemeContext.tsx` (76 lines). Exposes `theme: "dark" | "light"` and `toggleTheme()`. `useTheme()` throws outside the provider. The toggle control lives in other surfaces.
- Storage key `bsplic.theme`. Legacy key `bsplic.darkPalette` is removed on every write. Writes are wrapped in try/catch.
- `applyTheme(theme)`: toggles class `light` on `<html>` (true when theme is light). Removes `data-dark-palette`. Sets `meta[name="theme-color"]` to `#090005` (dark) or `#dc2626` (light).
- Palette: `:root` defaults in `src/index.css` 8-16, for example `--background: 338 100% 3%`, `--foreground: 0 100% 96%`, `--card: 340 68% 6%`, `--popover: 340 68% 6%`. `.light` (143-146) sets `color-scheme: light` and `--app-aurora: none`.
- Tailwind `dark:` variants are not used. Dark and light are selected by the `light` class on `<html>`.
- Sound and haptics: none.

### 10. PWA update prompt (`PwaUpdateModal` and `PwaUpdateDialog`)

- Entry: `main.tsx` calls `registerSW({ immediate: true, onNeedRefresh() { showPwaUpdateModal(updateSW) }, onRegisteredSW(_, registration) { if (registration) bindServiceWorkerUpdateChecks(registration) } })`. `showPwaUpdateModal` dispatches a `CustomEvent` named `bsplic:pwa-update-available` with `detail.refresh`.
- `PwaUpdateModal` (43 lines) listens for the event, stores `detail.refresh` only when it is a function, and renders null until then. It lazy-loads `PwaUpdateDialog`.
- Exit: none by the user. The dialog cannot be dismissed. Refresh reloads the page 2500ms after the click.
- Dialog (`src/components/PwaUpdateDialog.tsx`, 86 lines), `<Dialog open>`:
  - Content class: `max-w-[28rem] gap-0 overflow-hidden border-white/20 bg-background p-0 shadow-2xl shadow-red-950/30`. `hideCloseButton`. Escape, pointer-down-outside and interact-outside are all prevented (41-43).
  - Layout at 390px: content is `calc(100% - 2rem)` wide (358px), centered, under the 448px max. Overlay is `bg-black/80` from `dialog.tsx` (not re-read in this pass). Default open animation is `duration-200` from `dialog.tsx`.
  - Header band (`px-6 pb-6 pt-7`, so 24px sides, 28px top, 24px bottom): gradient `linear-gradient(145deg,#d30019 0%,#f0001d 44%,#f43243 100%)`. Sheen overlay `linear-gradient(115deg,rgba(255,255,255,0) 8%,rgba(255,255,255,0.18) 34%,rgba(255,255,255,0.04) 48%,rgba(255,255,255,0) 70%)`, absolute inset 0. Top hairline `h-px bg-white/45`.
  - Icon disc: `h-14 w-14` (56px) `rounded-full bg-white/14 ring-1 ring-white/25 backdrop-blur-sm`, `mb-3` (12px), shadow `0 8px 22px rgba(94,0,16,0.18), inset 0 1px 0 rgba(255,255,255,0.26)`. Inner span `absolute inset-2 rounded-full bg-white/7`. Icon `Sparkles`, `h-7 w-7` (28px), drop shadow `drop-shadow-[0_1px_4px_rgba(78,0,14,0.32)]`.
  - Title `DialogTitle`: "Nowa wersja aplikacji". Classes `text-[1.45rem] font-black leading-tight tracking-tight sm:text-2xl`. Centered, `space-y-1` in the header.
  - Description `DialogDescription`: "Jest dostępna aktualizacja. Odśwież aplikację, żeby korzystać z najnowszej wersji." Classes `text-sm font-medium text-primary-foreground/86`.
  - Body `px-6 py-4` (24px sides, 16px vertical). Button full width, `h-12` (48px), `bg-[#e6001a]`, hover `bg-[#c90018]`, `text-base font-bold transition-colors`. Icon `RefreshCw`, `h-5 w-5 mr-2`. Label "Odśwież", or "Odświeżanie..." while refreshing.
- States:
  - Idle: label "Odśwież", enabled.
  - Refreshing: set true on click. Button disabled, label "Odświeżanie...". The flag resets only when the `refreshHandler` identity changes (`PwaUpdateDialog.tsx` 21-23). In practice the button stays disabled until the page reloads (see Edge cases).
- Interactions: tap "Odśwież" calls `refreshHandler()`, which is `updateSW(false)`, and schedules `setTimeout(reload, 2500)` (`pwa-update.ts`).
- Sound and haptics: none.

### 11. 404 page (`NotFound`)

- Entry: route `*` (App.tsx 198), lazy-loaded via `loadNotFound`.
- Source: `src/pages/NotFound.tsx` (32 lines). `usePageTitle("404")`. Logs on every mount (see Edge cases).
- Layout at 390px:
  - Outer: `flex h-safe-screen items-center justify-center bg-background px-4` (16px sides). Full viewport height.
  - Inner column `text-center`:
    1. `h1` "404": `mb-2 text-5xl font-black tracking-tight` (48px, 8px below).
    2. `p` "Ta strona nie istnieje": `mb-1 text-xl font-semibold` (20px, 4px below).
    3. `p` "Sprawdź adres lub wróć na stronę główną.": `mb-6 text-sm text-muted-foreground` (14px, 24px below).
    4. `Link to="/"`: "Wróć na stronę główną". Classes `press-scale inline-flex h-11 items-center justify-center rounded-xl gradient-primary px-6 text-sm font-bold text-primary-foreground shadow-lg transition hover:brightness-110`. Height 44px, radius 12px, horizontal padding 24px.
- Tokens: `gradient-primary` is `linear-gradient(135deg, hsl(355 100% 50%), hsl(355 80% 40%))` (`index.css` 404-406). `press-scale` is `transition: transform 150ms ease`, and `:active` scales to .94 (670-675).
- Icons: none.
- Sound and haptics: none.

### 12. Maintenance page (`public/maintenance.html`)

- Static HTML, no React, no Tailwind, no splash. Served by the Edge rewrite (see Business rules) or by the client redirect.
- `<html lang="pl">`. `<meta name="robots" content="noindex, nofollow">`. Title "Maintenance". Viewport meta `width=device-width, initial-scale=1.0`.
- Layout at 390px:
  - Body: `display: grid; min-height: 100vh; place-items: center; background: #ffffff; color: #111111`. Font `Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif`.
  - `main` (`aria-label="Maintenance"`): width `min(960px, 100%)`, padding `clamp(24px,6vw,72px) clamp(16px,5vw,48px)`, centered text.
  - `.images`: flex row, centered, gap `clamp(12px,3vw,36px)`. Two `img` elements, `alt=""`, width `min(42vw,360px)` (163.8px each at 390), `max-height: 46vh`, `object-fit: contain`. Sources `/maintenance/thumbs-up.jpeg` and `/maintenance/grin.jpeg`.
  - `p`: margin-top `clamp(20px,5vw,48px)` (20px at 390), font-size `clamp(28px,7vw,72px)` (28px at 390), line-height 0.98, letter-spacing 0, `text-transform: uppercase`, `overflow-wrap: anywhere`.
- Copy, verbatim source "jebać kurwa kurwczala" (rendered uppercase). This copy needs owner sign-off (see Open questions).
- Icons: none. Sound and haptics: none.

### 13. Scroll chrome (`src/lib/scroll-chrome.ts`, behavior only)

- Pure reducer `getNextScrollChromeState(previous, metrics)` over `ScrollChromeState { hidden, lastScrollTop, travel }`. The hiding UI is in the consumers.
- Consumers: `src/features/admin/components/AdminLayout.tsx:26`, `src/components/BetList.tsx:19`, `src/pages/SocialPage.tsx:48`, `src/pages/RankingsPage.tsx:17`.
- Constants: `TOP_RESET_PX` 32, `HIDE_TRAVEL_PX` 56, `SHOW_TRAVEL_PX` 44, `BOTTOM_LOCK_PX` 72, `NOISE_PX` 3.
- Rules are in Business rules.
- Sound and haptics: none.

### 14. Perf-lite (`src/lib/perf-mode.ts`, `usePerfLite`, CSS)

- Behavior: adds class `perf-lite` to `<html>` when the device renders at about 30fps (Low Power Mode or battery saver).
- Hook: `usePerfLite()` in `src/hooks/usePerfLite.ts` (6 lines), `useSyncExternalStore(subscribePerfMode, isPerfLite, () => false)`.
- CSS: `.perf-lite` overrides in `index.css` 1777-1790. Ambient layers set to `animation: none` (see Surface 15).
- Sound and haptics: none.

### 15. Ambient background and safe-screen CSS (`index.css`)

- `.min-safe-screen` and `.h-safe-screen` use `min-height` / `height`: `100svh`, then `var(--app-viewport-height, 100svh)` (483-490).
- `--app-viewport-height` is `100vh` under `display-mode: standalone|fullscreen` and under `:root.standalone` (iOS standalone PWAs, where svh and dvh come out about 59pt short, per project notes).
- `.h-safe-screen.bg-background` is `position: relative; isolation: isolate`, with two ambient layers (260-335):
  - `::before`: drift animation 32s ease-in-out alternate. Gradient at 100deg using `hsl` 355, 343 and 350 at .08 to .12 alpha.
  - `::after`: particle layer, 80s linear infinite upward, 600px tile.
  - Under `.perf-lite`, both are `animation: none`.
- Sound and haptics: none.

### 16. Page titles (`src/hooks/usePageTitle.ts`, 12 lines)

- Sets `document.title` to `"<title> — BSPLIC 2.0"`, or `"BSPLIC 2.0"` when no title is passed. Restores `"BSPLIC 2.0"` on cleanup.
- Titles set in this scope: `Index` "Zakłady", `AdminPage` "Admin", `NotFound` "404".
- The static `<title>` in `index.html` (line 300) is "Bsplic 2.0". The casing differs from the runtime title.

## Data contract

- Auth state consumed by the gates: `user`, `profile`, `loading`, `isAdmin`, `isModerator` from `useAuth()` (`AuthContext.tsx`, owned by 03-auth). `AUTH_BOOTSTRAP_TIMEOUT_MS` is 6000.
- Boot holds: `holdBoot()` returns a release function. `setBootProgress(n)` is monotonic. `setBootPhase(name)` takes `app`, `session`, `assets`, or `done`.
- Preload, signed-in only (`src/lib/boot/preload.ts`, 163 lines):
  - Critical image list: `/jackpot/daily-jackpot-prizes.webp`; `/casino/hub-image.webp` when `(min-width: 768px)` matches, else `/casino/hub-mobile-background.webp`; the `SLOT_GAMES` images; `/casino/roulette-cover.webp`; `/casino/blackjack-cover.webp`; `/casino/slots/symbols.webp`; `/casino/slots/symbols-forge-tide.webp`; `/casino/roulette-table.webp`; `/casino/roulette-wheel-new-3.webp`; `/casino/blackjack-table.webp`; `/casino/blackjack-card-reverse.webp`.
  - Background images, run when idle: `/jackpot/jackpot-draw-stage.webp`, `/jackpot/jackpot-ticket.webp`, `/jackpot/jackpot-winning-ticket.webp`, `/casino/roulette-background.webp`.
  - Page-data prefetches into the React Query cache (9): `socialFeedQuery(userId)`, `socialStoriesQuery()`, `profileStatsQuery(userId)`, `profileBadgesQuery(userId)`, `sportsbookHistoryPreviewQuery(userId)`, `casinoHistoryPreviewQuery(userId)`, `rankingsQuery("sportsbook")`, `rouletteSnapshotQuery()`, `blackjackSnapshotQuery(userId)`.
- Route loaders warmed after a signed-in boot (`src/lib/boot/route-modules.ts`, 38 lines), `SIGNED_IN_ROUTE_LOADERS` with 12 entries: `loadAuthenticatedHome`, `loadCasinoLayout`, `loadCasinoHub`, `loadSocialPage`, `loadRankingsPage`, `loadProfilePage`, `loadCasinoRoulettePage`, `loadCasinoBlackjackPage`, `loadSlotsPage`, `loadSocialItemPage`, `loadJackpotDrawPage`, `loadReplayPage`.
- Query client (`src/lib/query-client.ts`, 25 lines): defaults `staleTime` 60_000, `gcTime` 5 min, `retry` 1, `refetchOnWindowFocus` false. `PAGE_DATA_QUERY_OPTIONS` (line 22): `gcTime` 60 min, `refetchOnMount` "always".
- Sign-out calls `queryClient.clear()` (`BootController.tsx`).
- Theme storage: `localStorage["bsplic.theme"]` with values `"dark"` or `"light"`. The head script in `index.html` (10-27) reads it before React mounts. `bsplic.darkPalette` is legacy and is removed on write.
- Maintenance API: `GET /api/maintenance`, from `src/lib/maintenance-mode.ts` with `cache: "no-store"`, `credentials: "same-origin"`, `Accept: application/json`. Response `{ maintenanceMode: boolean }` with `Cache-Control: no-store, max-age=0` (`api/maintenance.ts`). Reads Edge Config key `maintenanceMode`. On error it logs and returns false.
- PWA update event: DOM `CustomEvent` `bsplic:pwa-update-available`, with `detail.refresh` being `updateSW`.
- Connectivity: `window` `online` and `offline` events. No API call.
- Native equivalents for Expo: the boot splash becomes the native splash plus an in-app overlay that drives the same progress and phase state. Theme preference becomes a stored value with the same two options. The maintenance and PWA-update mechanisms are web-only (see Edge cases).

## Business rules

### Boot splash state machine (`src/lib/boot/boot-splash.ts`)

- Constants: `MIN_VISIBLE_MS` 1000, `REOPEN_MIN_VISIBLE_MS` 900, `MAX_VISIBLE_MS` 9000, `SETTLE_MS` 160, `COMPLETE_MS` 260, `FADE_OUT_MS` 480, `STATUS_ROTATE_MS` 2100, `TRICKLE_MS` 450.
- Trickle: while waiting, progress creeps up in steps of 0.12 every 450ms, capped at `min(0.94, progressTarget + 0.14)`.
- Exports: `initBootSplash`, `showBootSplash`, `markAppMounted`, `runBeforeBootReveal`, `holdBoot` (returns release), `setBootProgress`, `setBootPhase`, `isBootSplashVisible`, `subscribeBootSplash`.
- `finish(force)` is skipped unless forced, while any hold exists, or while the app is not mounted. A forced finish at `MAX_VISIBLE_MS` runs the `beforeReveal` task without holding boot.
- `scheduleFinish`: if a `beforeReveal` task is set, it waits `SETTLE_MS`. Otherwise it waits `max(SETTLE_MS, MIN_VISIBLE_MS - elapsed)`.
- `useBootHold(active = true)` (`src/hooks/useBootSplash.ts`, 22 lines) calls `holdBoot()` in an effect. `useBootSplashVisible()` uses `useSyncExternalStore` with server snapshot `() => false`.

### BootController (`src/components/BootController.tsx`, 90 lines)

- `useBootHold(loading || (Boolean(userId) && !hasProfile))`.
- Calls `markAppMounted` in an effect.
- Layout effect: on sign-out, `queryClient.clear()`. On sign-in, when not loading and the splash is hidden, calls `showBootSplash()` (covers login without reload).
- While loading, phase is `session`.
- On a signed-in user: holds boot, sets phase `assets`, runs `warmSignedInAssets` (progress 0.2 + 0.4 x fraction), releases the hold. Then `runBeforeBootReveal` runs `prefetchPageData` (progress 0.6 + 0.35 x fraction), then `loadAdminPage()` when `isAdmin`.

### Preloading (`src/lib/boot/preload.ts`)

- Logged-out users get no preloading. Signing out clears the cache.
- Each group runs under `runWithinBudget` with `CRITICAL_TIMEOUT_MS` 3000. It is a `Promise.race` of `allSettled` and a timeout, so a slow asset cannot hold the splash past the budget.
- Data Saver, `2g`, or `slow-2g` connections skip image warming.
- Background images run through `runWhenIdle`: `requestIdleCallback` with timeout 4000, else `setTimeout` 1200.
- Prefetch of page data runs only after the first screen has its data (`beforeReveal`).

### Auth gates

- `AuthenticatedRoute`: loading or (user without profile) shows the loader. No user or no profile shows `LoginPage`. Otherwise children render.
- `Index`: loading shows the loader. No user shows `LoginPage`. Otherwise lazy `AuthenticatedHome`.
- `/admin`: no route gate. `AdminLayout` returns null while loading, and returns `<Navigate to="/" />` when `!isAdmin && !isModerator`. Moderators are admitted.
- `/dev/jackpot` exists only when `import.meta.env.DEV`. Other routes are not DEV-gated.

### Theme (`src/contexts/ThemeContext.tsx`)

- `readStoredTheme()` returns `"dark"` only for the exact stored string `"dark"`. Any other value, including no value, returns `"light"`. The error path also returns `"light"`.
- `applyTheme` runs on every theme change, then the value is written to storage and the legacy key is removed.
- `toggleTheme` flips the value.

### Connectivity toasts

- One toast slot, id `connection-status`. Offline sets an error toast that never auto-dismisses. Online replaces it with a 3s success toast.

### PWA update (`src/lib/pwa-registration.ts` 67 lines, `src/lib/pwa-update.ts` 37 lines)

- Service worker registration is idle-gated: `requestIdleCallback(register, { timeout: 3000 })`, with `setTimeout(register, 1500)` as fallback.
- `PWA_UPDATE_CHECK_INTERVAL_MS` = 60_000. `createServiceWorkerUpdateChecker` has a `checking` reentrancy guard and calls `registration.update()` at most once per 60s. `lastCheckAt` is set only on success.
- `bindServiceWorkerUpdateChecks(registration)` checks immediately, then on `visibilitychange` (when not hidden), `focus`, `online`, `pageshow`, and a 60s interval. It returns a cleanup.
- Refresh: `RELOAD_FALLBACK_DELAY_MS` = 2500. Clicking calls `setTimeout(reload, 2500)` and `void updateSW(false)`.

### Maintenance (`src/lib/maintenance-mode.ts` 162 lines, `middleware.ts` 55 lines)

- Two layers: Edge middleware rewrite (server) and client poll (browser). Both fail open.
- Edge middleware: matcher `/:path*`. Skips `/maintenance.html`, `/api/maintenance`, paths matching `\.(css|gif|ico|jpg|jpeg|js|json|map|png|svg|txt|webmanifest|webp|woff2?)$` (case-insensitive), and prefixes `/assets/`, `/badges/`, `/casino/`, `/maintenance/`, `/~oauth/`. Otherwise, if `get("maintenanceMode") === true`, it rewrites to `/maintenance.html`. On error it logs `Failed to read maintenance mode from Edge Config` and calls `next()`.
- Client: `MAINTENANCE_CHECK_INTERVAL_MS` = 30_000. Checks immediately, then on `visibilitychange`, `focus`, `online`, `pageshow`, and the 30s interval. When the flag is true and `location.pathname` differs from `/maintenance.html`, calls `location.replace("/maintenance.html")`. Fetch errors are swallowed. A non-ok response counts as false.

### Perf-lite (`src/lib/perf-mode.ts`, 87 lines)

- `SAMPLE_MS` 1000, `LITE_FRAME_GAP_MS` 26, `MIN_SAMPLES` 12, `RESUME_DELAY_MS` 400.
- Sampling starts after the splash is gone, and again on `visibilitychange` to visible after `RESUME_DELAY_MS`.
- The 25th-percentile frame gap above 26ms turns lite on. Fewer than 12 samples forces lite.

### Scroll chrome (`src/lib/scroll-chrome.ts`)

- At or above `TOP_RESET_PX` (32), reset to visible with travel 0.
- Deltas of `NOISE_PX` (3) or less are ignored.
- Near the bottom (within `BOTTOM_LOCK_PX`, 72) with an upward delta, the state is kept.
- Travel accumulates in one direction and resets on reversal.
- Hides when travel reaches `HIDE_TRAVEL_PX` (56). Shows when travel reaches -`SHOW_TRAVEL_PX` (-44) and not near the bottom.

### Page titles

- Format `"<title> — BSPLIC 2.0"`. Base title `"BSPLIC 2.0"` is restored on unmount.

### Maps to Expo

- Splash: the native splash image (or a React Native overlay) holds until the same hold and phase rules resolve. Keep the 1000ms minimum and the 9000ms forced finish.
- Loader: `BrandedLoader` equivalent is a full-screen `#0f0e16` view while the splash is up, then the 44px gold-red ring spinner after a 350ms delay.
- Toasts: sonner has no direct Expo equivalent in this codebase. The `id` replacement rule and durations are the contract.
- Maintenance, PWA update, `document.title`, `navigator.onLine`, Edge Config, and service worker logic are web-only. Their Expo replacements are open (see Open questions).

## Edge cases & gotchas

1. Theme default conflicts with the comment. `readStoredTheme` returns `"light"` when no value is stored, so a first visit ends in light. The head script (`index.html` 10-27) adds the `light` class only when the stored value is `"light"`. On a first visit (no key) and on any visit where storage fails, the dark CSS paints first, then React adds `light` after mount, which flashes dark to light. Once stored, the head script reads the value and the flash is gone. `src/index.css` 143-144, `index.html` line 25, and the project memory note all say the default is dark.
2. Static theme-color mismatch. `index.html` line 9 has `#0f0e16`. `ThemeContext` sets `#090005` (dark) and `#dc2626` (light). The head script sets `#dc2626` when the stored value is `"light"`.
3. `<html lang="en">` (`index.html` line 2) on Polish content.
4. Sonner uses `theme="system"` (`ui/sonner.tsx` 53). Toasts follow the OS color scheme, not the app's `light` class. In-app light or dark can disagree with toast colors.
5. Splash fade timing: JS `FADE_OUT_MS` is 480, CSS fade is `.45s`. These are not the same value.
6. Standalone detection: the head script adds class `standalone` when `navigator.standalone === true` (iOS). The CSS also uses `display-mode` media queries. Both are needed.
7. Maintenance copy is profane ("jebać kurwa kurwczala"). Owner sign-off is needed before it ships to any surface.
8. Maintenance coverage gaps: middleware exempts `/casino/` and `/maintenance/` (and `/assets/`, `/badges/`, `/~oauth/`). Intent is unconfirmed. Both layers fail open, so an Edge Config read error serves the app.
9. Maintenance client redirect covers the whole SPA, including `/admin`. Admins are not exempt.
10. PWA dialog stays disabled after click. `refreshing` resets only when `refreshHandler` identity changes, so the button shows "Odświeżanie..." until the 2500ms reload. If the reload is blocked, the button stays disabled.
11. The 404 page calls `console.error("404 Error: User attempted to access non-existent route:", location.pathname)` on every mount (`NotFound.tsx` 9-11).
12. `ConnectionToasts` does not check the initial `navigator.onLine`. A page loaded offline shows no toast until the next `offline` event.
13. `/casino/roulette/dev` is not DEV-gated (`App.tsx` 177-180). Only `/dev/jackpot` is.
14. `/admin` has no route-level gate. The gate is in `AdminLayout` (176-177). Moderators are admitted.
15. Breakpoint mismatch: `useIsMobile` uses 768px (`use-mobile.tsx`, `matchMedia("(max-width: 767px)")`). Tailwind `lg:` is 1024px. The brief's desktop line uses `lg:`.
16. Title casing: `index.html` says "Bsplic 2.0". Runtime titles use "BSPLIC 2.0".
17. `index.html` `meta author` is "Lovable" (line 302). `og:image` and `twitter:image` point to an external r2.dev URL, and `twitter:site` is `@Lovable` (lines 304-319). These are from an earlier host.
18. `src/App.css` (42 lines) is unused. No file under `src`, `index.html`, or `main.tsx` imports it.
19. `AdminLayout` and `SocialPage` use the scroll chrome, but chrome visibility is per consumer. Expo needs the same per-screen state.
20. The `AuthenticatedRoute` renders `LoginPage` at the same URL. After login the same URL renders the children, so deep links such as `/casino/roulette` survive a login.
21. Web-only mechanisms with no native equivalent: `vite-plugin-pwa` (`registerSW`), `requestIdleCallback`, `document.title`, `window` `online` and `offline` events, the `beforeinstallprompt`-style standalone check, Vercel Edge middleware and Edge Config, `navigator.connection` (Data Saver and effective type), `visibilitychange`, `pageshow`, and `location.replace`. Each needs an Expo replacement or a stated omission.
22. Global bonus campaign and feature poll surfaces mount on every route for signed-in users (`App.tsx` 144-145). They are owned by another spec, but they run in this shell.

## Open questions

1. Theme default. Should the default be dark (per `index.css` 143-144, `index.html` line 25, and the project memory note) or light (per `ThemeContext.readStoredTheme`)? Expo needs one answer. The current code gives a dark flash on first visit.
2. Theme-color. Should the static `index.html` value (`#0f0e16`) match the runtime values (`#090005` dark, `#dc2626` light)?
3. `<html lang="en">` on Polish content. Change to `pl`?
4. Maintenance copy "jebać kurwa kurwczala". Owner sign-off needed, or a replacement text.
5. Maintenance exemptions. Is the `/casino/` prefix exemption intended? It means the casino stays up during maintenance.
6. `/casino/roulette/dev`. Should it be DEV-gated like `/dev/jackpot`?
7. `/admin` gate. Should moderators be admitted (current behavior in `AdminLayout` 177), and should the gate move to a route-level guard?
8. Toaster theme. Should `Sonner` follow the app theme instead of `theme="system"`?
9. Breakpoints. Should desktop use `lg:` (1024px) or the `useIsMobile` 768px breakpoint?
10. PWA dialog. Should the button re-enable if the reload is blocked? Or should refresh failure show a toast?
11. Connectivity toast. Should an initial offline state show the toast on load?
12. Splash timings. Should the JS `FADE_OUT_MS` (480) be aligned with the CSS fade (`.45s`)?
13. OG and Twitter images and `@Lovable`. Replace with BSPLIC assets and handles, or leave as is?
14. `App.css`. Delete (it has no importers)?
15. Expo replacements for web-only mechanisms: maintenance (Edge rewrite and client poll), PWA update (service worker), and the `navigator.connection` Data Saver check.
