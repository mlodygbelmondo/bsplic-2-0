# 02 - Navbar, mobile menu, balance chip, top-up dialog, liquid-glass bottom nav

Scope: the BSPLIC top bar (desktop and mobile), the balance chip, the notifications bell slot, the desktop avatar dropdown, the mobile menu Sheet, the daily top-up dialog, the `?wallet=history` deep link, the floating liquid-glass bottom nav, and the scroll-hide chrome they share.

Out of scope (owned elsewhere): the notifications popover and realtime feed (`15-notifications-bonus-polls.md`), the transfer dialog and its data (`09-rankings-transfers.md`), auth screens and profile loading (`03-auth.md`), profile page (`08a-profile.md`), boot splash and theme provider (`01-shell-boot-theme.md`), table of all Supabase calls (`19-data-contract.md`).

Target: Expo (React Native). Breakpoints are the web ones. "Desktop" means viewport width >= 1024 px (Tailwind `lg`). Mobile layouts are specified at 390 px wide, with 86vw Sheet width computed from that.

Polish copy is verbatim. Source strings are quoted exactly, including the typo "Błąd doławania".

---

## Files covered

| Path | Lines | Role |
|---|---|---|
| `src/components/Navbar.tsx` | 403 | Top bar, state owner, mounts all children below |
| `src/components/NavbarMobileMenu.tsx` | 184 | Mobile Sheet menu (lazy, mounted only while open) |
| `src/components/NavbarTopupDialog.tsx` | 75 | Daily top-up dialog, calls `secure_daily_topup` |
| `src/components/LiquidGlassMobileBottomNav.tsx` | 166 | Floating 5-item bottom nav |
| `src/components/liquidGlassMobileNavStyles.ts` | 85 | Bottom nav class and style helpers (dark, light, casino) |
| `src/components/mobileBottomNavStyles.ts` | 57 | Only `MobileBottomNavTone` is imported. Four helpers are dead code. Do not port. |
| `src/components/AppMobileBottomNav.tsx` | 9 | Wrapper: `<LiquidGlassMobileBottomNav hidden={hidden} />`. Used only by Navbar. |
| `src/components/NavLink.tsx` | 28 | Dead code (no importers). Do not port. |
| `src/hooks/usePerfLite.ts` | 6 | `useSyncExternalStore` over perf-lite flag |
| `src/lib/perf-mode.ts` | 87 | Samples frame gaps, sets `html.perf-lite` |
| `src/lib/scroll-chrome.ts` | 86 | Hide-on-scroll state machine `getNextScrollChromeState` |
| `src/features/social/polishDay.ts` | 29 | `getPolishDateString`, `canClaimTopup` (Warsaw calendar day) |
| `src/contexts/AuthContext.tsx` | 236 | `user`, `profile`, `isAdmin`, `isModerator`, `signOut`, `refreshProfile`, `updateProfileBalance` |
| `src/contexts/ThemeContext.tsx` | 76 | Theme state, `bsplic.theme`, `.light` class, meta theme-color |
| `src/components/BootController.tsx` | 90 | Splash hold, `queryClient.clear()` on sign-out, signed-in preload |
| `src/features/home/components/AuthenticatedHome.tsx` | 79 | Only home passes `onOpenProposeModal` and `mobileBottomNavHidden` |
| `src/features/home/layout/HomeShell.tsx` | (n/a) | Passes `onScrollChromeHiddenChange` from BetList |
| `src/components/BetList.tsx` | (n/a) | Scroll container lines 155-214 feed scroll-chrome state |
| `src/pages/SocialPage.tsx` | (n/a) | Navbar with `mobileBottomNavHidden` (line 530); scroll container 530-560 |
| `src/pages/RankingsPage.tsx` | (n/a) | Navbar with `mobileBottomNavHidden` (line 153); scroll container 153-169 |
| `src/components/ui/sheet.tsx` | 107 | shadcn Sheet (Radix Dialog) |
| `src/components/ui/dialog.tsx` | 102 | shadcn Dialog |
| `src/components/ui/dropdown-menu.tsx` | 179 | shadcn DropdownMenu |
| `src/components/ProposeBetModal.tsx` | 305 | Opened from mobile menu on home. Spec 04 owns. |
| `src/features/notifications/components/NotificationsBell.tsx` | 389 | Bell button and popover. Spec 15 owns. |
| `src/features/transfers/components/MoneyTransferDialog.tsx` | 100 | Transfer dialog. Spec 09 owns. |
| `src/index.css` | 1790 | Tokens, `.gradient-navbar`, `.navbar-chip`, `.press-scale`, `.app-subsurface`, perf-lite rules |
| `index.html` | 338 | Pre-paint theme script, initial meta theme-color |
| `supabase/migrations/20260703181500_harden_client_writable_surfaces.sql` | 216 | `secure_daily_topup` (lines 3-49) |
| `supabase/migrations/20260316100100_daily_topup_polish_day.sql` | (n/a) | Earlier definition of the Warsaw-day rule |
| `src/integrations/supabase/types.ts` | (n/a) | Line 1896: `secure_daily_topup: { Args: { p_user_id: string }; Returns: number }` |
| `src/components/Navbar.test.tsx` | (n/a) | About 30 tests. Behaviour reference only. |
| `src/features/social/polishDay.test.ts` | (n/a) | 10 tests for the day rule |

Existing native counterpart (untracked, not reviewed by this spec): `mobile/src/features/shell/AppHeader.tsx`.

Callers of `<Navbar />` (for context on where the top bar appears): `AuthenticatedHome` (with props), `SocialPage` (line 530, with `mobileBottomNavHidden`), `RankingsPage` (lines 25 and 153, with `mobileBottomNavHidden`), `CasinoLayout.tsx:21`, `ProfilePage.tsx:241` (loading branch) and `:253` (main branch, only one mounts), `SocialItemPage.tsx:156`, `ReplayPage.tsx:29`, `AdminLayout.tsx:203` (no props), `JackpotDevFlowPage.tsx:350` (dev only).

---

## Surfaces

### S1. Top bar (`Navbar`)

**Entry.** Rendered inside every page that mounts `<Navbar />`. Always fixed to the top.
**Exit.** None inside the bar. Navigation links change route. The bar unmounts with its page.

**Container.** `nav`, Tailwind classes `gradient-navbar safe-area-top fixed inset-x-0 top-0 z-50 shadow-md` (Navbar.tsx:160). Inner row `flex items-center justify-between px-4 max-[360px]:px-2 h-11 max-w-[1600px] mx-auto` (line 161). Height 44 px plus `env(safe-area-inset-top)`. A spacer `div.navbar-offset` (height `calc(2.75rem + var(--safe-area-top))`, line 371) sits under it. Background, dark: `linear-gradient(90deg, hsl(0 0% 0% / 0.99) 0%, hsl(338 100% 4% / 0.99) 32%, hsl(343 86% 20% / 0.98) 70%, hsl(343 86% 34% / 0.98) 100%)`. Bottom border `hsl(342 100% 52% / 0.28)`. `backdrop-filter: blur(14px)`. Light: `linear-gradient(90deg, hsl(355 100% 44%), hsl(355 90% 38%))`, no blur, no border.

**Logo.** `Link to="/"` (lines 164-169). Text `BSPLIC 2.0`. Classes `brand-logo-pill whitespace-nowrap max-[360px]:text-[13px] rounded-md px-2 py-[5px] text-[16px] font-black italic tracking-tight text-white leading-none transition hover:brightness-110`. No background, no shadow in either theme.

**Desktop, one line each (>= 1024 px).**
- Logo left, then a link group (`hidden lg:flex items-center gap-4`, lines 170-241), then a right cluster (`hidden lg:flex h-full items-center gap-3`, lines 244-319).
- Links: `Zakłady` `/`, `Kasyno` `/casino`, `Social` `/social`, `Rankingi` `/rankings`. Each is `text-[14px] font-semibold leading-none hover:text-navbar-foreground transition-colors`. Active `text-navbar-foreground`. Inactive `text-navbar-foreground/60`.
- Admin: `Admin` with ShieldCheck 16 px, shown when `isAdmin` (lines 215-227). Moderator-only (not admin): `Propozycje` with ShieldCheck 16 px, linking to `/admin` (lines 228-240).
- Right cluster: balance chip (S2), bell (S3), avatar dropdown trigger (S4).

**Mobile, full layout at 390 px wide (< 1024 px).**
```
+--------------------------------------------------------------+  top, fixed, z-50
| [BSPLIC 2.0]                   [chip 1250.00 zł] [bell] [≡]  |  44 px + safe-top
+--------------------------------------------------------------+
|  padding 16 px each side (8 px below 360 px)                 |
|  -- page content --                                          |
|                                                              |
|                                                              |
|                       [ floating bottom nav, see S8 ]        |  72 px + safe-bottom
+--------------------------------------------------------------+
```
- Left: logo pill (16 px font, `px-2 py-[5px]`).
- Right cluster `lg:hidden flex h-full items-center gap-2` (lines 321-367): balance chip (only when `profile` loaded and `!isDesktopNav`), bell (only when `!isDesktopNav`, rendered logged out too), menu button (always).
- Chip text is `text-[12px]`. Below 360 px it drops to `text-[10px]`.
- Menu button: 32 x 32 px, `Menu` icon 24 px, `text-primary-foreground/80`, hover `text-primary-foreground`. `aria-label="Otwórz menu"`.

### S2. Balance chip

**Entry.** Shown when `profile` is loaded. Desktop variant when `isDesktopNav`, mobile variant otherwise.
**Exit.** Tap opens the top-up dialog (S6), or shows a toast when capped.

**Structure.** `button` with `press-scale navbar-chip flex h-8 items-center gap-1.5 rounded-full py-0 pl-1 pr-3 text-[13px] font-bold leading-none text-primary-foreground transition-colors` (desktop, line 247). Mobile: `... whitespace-nowrap py-0 pl-1 pr-2.5 text-[12px] max-[360px]:text-[10px] ...` (line 325).
- Circle: `h-6 w-6 rounded-full gradient-primary` (`linear-gradient(135deg, hsl(355 100% 50%), hsl(355 80% 40%))`, hard-coded hue 355), holding `Plus` icon (desktop 16 px, mobile 14 px, `strokeWidth={3}`).
- Label: `{formattedBalance} zł`, for example `1250.00 zł`. Format is `Number(balance).toFixed(2)`, dot decimal, no thousands separator.

**Copy.**
- `title` when available: `Doładuj portfel`. When capped: `Już doładowano dzisiaj. Wróć jutro!`.
- `aria-label` when available: `Portfel: 1250.00 zł. Doładuj portfel`. When capped: `Portfel: 1250.00 zł. Doładowanie dostępne jutro`.

**Visual tokens.** `.navbar-chip`: dark border `1px solid hsl(var(--border) / 0.7)`, background `hsl(var(--card) / 0.8)`, hover `hsl(var(--muted))`. Light: border `hsl(0 0% 100% / 0.25)`, background `hsl(0 0% 100% / 0.16)`, hover `hsl(0 0% 100% / 0.26)`. Text `primary-foreground` (white in both themes).

**States.** Available or capped (only the title, label and the tap behaviour differ; the chip looks the same). Hidden when logged out or when profile is null.

**Interaction.** Tap calls `openTopupDialog` (Navbar.tsx:138-145). If not available: `toast.error("Już doładowano dzisiaj. Wróć jutro!")` and the dialog does not open. Otherwise the dialog opens.

**Motion.** `press-scale`: transform 150 ms ease, `:active` scale 0.94. Colours transition with Tailwind `transition-colors` (defaults, not overridden here).

**Sound and haptics.** None.

### S3. Notifications bell slot

**Entry.** Rendered in both clusters, gated only by layout (not login): desktop when `isDesktopNav` (lines 258-265), mobile when `!isDesktopNav` (lines 335-342). Renders logged out too, because the gate is not `profile`.
**Exit.** Owned by spec 15 (popover and realtime).

**Props passed by Navbar.** `userId={user?.id}`. Desktop `className="h-8 w-8 p-0 [&>svg]:h-5 [&>svg]:w-5"`. Mobile `className="h-8 w-8 [&>svg]:h-5 [&>svg]:w-5"`. Wrapped in `Suspense fallback={null}` (lazy import).

**Icon.** `Bell` (lucide), default 24 px, overridden to 20 px by the class above.

**Copy.** Label `Powiadomienia`, or `Powiadomienia, {n} nieprzeczytane` when unread (NotificationsBell.tsx:66-68).

**Behaviour in this slot.** With no `userId`, the component clears its state and returns, so no channel opens (NotificationsBell.tsx:113-114).

### S4. Desktop avatar dropdown

**Entry.** Desktop cluster, shown when `profile` is loaded (lines 266-318).
**Exit.** Item selection, or dismiss (outside tap or Escape, Radix default).

**Trigger.** `button`, `title="Menu użytkownika"`, classes `flex h-8 items-center gap-2 text-[13px] font-medium leading-none text-primary-foreground transition hover:brightness-110 outline-none`.
- Avatar 28 px (`h-7 w-7 bg-primary-foreground/20`). Image alt `Avatar {username}`. Fallback shows the first letter, uppercased, `text-[11px] font-bold`.
- Username `hidden sm:inline` (hidden below 640 px).
- `ChevronDown` 14 px at 70% opacity.

**Content.** `DropdownMenuContent align="end" className="w-44"` (176 px). Items in order:
1. `Profil`. `Link to="/profile"` with `UserRound` 16 px, `mr-2`.
2. `Wyślij pieniądze`. Calls `openTransferDialog("send")`. `Send` 16 px.
3. Theme item. `Sun` icon when dark, `Moon` when light. Label `Tryb jasny` when dark, `Tryb ciemny` when light. Calls `toggleTheme`.
4. Separator.
5. `Wyloguj`. Calls `signOut()`. `LogOut` 16 px.

No propose entry and no top-up item on desktop. Top-up is only through the chip.

**Motion.** Radix content with shadcn `zoom-95` open or close animations (dropdown-menu.tsx). Duration is the tailwindcss-animate default and was not verified.

### S5. Mobile menu (`NavbarMobileMenu`, Sheet)

**Entry.** Menu button (S1). Navbar sets `mobileMenuOpen=true`, then mounts the lazy component with `Suspense fallback={null}` (Navbar.tsx:351-366).
**Exit.**
- Close button (X), overlay tap, or Escape: `onOpenChange(false)`.
- Nav link tap: `SheetClose` wrapper closes it.
- `Doładuj 100 zł`: closes the Sheet, then opens the top-up dialog (see below).
- `Wyślij pieniądze`: closes, then opens transfer dialog with tab `send`.
- `Zaproponuj zakład`: closes, then `onOpenProposeModal()`.
- `Wyloguj się`: closes, then `void signOut()`.

**Container.** `SheetContent side="right"`, classes `safe-area-top duration-100 safe-area-bottom w-[86vw] max-w-sm p-0 border-l border-border`. At 390 px: 335 px wide (86vw), capped at 384 px (`max-w-sm`). Full height. Base shadcn classes also apply: `bg-background`, `shadow-lg`, `z-50`, `fixed`, `inset-y-0 right-0 h-full border-l`. Overlay `fixed inset-0 z-50 bg-black/80`.

**Layout top to bottom at 390 px.**
1. Header `border-b border-border px-4 py-4`. Title `Menu` (`SheetTitle`, `text-base`). The shadcn close X is `absolute right-4 top-4` with `X` icon 16 px and sr-only label `Close` (English, from shadcn).
2. Body `flex-1 overflow-y-auto px-4 py-4 space-y-6` (24 px between blocks).
   - Nav list. Each item is `SheetClose asChild > Link`, `block rounded-md px-3 py-2.5 text-sm font-semibold transition-colors`. Text only, no icons. Active `bg-primary/10 text-primary`. Inactive `text-foreground hover:bg-muted`. Labels in order: `Zakłady` `/`, `Kasyno` `/casino`, `Social` `/social`, `Rankingi` `/rankings`, then `Admin` `/admin` when `isAdmin`. No `Propozycje` here.
   - Account card, only when `profile` is loaded. `app-subsurface rounded-lg p-3 space-y-3`.
     - Row: `Saldo` (muted) left, `{balance.toFixed(2)} zł` bold right (`font-bold text-foreground`).
     - Button `Doładuj 100 zł`. Full width, `flex items-center justify-center gap-1 bg-primary/10 hover:bg-primary/15 text-primary px-3 py-2 rounded-md text-[12px] font-bold transition-colors`, `Plus` 14 px.
     - Button `Wyślij pieniądze`. Full width, `flex items-center justify-center gap-1 border border-primary/20 bg-background hover:bg-primary/5 text-foreground px-3 py-2 rounded-md text-[12px] font-bold transition-colors`, `Send` 14 px `text-primary`.
     - Profile row: `SheetClose asChild > Link to="/profile"`, `flex items-center gap-2 rounded-md px-2 py-2 hover:bg-background transition-colors`. Avatar 28 px (`bg-primary/10`), fallback `text-[11px] font-bold text-primary`. Username `text-sm font-medium text-foreground`.
3. Footer `border-t border-border p-4 space-y-2` (8 px between).
   - `Zaproponuj zakład`. Only when `onOpenProposeModal` is passed (home only). `flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors`, `Lightbulb` 16 px.
   - Theme toggle. `Sun` or `Moon` 16 px. Label `Tryb jasny` (dark) or `Tryb ciemny` (light). Classes `w-full flex items-center justify-center gap-2 rounded-md border border-border px-3 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors`.
   - `Wyloguj się`. `SheetClose asChild > button`, `LogOut` 16 px. No profile gate, so it shows when logged out.

**Motion.** Open: shadcn `data-[state=open]:animate-in`, slide in from the right, `data-[state=open]:duration-500` (500 ms) overrides `duration-100` on the same element, `ease-in-out` from base classes. Overlay fades in with tailwindcss-animate defaults (not verified). Close: the Sheet unmounts immediately when `mobileMenuOpen` becomes false, so the `data-[state=closed]:duration-300` exit probably never plays (verify in browser).

**Sound and haptics.** None.

### S6. Top-up dialog (`NavbarTopupDialog`)

**Entry.** Chip tap (S2) when available, or `Doładuj 100 zł` in the mobile menu (S5). Mounted only while `topupOpen` (Navbar.tsx:377-387), lazy with `Suspense fallback={null}`.
**Exit.** Close (X or overlay). Automatic close after a successful top-up (`onOpenChange(false)`).

**Container.** `DialogContent` with `w-[calc(100%-1.25rem)] max-w-sm rounded-xl p-5 sm:w-full sm:max-w-sm` (overrides shadcn `w-[calc(100%-2rem)] max-w-lg rounded-lg p-6`). Background `bg-background`, overlay `bg-black/80`.

**Layout at 390 px.**
1. Title `💰 Doładuj portfel`, centred.
2. Body, centred: `Doładuj swój portfel o ` + bold `100 zł` (`font-bold text-foreground`) + `. Możesz to zrobić raz dziennie.`
3. Button `Doładuj 100 zł`, full width, `w-full gradient-primary text-primary-foreground font-bold h-11` (44 px). While loading: `Ładowanie...`, `disabled={topupLoading}`.

**Motion.** shadcn Dialog open: `zoom-95` plus fade, `duration-200` (200 ms). Close not visible (unmount).

**Sound and haptics.** None.

**Behaviour.** See Data contract (RPC) and Business rules.

**Toasts (sonner).**
- Success: `💰 Doładowano 100 zł. Wróć jutro po więcej!`
- RPC error: `error.message` raw, or fallback `Błąd doławania` (typo, NavbarTopupDialog.tsx:39).
- Thrown exception: `Błąd doładowania` (NavbarTopupDialog.tsx:46).

### S7. Transfer entry points (dialog owned by spec 09)

Navbar holds `transferOpen` and `transferInitialTab` (`"send"` or `"history"`). Mounted only when `transferOpen && profile` (Navbar.tsx:389-400). Three entry points:
1. Desktop avatar dropdown, `Wyślij pieniądze` (S4): `openTransferDialog("send")`.
2. Mobile menu, `Wyślij pieniądze` (S5): closes Sheet, then `openTransferDialog("send")`.
3. Deep link `?wallet=history` (Navbar.tsx:108-114): when `profile` is loaded, sets tab `history` and opens the dialog. The effect depends on `[location.search, profile]`.

Closing the dialog (`handleTransferOpenChange`, lines 121-136) removes the `wallet` search param and calls `navigate({ pathname, search }, { replace: true })`, so the deep link does not re-open on refresh. No in-app producer of `?wallet=history` was found. It is a deep-link only entry.

### S8. Floating liquid-glass bottom nav

**Entry.** Rendered when `showMobileBottomNav` is true: `profile` is loaded AND `pathname` does not start with `/admin` (Navbar.tsx:92-95, 373-375). Mounted by Navbar, not by pages.

**Exit.** Not dismissable. Hidden by scroll (see below) or by unmount on /admin, logout, or profile loss.

**Container.** `nav aria-label="Nawigacja aplikacji"` (no `aria-hidden`). Classes: `lg:hidden fixed inset-x-0 bottom-0 z-50 pointer-events-none px-2 pb-[calc(0.55rem+env(safe-area-inset-bottom))] transition-[transform,opacity] duration-200 ease-out will-change-transform`. Plus `translate-y-full opacity-0` when hidden, else `translate-y-0 opacity-100`.

**Inner shell.** `pointer-events-auto relative mx-auto h-[72px] w-full max-w-[430px]`. At 390 px: outer 390 px minus 8 px padding each side, so the glass is `calc(100vw - 1rem)` = 374 px wide.

**Shell classes** (`grid h-[72px] w-[calc(100vw-1rem)] max-w-[430px] grid-cols-5 overflow-hidden rounded-[1.75rem] border px-1.5 py-1.5 ring-1`, plus `backdrop-blur-2xl` unless perf-lite, plus the helpers below). Corner radius 28 px. Padding 6 px horizontal, 6 px vertical. Five equal columns.

**Liquid glass wrapper.** When not perf-lite, the shell is wrapped in `LiquidGlass` (`liquid-glass-react`) with `displacementScale={46} blurAmount={0.035} saturation={152} aberrationIntensity={1.35} elasticity={0.04} cornerRadius={28} padding="0px" overLight={false} mode="standard" className="w-full"`. Style `LIQUID_GLASS_MOBILE_NAV_STYLE`: absolute, top 50%, left 50%, width 100%, `translate(-50%, -50%)`. When perf-lite, `navShell` renders directly without the wrapper.

**Items.** Five `Link`s, in this order (LiquidGlassMobileBottomNav.tsx:36-67):

| # | Label (verbatim) | Route | Icon (lucide) | Active when |
|---|---|---|---|---|
| 1 | `Zakłady` | `/` | `House` | `pathname === "/"` |
| 2 | `Social` | `/social` | `MessageCircle` | `startsWith("/social")` |
| 3 | `Gry` | `/casino` | `Gamepad2` | `=== "/casino"` or `startsWith("/casino/")` |
| 4 | `Rankingi` | `/rankings` | `Trophy` | `startsWith("/rankings")` |
| 5 | `Profil` | `/profile` | `UserRound` | `=== "/profile"` or `startsWith("/profile/")` |

Per item: `aria-label={label}`, `aria-current="page"` when active, `data-active="true"` when active, `tabIndex={-1}` when the nav is hidden. Item class `LIQUID_GLASS_MOBILE_NAV_ITEM_CLASS_NAME`: `relative z-10 flex h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-[1.35rem] px-1 text-[12px] leading-none transition-[background-color,box-shadow,color,transform] duration-200`. Icon `h-5 w-5 shrink-0`, `strokeWidth` 2.4 when active, 2 when not. Label `w-full truncate text-center leading-[1.15]`, `font-bold` when active. Label text is wrapped in an inner span that takes the pill class (light theme only).

**Tone.** `tone = pathname.startsWith("/casino") ? "casino" : "default"`. Tone only changes the light theme (dark ignores it).

**Colour tokens (literal).**

| Part | Dark | Casino (light theme only) | Light (default) |
|---|---|---|---|
| Shell bg | `#170811` at 88% (`bg-[#170811]/[0.88]`) | `bg-zinc-950/[0.84]` | `bg-white/[0.86]` |
| Shell shadow | `0_-12px_42px_rgba(80,0,28,0.48), inset_0_1px_0_rgba(255,255,255,0.16)` | `0_-16px_46px_rgba(0,0,0,0.44), inset_0_1px_0_rgba(255,255,255,0.13)` | `0_-12px_38px_rgba(15,23,42,0.16), 0_-4px_24px_rgba(230,0,26,0.08), inset_0_1px_0_rgba(255,255,255,0.95)` |
| Border and ring | `border-white/[0.12] ring-[#ff335f]/[0.12]` | `border-white/[0.12] ring-white/[0.10]` | `border-white/[0.78] ring-[#e6001a]/[0.16]` |
| Active item | `text-[#ffe14a] bg-white/[0.11]` + shadow `0_0_0_1px rgba(255,255,255,0.16), 0_10px_24px rgba(255,225,74,0.18), inset 0 1px 0 rgba(255,255,255,0.28)` | `text-[#ffe14a] bg-white/[0.13]` + shadow with `rgba(255,225,74,0.16)` and inset `0.24` | `text-[#c90018] bg-[#c90018]/[0.10]` + shadow `0_0_0_1px rgba(201,0,24,0.12), 0_4px_12px rgba(201,0,24,0.10), inset 0 1px 0 rgba(255,255,255,0.92)` |
| Inactive item | `font-medium text-white/[0.68] hover:text-white` | same as dark | `font-medium text-slate-950/[0.82] hover:text-slate-950` |
| Label pill (light only) | none | none | active `inline-block max-w-full truncate rounded-full bg-[#fae6e8]/[0.4] px-1 py-0.5 shadow-none [text-shadow:none]`; inactive same with `bg-white/[0.4]` |

Under perf-lite, the shell loses `backdrop-blur-2xl` and the LiquidGlass wrapper, and keeps the same tinted background and shadows.

**Hide on scroll.** `mobileBottomNavHidden` (Navbar prop) is driven by pages with scroll containers. When hidden, the nav moves down and fades out (S8 motion). It is hidden by:
- Home: `BetList` scroll container, `data-testid="bet-list-scroll-container"` (BetList.tsx:155-214), through `AuthenticatedHome` `mobileChromeHidden` state (AuthenticatedHome.tsx:35, 57-59).
- Social: `social-scroll-container` (SocialPage.tsx:530-560, `data-hidden` at 560).
- Rankings: `rankings-scroll-container` (RankingsPage.tsx:153-169).

Other pages (casino, profile, replay, social item) pass no prop, so the nav stays visible there.

**States.** Visible (translate 0, opacity 1). Hidden (`translate-y-full`, opacity 0, links `tabIndex -1`). Absent (no profile, or /admin).

**Motion.** Container `transition-[transform,opacity] duration-200 ease-out`. Items `transition-[background-color,box-shadow,color,transform] duration-200`. Tailwind default easing (not overridden).

**Sound and haptics.** None.

### S9. Scroll chrome and body class

- `getNextScrollChromeState` (src/lib/scroll-chrome.ts). Constants: `TOP_RESET_PX` 32, `HIDE_TRAVEL_PX` 56, `SHOW_TRAVEL_PX` 44, `BOTTOM_LOCK_PX` 72, `NOISE_PX` 3.
  - `scrollTop <= 32`: shown, travel reset to 0.
  - `|delta| <= 3`: state kept.
  - Within 72 px of bottom while scrolling up: state kept, travel 0.
  - Otherwise travel accumulates in one direction. Hides when travel >= 56. Shows again when hidden, not near bottom, and travel <= -44.
- Body class `mobile-bottom-nav-hidden` (Navbar.tsx:97-106). Added when `!showMobileBottomNav || mobileBottomNavHidden`. Removed on cleanup. CSS (`index.css:238`) sets `--mobile-floating-stack-offset: 0rem` under it. Consumers of that variable are not mapped by this spec.

### S10. Theme toggle

Two places: desktop dropdown (S4) and mobile footer (S5). Both call `toggleTheme` from ThemeContext.
- Theme is `dark` or `light` only. `.light` class on `<html>`.
- Default for first-time visitors is a split: `index.html` pre-paint script applies dark (no `light` class) unless `localStorage["bsplic.theme"] === "light"`. ThemeContext `readStoredTheme()` returns `"light"` for any value other than `"dark"`, including unset. So first visit is dark pre-paint, then light after React mounts (see Open questions).
- Meta theme-color: dark `#090005`, light `#dc2626` (ThemeContext). `index.html` initial value `#0f0e16` until React mounts.

---

## Data contract

All calls sit in files named below. Navbar, NavbarMobileMenu, LiquidGlassMobileBottomNav, AppMobileBottomNav and liquidGlassMobileNavStyles make no direct Supabase, React Query or localStorage calls. Verified by grep.

### Supabase

| Call | Where | Input | Output used | Notes |
|---|---|---|---|---|
| `supabase.from('profiles').select('*').eq('id', userId).single()` | AuthContext.tsx:65 | `userId` | `profile` (all columns) | Runs on every sign-in and refresh. Error arrives in `.then` as `profileResult.data = null`. Thrown exceptions reach `.catch`. |
| `supabase.from('user_roles').select('role').eq('user_id', userId)` | AuthContext.tsx:66 | `userId` | `isAdmin` (`role === 'admin'`), `isModerator` (`role === 'moderator'`) | Runs in parallel with profiles through `Promise.all`. |
| `supabase.rpc('secure_daily_topup', { p_user_id: userId })` | NavbarTopupDialog.tsx:35 | `p_user_id` (must equal `auth.uid()`) | `numeric` (new balance). Dialog ignores it and calls `refreshProfile()`. | Only write from these surfaces. |
| `supabase.auth.signOut()` | AuthContext.tsx:190 | none | none | Followed by `clearProfileState()`. |
| `supabase.auth.onAuthStateChange(...)` | AuthContext.tsx:136 | session | `user`, `session` | Drives `applyAuthSession`. |
| `supabase.auth.getSession()` | AuthContext.tsx:149 | none | initial session | Bootstrap. A 6000 ms timeout (`AUTH_BOOTSTRAP_TIMEOUT_MS`, line 35) falls back to logged-out UI. |

`secure_daily_topup` (migration `20260703181500_harden_client_writable_surfaces.sql`, lines 3-49):
- `SECURITY DEFINER`, `search_path = public`, returns `NUMERIC`.
- Rejects when `auth.uid()` is null or differs from `p_user_id` (`Brak dostępu do doładowania`).
- Row lock: `SELECT last_topup_at ... FOR UPDATE`.
- Rejects when the profile is missing (`Nie znaleziono użytkownika`).
- Warsaw-day check: `v_today_pl := (NOW() AT TIME ZONE 'Europe/Warsaw')::DATE`. If `last_topup_at` is not null and `v_today_pl <= v_last_pl`, raises `Już doładowano dzisiaj. Wróć jutro!`.
- Update: `balance = ROUND(balance + 100, 2)`, `last_topup_at = NOW()`.
- `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated`; `GRANT EXECUTE ... TO authenticated`.
- Same migration revokes client `INSERT`/`UPDATE` on `profiles` and grants `UPDATE (avatar_url)` only.

### Realtime

- None opened by the navbar files.
- NotificationsBell (spec 15) opens channel `notifications-${userId}`: `postgres_changes` on `user_notifications` with filter `user_id=eq.${userId}` (NotificationsBell.tsx:142), removed in cleanup via `supabase.removeChannel` (line 168). It is mounted once per viewport-cluster, so the channel is re-created when `isDesktopNav` flips on first mount (see Edge cases).

### Polling

- None.

### React Query

- No query keys in these surfaces (grep-verified).
- `BootController.tsx:38-47`: when `userId` goes from set to null, calls `queryClient.clear()`. This is the only cache clear on sign-out. `AuthContext.signOut` does not clear the cache.
- `BootController.tsx:55-87`: signed-in preload (`warmSignedInAssets`, `prefetchPageData`, `loadAdminPage` for admin). Navbar components are not preloaded. `src/lib/boot/` has no reference to Navbar, NavbarMobileMenu or NavbarTopupDialog.

### localStorage and storage

| Key | Shape | Written by | Read by |
|---|---|---|---|
| `bsplic.theme` | `"dark"` or `"light"` string | ThemeContext effect (lines 49-57) | ThemeContext `readStoredTheme()`; `index.html` pre-paint script |
| `bsplic.darkPalette` | legacy | none | ThemeContext removes it on mount (legacy key) |

No other storage is touched by these surfaces. Bell, transfer and profile may use storage in their own specs.

### URL and DOM

- Query param `?wallet=history` (read at Navbar.tsx:108-114; removed on close at 121-136).
- `<html>` class `light` (ThemeContext `applyTheme`), `standalone` (index.html pre-paint, when `navigator.standalone === true`).
- `<body>` class `mobile-bottom-nav-hidden` (Navbar.tsx:97-106).
- `<meta name="theme-color">` content (ThemeContext).
- `html.perf-lite` (`src/lib/perf-mode.ts`, sampled 1000 ms after boot splash hides and on `visibilitychange` with a 400 ms delay; lite when the 25th-percentile frame gap exceeds 26 ms or fewer than 12 samples).

---

## Business rules

1. **One top-up per Warsaw calendar day, +100 zł.** Client rule: `canClaimTopup(last_topup_at)` returns true when `last_topup_at` is null, otherwise when the Warsaw date string of now is greater than the Warsaw date string of the last top-up (`polishDay.ts`). Server rule (`secure_daily_topup`) is the same, and is authoritative. Both use `Europe/Warsaw`, not UTC.
2. **Top-up amount.** Fixed 100 zł. Balance is `ROUND(balance + 100, 2)`. No user input.
3. **Entry gates.**
   - Chip (both variants): requires `profile`.
   - Desktop avatar dropdown: requires `profile`.
   - Bottom nav: requires `profile` AND path not starting with `/admin`.
   - Mobile menu account card: requires `profile`.
   - Mobile menu: always openable.
   - Bell: no profile gate (renders logged out).
   - `Wyloguj` (desktop) and `Wyloguj się` (mobile): no profile gate.
4. **Admin and moderator links.**
   - Desktop: `Admin` (ShieldCheck, `isAdmin`) and `Propozycje` (ShieldCheck, moderator not admin). Both go to `/admin`.
   - Mobile sheet: `Admin` only, when `isAdmin`.
   - Bottom nav: neither.
5. **Propose entry.** Only in the mobile menu footer, and only when `onOpenProposeModal` is passed, which only home does (AuthenticatedHome.tsx:57-59). Desktop has no propose entry.
6. **Balance display.** `Number(balance).toFixed(2)` followed by ` zł`. No thousands separator.
7. **Admin bottom nav suppression.** `/admin` paths never show the floating nav (AdminLayout has its own bottom nav, out of scope).
8. **Deep link is one-shot.** `?wallet=history` opens the transfer dialog only when `profile` is loaded. Closing the dialog removes the param.

---

## Edge cases and gotchas

1. **Profile null while logged in.** The `profiles` query returns `{ error }` (no throw). `.then` sets `profile = null` and roles still apply. Chip, bottom nav, dropdown and account card disappear. Nothing is logged or toasted. The bell and menu button still render. Only thrown exceptions reach `.catch`, which logs `Profile fetch error:`.
2. **Logged out.** Bell and menu button show at both breakpoints. The Sheet still shows nav links, the theme toggle and `Wyloguj się`. Logout while logged out is a no-op in effect (`signOut` clears nothing).
3. **Desktop first render.** `isDesktopNav` starts `false` (Navbar.tsx:61-66) and is set from `matchMedia` in an effect. On desktop, the mobile cluster and a mobile bell mount for one render, then swap for the desktop bell. That creates and removes the `notifications-${userId}` channel once on each load. The chip is not a problem (its mobile variant is also gated on `!isDesktopNav`).
4. **Mobile menu top-up.** `Doładuj 100 zł` closes the Sheet by unmounting it at once (no exit animation), then opens the top-up dialog. The dialog is lazy, so on first use there may be a short blank before it shows (`Suspense fallback={null}`). This conflicts with the user's stated dislike of loading flashes. When capped, the button shows `Już doładowano dzisiaj. Wróć jutro!` as a toast and the Sheet stays open.
5. **Lazy chunk for the Sheet.** `NavbarMobileMenu` is not in `src/lib/boot/route-modules.ts`, so its first open can be delayed by a chunk load. Same for `NavbarTopupDialog` and `MoneyTransferDialog`.
6. **Top-up button is never disabled.** The dialog stays enabled while capped. The UI never opens it when capped (chip and menu gate it), so this is only reachable if the profile changes while the dialog is open.
7. **Top-up error text.** RPC errors show the raw `error.message` from Postgres (for example `Już doładowano dzisiaj. Wróć jutro!`). On error the dialog stays open. On success it awaits `refreshProfile()` (which refetches the profile, not a local patch), toasts, then closes.
8. **Two error strings for the same thing.** `Błąd doławania` (typo, RPC error fallback) and `Błąd doładowania` (catch). Keep the copy consistent in the Expo port unless the user decides otherwise.
9. **Double close on logout in the mobile menu.** `handleSignOut` closes the Sheet, and the `SheetClose` wrapper closes it again. Harmless.
10. **Sign-out does not navigate.** Neither `signOut` in AuthContext nor the menu navigates. Routing away from protected pages is handled elsewhere (spec 03). React Query is cleared by BootController on userId set to null, not in `signOut`.
11. **Hidden bottom nav is still in the accessibility tree.** `translate-y-full opacity-0` plus `tabIndex -1` removes links from keyboard focus only. There is no `aria-hidden` or `inert`, so screen readers can still reach it. The inner container keeps `pointer-events-auto`, but it sits below the viewport while hidden, so taps do not reach it.
12. **Hide-on-scroll is per page.** Only home, social and rankings pass `mobileBottomNavHidden`. Other pages never hide the nav.
13. **Route matching is prefix-based without a slash boundary for `Rankingi` and `Social` in the bottom nav** (`startsWith("/rankings")`, `startsWith("/social")`). `/socialfoo` would match. Top-bar `isActivePath` does use a slash boundary.
14. **Label inconsistency.** Bottom nav says `Gry` for `/casino`. Top bar and mobile sheet say `Kasyno`.
15. **Logout label inconsistency.** Desktop dropdown says `Wyloguj`. Mobile footer says `Wyloguj się`.
16. **Propozycje only on desktop.** Moderators see `Propozycje` in the top bar only, and nothing on mobile.
17. **Gradient tokens.** `.gradient-primary` is hard-coded to hue 355 in both themes, while `--primary` in dark is 342. The chip circle and top-up button use `gradient-primary`, so they will not match a dark-theme token rebuild unless the constant is copied.
18. **Sheet close label.** The shadcn sr-only `Close` is English. Other copy is Polish.
19. **Dropdown duration unverified.** `dropdown-menu.tsx` uses zoom animations, but the duration is the tailwindcss-animate default and was not measured.
20. **Sheet exit animation.** Probably skipped by conditional mounting (Navbar.tsx:351). Verify in browser before copying.
21. **Safe-area on the Sheet.** The shadcn close X sits at `top-4 right-4` on a sheet that also has `safe-area-top`. In standalone iOS it may land under the status bar or the notch. Verify on device.
22. **Duplicate navbar in profile.** `ProfilePage` returns one of two trees (loading branch line 241, main branch line 253), so only one Navbar mounts.
23. **Liquid glass on Android and low-end devices.** The `LiquidGlass` wrapper is a WebGL/SVG-style effect with no native equivalent. perf-lite removes it, and that is the closest existing fallback.
24. **Dead code not to port.** `NavLink.tsx`, and four helpers in `mobileBottomNavStyles.ts` (`getMobileBottomNavUnderlayClassName`, `getMobileBottomNavSurfaceClassName`, `getMobileBottomNavActiveClassName`, `getMobileBottomNavInactiveClassName`). Only the `MobileBottomNavTone` type is used.
25. **Balance re-render.** `updateProfileBalance` patches the local profile without refetch. The top-up path does not use it; it uses `refreshProfile`.

### Expo mapping notes (not normative, for the rebuild)

- `Link` / `useNavigate` / `useLocation` map to the app's router. `?wallet=history` maps to a route param or a deep link into the same state.
- `env(safe-area-inset-*)` maps to safe-area insets from the platform library. `100vw` and `86vw` map to `useWindowDimensions`.
- `matchMedia(min-width: 1024px)` maps to `useWindowDimensions().width >= 1024`, computed on the first render (avoids the one-render swap in Edge case 3).
- `document.body` class and `<html>` class map to ThemeContext and a shared hidden-chrome value.
- `localStorage` maps to the app's async storage. Keep the key `bsplic.theme` only if web and native must share a value. Native needs no legacy key.
- Radix Sheet, Dialog, DropdownMenu map to any maintained RN modal, sheet or menu primitive. Pick one that supports a right-edge sheet and a centred dialog.
- Liquid glass maps to a tinted view with optional blur (`expo-blur` or equivalent). Choose per open question 7.

---

## Open questions

1. Should moderators see `Propozycje` (or `Admin`) on mobile? Today only desktop shows it.
2. First visit theme: `index.html` pre-paint gives dark, then ThemeContext switches to light after mount, because `readStoredTheme()` returns `light` for unset storage. Which default is intended? (Team memory says dark by default.)
3. Should the Sheet and dialogs keep exit animations? Conditional mounting currently skips them. Is `duration-100` on the Sheet intentional?
4. `Gry` (bottom nav) versus `Kasyno` (top bar and menu): which label is canonical?
5. Should `Wyloguj się` show when logged out? Today it does.
6. Should the hidden bottom nav get `aria-hidden` or `inert` while hidden?
7. Should native replicate the liquid-glass effect, or ship the plain perf-lite shell only?
8. Should the logged-out bell be hidden? Today it shows at both breakpoints.
9. Should the top-up button be disabled when capped, as a defensive measure?
10. Should `NavbarMobileMenu` and `NavbarTopupDialog` be added to `src/lib/boot/route-modules.ts` so the first open is not delayed?
