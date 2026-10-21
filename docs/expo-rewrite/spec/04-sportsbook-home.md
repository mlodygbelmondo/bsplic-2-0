# 04 - Sportsbook home (authenticated `/`)

Source of truth for the rebuild: the Vite app at this commit. Every behavior below was read from source; file:line references point at the web app. The target is a phone-only Expo app at 390 px wide. Desktop (`lg:` and up) parts are listed only as one-liners in section 3.

## 0. Scope and assumptions

- Route: `/` when signed in. Logged-out `/` is out of scope.
- Viewport: 390 px. Tailwind `sm:` (640 px) and `lg:` (1024 px) rules do not apply. Where a class has a base and a `sm:` variant, the base value is the phone value.
- Out of scope (own specs): the Navbar and its bottom nav (`src/components/Navbar.tsx`), the mobile menu entry point for proposing (`src/components/NavbarMobileMenu.tsx`), the coupon drawer (`src/components/CouponDrawer.tsx`, `src/contexts/CouponContext.tsx`), the daily jackpot card (`src/features/jackpot/`).
- Entry points: `src/features/home/components/AuthenticatedHome.tsx` (page root), `src/features/home/layout/HomeShell.tsx` (layout), `src/components/BetList.tsx` (list, toolbar, filters, load more), `src/components/BetCard.tsx` (card), `src/components/ProposeBetModal.tsx` (propose dialog).
- Desktop-only parts, one line each: the 250 px category sidebar (`src/components/CategorySidebar.tsx:31`, hidden below `lg`) and the desktop toolbar with the inline "Aktywne" toggle, tooltips and the "Zaproponuj zakład" button (`src/components/BetList.tsx:278-336`, `hidden lg:block` / `hidden lg:inline-flex`).

## 1. Screen composition (phone)

Top to bottom inside the page root (`AuthenticatedHome.tsx:56`, class `h-safe-screen bg-background overflow-hidden flex flex-col`):

1. Navbar (out of scope). It receives `mobileBottomNavHidden` from the list's scroll chrome state.
2. Main column (`HomeShell.tsx:30-63`, `px-3 pt-2 pb-0`, `flex-1 min-h-0`). Phone has no sidebar. The sidebar is `hidden lg:block`.
   - Sticky mobile toolbar (`BetList.tsx:345`, `sticky top-0 mb-2.5 lg:hidden`). Two pill triggers side by side: sort (left) and category (right). It slides off-screen when scroll chrome hides it (`transition-transform duration-200 ease-out`).
   - Filter panel (absolute, under the toolbar, `top-[calc(100%+8px)] z-30 max-h-[55dvh] overflow-y-auto`). Only one panel is open at a time. Tapping outside closes it (pointerdown and mousedown listeners, `BetList.tsx:253-261`).
   - Scroll container (`BetList.tsx:272-276`, `data-testid="bet-list-scroll-container"`, `flex-1 min-h-0 overflow-y-auto overscroll-contain pb-[calc(5.75rem+env(safe-area-inset-bottom))]`). Its `key` is `${sort}:${selectedCategory ?? "all"}:${activeOnly ? "active" : "all-states"}`, so changing any criterion remounts it.
     - Top banner slot (`BetList.tsx` ~506). The jackpot card is rendered here; out of scope.
     - Live block (`BetList.tsx:508-520`): bets with `is_live`, sorted by the current sort. At 390 px it is one column.
     - Regular block (`BetList.tsx:531-548`, `space-y-2.5 mb-8`): non-live bets, sorted by the current sort.
     - Empty state, or load-more button, or nothing.
3. Propose dialog (`ProposeBetModal.tsx`), opened from the Navbar menu. On phone it is the only entry point on this screen (the desktop CTA is `hidden lg:inline-flex`).

Boot: `SectionLoader` (`src/components/SectionLoader.tsx`) calls `useBootHold()`, so the single boot splash stays up until the first bets page is loaded (`BetList.tsx:267-270`).

## 2. Page state and persistence

| Key (localStorage) | Owner | Default | Written at | Notes |
|---|---|---|---|---|
| `bsplic.home.category` | `AuthenticatedHome.tsx:8` | `null` (all) | `AuthenticatedHome.tsx:44`, `:51` | Stores a category id. Removed when set to `null`. |
| `bsplic.home.sort` | `BetList.tsx:51` | `newest` | `BetList.tsx:168` | One of `newest`, `popular`, `ending_soon`. |
| `bsplic.home.activeOnly` | `BetList.tsx:52` | on | `BetList.tsx:197` | Only the literal string `"false"` turns it off (`BetList.tsx:68`). |

All storage calls are wrapped in try/catch. If storage is unavailable, the value is simply not remembered.

Not persisted: panel open state, `actionsHidden` (scroll chrome, `BetList.tsx:157`), `mobileChromeHidden` (`AuthenticatedHome.tsx:35`), `proposeOpen`.

In-memory state in `useBets` (`src/features/home/hooks/useBets.ts`): `bets`, `loading` (first page), `loadingMore`, `hasMore`, a pending realtime payload queue, a flush timer.

Categories are read from React Query under `["home", "categories"]` (`useCategories.ts:9`). Bets are not in the query cache. Each change of sort, category or Aktywne reloads the first page and shows the loader.

## 3. Surfaces

### 3.1 Category filter (phone)

- Trigger in the toolbar (`BetList.tsx` ~454): label `{emoji} {name}` for the selected category, or `🌐 Wszystkie` for all. Pill, `h-11 w-full rounded-full`, with a chevron.
- Panel (`BetList.tsx` ~479-483): first row `🌐 Wszystkie` (calls `onSelectCategory(null)`, closes the panel). Then one button per category, keyed by `cat.id`, in `sort_order` order. Selecting closes the panel.
- No search field on phone. The search field is desktop-only (`CategorySidebar.tsx:41`).
- Desktop one-liner: 250 px aside, heading `Kategorie`, search `Szukaj kategorii...`, `⭐ Wszystkie` row, category list, empty text `Brak kategorii dla tej frazy`, search clear button labelled `Wyczyść wyszukiwanie kategorii`.
- Copy inconsistency to keep or fix on purpose: desktop uses `⭐` for "Wszystkie" (`CategorySidebar.tsx:65`), phone uses `🌐`.

### 3.2 Sort and Aktywne (phone)

- Sort trigger (`BetList.tsx` ~373-379): pill, `h-11 w-full rounded-full`, `aria-expanded`. Label is the selected option's label, fallback `Sortowanie`. A green dot (`bg-success`) shows when Aktywne is on.
- Sort panel options (`BetList.tsx:46-48`): `Najnowsze` (newest), `Popularne` (popular), `Kończące się` (ending_soon). Tapping one sets the sort and closes the panel.
- Aktywne toggle inside the sort panel (`BetList.tsx` ~432): full-width row labelled `Aktywne`, with `aria-pressed`. Tapping it flips the value and does not close the panel.
- Desktop one-liner: the toolbar at `BetList.tsx:278-336` shows the same Aktywne switch inline, with tooltips `Pokazywane są tylko zakłady, które można obstawić` (on) and `Pokazywane są też zakłady w trakcie rozliczania` (off), and the `Zaproponuj zakład` button (Lightbulb icon).

Aktywne semantics (`useBets` is called with `includeInProgress = !activeOnly`):
- On (default): only bets open for placement (see section 5.2).
- Off: all bets with `is_active = true`, including bets whose `ends_at` has passed (in progress, awaiting settlement).

### 3.3 List states

| State | Condition | Rendering |
|---|---|---|
| Loading | `loading` (first page in flight) | `SectionLoader` with label `Wczytywanie zakładów...`, `flex-1`. Holds the boot splash. |
| Empty | no live bets and no regular bets, not loading | Title `Brak dostępnych zakładów`, subtitle `Wróć później lub zmień kategorię` (`BetList.tsx:532-538`). |
| Populated | at least one bet | Live block, regular block, then load-more block if `hasMore`. |
| Load more idle | `hasMore && !loadingMore` | Full-width button, `rounded-lg border border-border px-3 py-2 text-sm font-medium`, text `Pokaż więcej`. |
| Load more busy | `loadingMore` | Same button, disabled, text `Ładowanie...`. |

An error while loading a page is not shown (see section 7).

Pagination (`useBets.ts:167-200`, `:281-295`):
- Page size 80 (`src/features/home/api/bets.ts:10`).
- Each request asks for 81 rows. `hasMore = data.length === 81`. The 81st row is dropped from the page.
- Load more: the offset is `betsRef.current.length` (all loaded bets, live and regular). Rows are appended.
- An IntersectionObserver on the load-more button (`BetList.tsx:217-235`, `rootMargin: "400px 0px"`, deps `[hasMore, loadMore, loading]`) calls `loadMore` before the button is on screen. The button stays as a manual fallback.

Animations: each card gets `bet-card-enter` (360 ms, 45 ms stagger, index capped at 8). The live block uses `Math.min(index, 8)`, and the regular block uses `Math.min(index + liveBets.length, 8)` (`BetList.tsx:515`, `:548`).

### 3.4 Bet card (`BetCard.tsx`)

Header (`BetCard.tsx` ~120-155):
- Category: emoji and name, `<span>{category.emoji}</span> {category.name}` (line 123).
- `BSPLBOOST` badge with Sparkles icon when `is_bsplicboost` (line 128).
- `LIVE` badge with pulsing dot when `is_live` (lines 138-150). The card also gets `bet-card-live`.
- Users icon and `bet_count` (line 154).

Body (`BetCard.tsx` ~162-185):
- Title, `font-bold text-base sm:text-lg`.
- Status line `W trakcie` with a pulsing dot, when `isInProgress` (line 168).
- Date line `formatBetDate(bet.ends_at)`, `text-[12px] text-muted-foreground font-medium mt-1` (line 172-175).
- Countdown suffix `· kończy się {formatTimeRemaining(remainingMs)}` (line 183), only when `endsSoon`. Red (`red-500`) when remaining is at most 1 h, amber (`amber-600`) otherwise.

Probability bar (`BetCard.tsx` ~263-282): `flex mt-2 h-[3px] rounded-full overflow-hidden gap-0.5`. Segment i has width `probability * 100%`, where probability = (1/odds_i) / Σ(1/odds_j) over the card's options. Colors cycle by index: `bg-primary`, `bg-muted-foreground/30`, `bg-success`.

Option grid (`BetCard.tsx:193-203`), by `bet_type` and option count:
- `multi` with 4 or 5 options: 2 columns. If the count is odd, the last option is centered (`col-span-2 justify-self-center w-[48%]`).
- `multi` with 6 or more options: 3 columns.
- Otherwise by count: 1 option `grid-cols-1`, 3 options `grid-cols-3`, 2 options `grid-cols-2`, default `grid-cols-2 sm:grid-cols-3` (phone: 2 columns).

Option chip (`BetCard.tsx:207-234`):
- Label: option name in `truncate`, then odds `toFixed(2)`.
- States, in order: selected (`odds-selected odds-chip-selected shadow-md`), locked (`odds-locked cursor-not-allowed`, button `disabled`), default (`odds-yellow hover:brightness-105`).
- Locked means `isExpired || !bet.is_active`.
- Accessible labels (`BetCard.tsx:211-215`): `{title}: {name} zablokowane, kurs {odds}` / `{title}: {name} wybrane, kurs {odds}` / `{title}: wybierz {name}, kurs {odds}`.

Selection (`BetCard.tsx:88-93`):
- Selection is per bet: `selectedInCoupon = items.find(i => i.bet.id === bet.id)`.
- Tapping the selected option removes the bet from the coupon (silent).
- Tapping any other option calls `addItem({ bet, selectedOption, odds })`. `addItem` replaces the existing item for the same bet and toasts `Dodano do kuponu` (`CouponContext.tsx:70-78`).

Clock (`BetCard.tsx:41-63`):
- `now` is captured once with `useState(() => Date.now())`.
- `isExpired = endTimestamp <= now` (false if the date is invalid).
- `endsSoon`: valid date, `is_active`, and `0 < remaining <= 24 h`. While `endsSoon`, `now` refreshes every 60 s. Otherwise no interval runs.
- `isInProgress = isExpired && winning_option === null`.

Time formats (`BetCard.tsx:15-21`, `formatTimeRemaining`): under 1 min `za chwilę`; under 60 min `za {N} min`; 60 min or more `za {H} godz. {M} min`, or `za {H} godz.` when M is 0.

Date format (`BetCard.tsx:24-36`, `formatBetDate`): `Intl.DateTimeFormat("pl-PL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })`. Invalid date gives `--.-- --:--`. Verify the exact separators on Hermes (section 9).

### 3.5 Scroll chrome (hide on scroll)

Driven by `getNextScrollChromeState` in `src/lib/scroll-chrome.ts`, applied in `BetList.handleListScroll` on the scroll container.

Constants: `TOP_RESET_PX = 32`, `HIDE_TRAVEL_PX = 56`, `SHOW_TRAVEL_PX = 44`, `BOTTOM_LOCK_PX = 72`, `NOISE_PX = 3`.

Rules:
- `scrollTop <= 32`: visible, travel reset.
- `|delta| <= 3`: noise. Only the last position is updated.
- Within 72 px of the bottom with an upward move: the hidden state does not change and travel resets.
- Travel accumulates in one direction. A reversal resets it.
- Hides when visible and downward travel reaches 56.
- Shows when hidden, not near the bottom, and upward travel reaches 44.
- Reset: any change of sort, category or Aktywne sets the chrome back to visible and clears the stored scroll position (`BetList.tsx:206-209`).

Effects: the mobile toolbar slides off-screen. The state is reported to the page via `onScrollChromeHiddenChange` (`BetList.tsx:213`), which sets `mobileChromeHidden`, which hides the Navbar bottom nav (`AuthenticatedHome.tsx:59`).

### 3.6 Propose bet dialog (`ProposeBetModal.tsx`)

Entry: Navbar mobile menu (out of scope). Dialog title `Zaproponuj zakład`. Container `w-[calc(100vw-2rem)] max-w-lg max-h-[calc(var(--app-viewport-height,100svh)-2rem)] overflow-y-auto rounded-lg p-4`.

Fields (in order):
- `Tytuł`, required. Placeholder `np. Kto wygra El Clasico?`. Not trimmed on submit.
- `Kategoria`, optional. Select with placeholder `Wybierz`. Items `{emoji} {name}`, from the same category list.
- `Typ`, Select. Items: `Single` (single), `1/2` (12), `1X2` (1x2), `Multi` (multi). Default `12`.
- `Data zakończenia`, `datetime-local`, required. Default: tomorrow at 23:59 local time.
- `Opcje`: rows of name input (placeholder `Opcja {n}`) and odds input (`type=number`, `step=0.01`, `min=1`, placeholder `Kurs`). Remove button (destructive icon) only when the type is not fixed and there are more than 2 rows. `Dodaj opcję` (Plus icon) only when the type is not fixed.

Option counts: `single` 1, `12` 2, `1x2` 3 (fixed). `multi` starts with 2 blank rows, any count from 2 up.

Default option rows by type (`OPTION_DEFAULTS`): `single` `["1"]`, `12` `["1","2"]`, `1x2` `["1","X","2"]`, `multi` `["",""]`.

Type change (`ProposeBetModal.tsx:79-98`):
- Fixed type: each row keeps the previous name at the same index, or takes the type default. Odds keep the previous value, or default to `"3"` for 1x2 index 1, else `"2"`.
- `multi`: previous rows are kept if there are at least 2, else two blank rows with odds `"2"`.

Submit (`handleSubmit`, `ProposeBetModal.tsx:100-168`), checks in order, each shows an error toast and stops:
1. Any name empty after trim: `Uzupełnij etykiety wszystkich opcji`.
2. Count below minimum (1 for `single`, else 2): `Dodaj co najmniej 1 opcję` or `Dodaj co najmniej 2 opcje`.
3. Any odds empty, not a finite number, or <= 0: `Podaj poprawny kurs dla opcji {n}` (n is 1-based).

Then `createBetProposal` (section 5.4). Loading state shows `Wysyłanie...` on the submit button, otherwise `Wyślij propozycję`. On success: toast `📋 Zakład zaproponowany — czeka na akceptację admina`, close the dialog, reset the form, `betType` back to `12`. On failure: toast with the error message, or `Nie udało się wysłać propozycji` when there is none.

Not validated: title length or trim, whether `ends_at` is in the future, whether `category` is set (optional), the odds upper bound.

### 3.7 Coupon interaction on the card

Covered in 3.4 (selection and toast). The coupon drawer itself is out of scope.

## 4. Copy (Polish, verbatim)

| Where | Text |
|---|---|
| Sort options | `Najnowsze`, `Popularne`, `Kończące się` |
| Sort trigger fallback | `Sortowanie` |
| Aktywne toggle | `Aktywne` |
| Category all | `🌐 Wszystkie` (phone), `⭐ Wszystkie` (desktop sidebar) |
| Category trigger fallback | `{emoji} {name}` |
| Desktop tooltip, Aktywne on | `Pokazywane są tylko zakłady, które można obstawić` |
| Desktop tooltip, Aktywne off | `Pokazywane są też zakłady w trakcie rozliczania` |
| Desktop CTA | `Zaproponuj zakład` |
| Loading | `Wczytywanie zakładów...` |
| Empty title | `Brak dostępnych zakładów` |
| Empty subtitle | `Wróć później lub zmień kategorię` |
| Load more | `Pokaż więcej` / `Ładowanie...` |
| Card badges | `BSPLBOOST`, `LIVE` |
| Card status | `W trakcie` |
| Card countdown | `· kończy się {time}` |
| Countdown texts | `za chwilę`, `za {N} min`, `za {H} godz. {M} min`, `za {H} godz.` |
| Invalid date | `--.-- --:--` |
| Desktop search | `Szukaj kategorii...`, `Wyczyść wyszukiwanie kategorii`, `Brak kategorii dla tej frazy`, `Kategorie` |
| Propose title | `Zaproponuj zakład` |
| Propose fields | `Tytuł`, `Kategoria`, `Typ`, `Data zakończenia`, `Opcje` |
| Propose placeholders | `np. Kto wygra El Clasico?`, `Wybierz`, `Opcja {n}`, `Kurs` |
| Propose type items | `Single`, `1/2`, `1X2`, `Multi` |
| Propose buttons | `Dodaj opcję`, `Wyślij propozycję`, `Wysyłanie...` |
| Propose errors | `Uzupełnij etykiety wszystkich opcji`, `Dodaj co najmniej 1 opcję`, `Dodaj co najmniej 2 opcje`, `Podaj poprawny kurs dla opcji {n}`, `Nie udało się wysłać propozycji` |
| Propose success | `📋 Zakład zaproponowany — czeka na akceptację admina` |
| Coupon toast | `Dodano do kuponu` |

Dynamic text in the card aria labels is listed in 3.4.

## 5. Data contracts

### 5.1 Bets list

Client: `fetchActiveBets` (`src/features/home/api/bets.ts:12-45`).

```
from("bets").select("*").eq("is_active", true)
  [if !includeInProgress] .gt("ends_at", <now as ISO>)
  [if category]           .eq("category_id", <id>)
  order by the sort mode (below)
  .range(offset, offset + limit - 1)
```

`limit` is 81 (80 + 1) on every call. The first page uses `offset = 0`. Load more uses `offset = number of bets currently loaded`.

Server order by mode:
- `newest`: `created_at desc`.
- `popular`: `bet_count desc`, then `created_at desc`.
- `ending_soon`: `ends_at asc`, then `created_at desc`.

The client re-sorts the loaded list with the same rules (`src/features/home/hooks/sortBets.ts`). Invalid timestamps sort last (+Infinity). Tie-breaks across page boundaries can differ between server and client.

Row type: `Bet` (`src/types/database.ts`): `id`, `title`, `category_id`, `bet_type` (`'1x2' | '12' | 'multi' | 'single'`), `options: BetOption[]` (`{ name, odds }`), `ends_at`, `is_live`, `is_bsplicboost?`, `is_active`, `winning_option: string | null`, `bet_count`, `created_at`, `category?`.

Also exported in `bets.ts`: `fetchBetsByIds` (not part of the home list path).

### 5.2 Bets realtime

`subscribeToBetsChanges` (`bets.ts`): channel `bets-realtime`, `postgres_changes` `{ event: "*", schema: "public", table: "bets" }`, no filter. Cleanup calls `supabase.removeChannel`.

Client rules (`useBets.ts:32-141`, `applyBetsRealtimePayloads`):
- Visible (default Aktywne on): `is_active` and `ends_at` parses to a finite time later than now, and matches the selected category if one is set.
- Visible (Aktywne off): `is_active`, and matches the category if one is set.
- INSERT: add if visible (ignored if the row has no id).
- UPDATE: if the new row is visible, replace or add it. Otherwise remove the old id.
- DELETE: remove the old id.

Batching: payloads are queued and flushed once per 150 ms (`REALTIME_BATCH_MS`) in a single state update. The timer and the subscription are cleaned up on unmount. The subscription is opened once on mount (deps `[]`) and is not re-keyed by category or sort.

Visibility is evaluated against the criteria in `criteriaRef`, which is updated on each criteria change.

### 5.3 Categories

`fetchCategories` (`src/features/home/api/categories.ts`): `from("categories").select("*").order("sort_order")`.

Realtime: channel `categories-changes`, `{ event: "*", schema: "public", table: "categories" }`, cleanup via `removeChannel`. Any event invalidates `["home", "categories"]` (`useCategories.ts:18-24`).

Row type: `Category` (`src/types/database.ts`): `id`, `name`, `emoji`, `color`, `sort_order`, `created_at`. `categoryMap` is `Record<id, Category>`, memoized.

No `staleTime` is set in the hook.

### 5.4 Propose a bet (insert)

`createBetProposal` (`src/features/home/api/betProposals.ts`): insert into `bet_proposals` with:
- `user_id` (signed-in user)
- `title` (raw, not trimmed by the API)
- `category_id` (from the optional Select)
- `bet_type` (`single` | `12` | `1x2` | `multi`)
- `options` (JSON array of `{ name, odds }`, names trimmed, odds numeric)
- `ends_at` = `new Date(endsAt).toISOString()`

Errors: `error.message` is rethrown as `new Error(message)`.

## 6. Business rules

1. Visibility: a bet shows on the home list only if it is active and, unless Aktywne is off, still open (`ends_at` after now). Category filter applies on top.
2. Category selection is kept in local storage. If the stored id is not in the loaded category list (after categories load), it is cleared silently and the page shows all categories (`AuthenticatedHome.tsx:47-53`).
3. Live bets (`is_live`) are shown first, in their own block, sorted by the current sort. Regular bets follow, sorted by the same sort. Both blocks use the loaded set only.
4. Page size 80; more pages load on demand (sentinel or button).
5. A card's options are locked (disabled) when the bet has expired on the card's clock, or `is_active` is false. Locked options cannot be selected.
6. Only one selection per bet can be in the coupon. Selecting another option on the same bet replaces it.
7. Countdown is shown only within 24 h of `ends_at` and only for active bets. It refreshes every 60 s while shown.
8. A bet with an expired `ends_at` and no `winning_option` shows `W trakcie` (in progress).
9. Odds probability is (1/odds) normalized over the card's options.
10. Scroll chrome hides the mobile toolbar and the Navbar bottom nav on downward scroll, and shows them again on upward scroll (thresholds in 3.5).
11. Propose: all names non-empty, minimum option count per type, positive finite odds for every option. Successful proposals are reviewed by an admin (toast says so); nothing is shown on the list.
12. The first home load holds the boot splash until its bets page is loaded (`SectionLoader`).

## 7. Edge cases and gotchas

Each item is current behavior. Keep it for parity unless section 8 says otherwise.

1. Expired bets can stay tappable. `isExpired` uses `now` captured on mount. The 60 s refresh runs only while `endsSoon` (within 24 h). A bet that was more than 24 h away when the card mounted and expires while on screen keeps enabled options until the card remounts (sort, category or Aktywne change, reload). Realtime payloads change the `bet` prop, not `now`. The click handler checks `isExpired`, so a tap on a stale enabled option is ignored; the option is still visually enabled.
2. Load more has no criteria check. `loadMore` uses the criteria at the time of the call and appends. If the user changes sort or category while a load-more request is in flight, the old page can be appended to the new list. The first-page effect is guarded by a `mounted` flag, but `loadMore` is not.
3. Appended pages are not de-duplicated by id. The offset is `loaded.length`, so realtime inserts, deletes or moves between pages can shift the window and produce duplicates or skips. Realtime also adds new rows at the end of the array before re-sorting.
4. Page errors are unhandled. A failed first page leaves `loading` false and the list empty, which shows the empty state (`Brak dostępnych zakładów`) with no toast and no retry. A failed load-more leaves `loadingMore` reset and the button usable.
5. The live block only shows live bets from loaded pages. A live bet on a later page is not shown until the user loads that page.
6. Sort and category changes show the loader every time, because bets are not cached. Categories are cached.
7. Duplicate option names are possible (propose type change, for example 12 to 1x2 produces names `["1","2","2"]`). Option keys and selection use the name, so both duplicates show as selected together.
8. Re-selecting a different option on the same bet shows `Dodano do kuponu` again (`addItem` always toasts). Tapping the selected option again removes it silently.
9. Odds input (`type=number`) on some devices yields a comma decimal that `Number()` parses as NaN. Such an option triggers `Podaj poprawny kurs dla opcji {n}`.
10. `new Date(endsAt).toISOString()` (inside `createBetProposal`, `betProposals.ts`) throws `RangeError` for an invalid date. The call sits inside the try block at `ProposeBetModal.tsx:141`, so it shows an error toast with the message `Invalid time value` and does not crash. Port the same behavior, or show the fallback text instead.
11. Title is sent untrimmed. Names are trimmed.
12. No check that `ends_at` is in the future on propose. A proposal can be submitted with a past date.
13. `BetCard` takes `category` as optional (`BetCard.tsx:9`). When a bet's category is not in `categoryMap`, the header omits the category label entirely (`BetCard.tsx:116`).
14. The bets realtime channel has no filter, so every client receives every bet change in the table. Batching limits re-renders, not traffic.
15. Settled bets: the Aktywne-off view depends on whether settled bets have `is_active = false` (open question 1).

## 8. Open questions

1. Do settled bets have `is_active = false`? The Aktywne-off view (all active bets) assumes they do. If not, settled bets show in that view.
2. Should the jackpot banner slot (`BetList` top banner) exist in the Expo home, or is it a separate screen?
3. Is the phone propose entry only the Navbar mobile menu, or should a phone button sit in the list toolbar?
4. For the expired-option staleness (gotcha 1): fix it (re-evaluate expiry on a timer for all cards), or keep for parity?
5. For load errors (gotcha 4): show a toast and a retry button, or keep the silent empty state?
6. Should odds input accept comma decimals (`1,85`)? The web app does not.
7. Should the propose form reject past `ends_at` values and untrimmed titles, or is it server-validated?
8. `🌐` vs `⭐` for "Wszystkie": keep the phone and desktop difference, or use one icon?

## 9. Expo porting notes

- IntersectionObserver sentinel (`rootMargin 400px`) maps to `FlatList` `onEndReached` with `onEndReachedThreshold` of about 400 px worth of rows. Keep the manual button as fallback.
- `localStorage` maps to AsyncStorage. Keep the same three keys and defaults, and the literal `"false"` check for Aktywne.
- Radix Select and Dialog (category, type, propose dialog) map to native bottom sheets or modals. The filter panel maps to a sheet opened from the toolbar, with outside-tap dismissal.
- `max-h-[55dvh]` and `100svh` map to a fraction of the window height. Do not use `dvh` or `svh` assumptions from the web; the iOS standalone viewport notes in the project memory apply to the web app only.
- Safe area: the list's bottom padding is `5.75rem + env(safe-area-inset-bottom)`. Use `useSafeAreaInsets()` plus the bottom nav height.
- Scroll chrome: use the list `onScroll` with the same constants. Report the state to the navigation layer.
- `Intl.DateTimeFormat("pl-PL", ...)` on Hermes: verify the output for `{day, month, hour, minute: "2-digit"}` on iOS and Android, including separators and the `--.-- --:--` fallback. Fall back to manual formatting if it differs.
- `datetime-local` maps to a native date and time picker. Convert the chosen local time to ISO on submit.
- Animations: `bet-card-enter` (360 ms, 45 ms stagger, capped at index 8), `pulse-live`, `live-indicator`, `bet-card-live`. Stop the infinite pulses when reduced motion or low power mode is on (`html.perf-lite`, index.css ~1567-1575 and ~1777-1788 for the web rules).
- Toasts: sonner maps to the chosen Expo toast library. Keep the exact messages from section 4.
- Realtime: `supabase-js` `postgres_changes` on the two channels, with the 150 ms batch and cleanup on unmount.
- The `SectionLoader` boot hold: the native splash should stay up until the first bets page resolves, per project boot rules.
