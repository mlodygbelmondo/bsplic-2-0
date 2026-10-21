# 09 Rankings and money transfers

Spec for rebuilding the BSPLIC `/rankings` page and the money transfer feature (wallet dialog with Send and History tabs) as an Expo React Native app. An engineer should be able to build both from this file without the web source.

Target: 390pt phone width (iPhone 15 class). Web breakpoints are noted where they change layout. Web `sm` is 640px, so at 390 only the mobile layouts apply.

Copy is verbatim Polish. Keep the strings exactly, including the em dash (U+2014) in empty-state copy and the minus sign (U+2212) in history.

## Files covered

| File | Lines | Role |
|---|---|---|
| `src/pages/RankingsPage.tsx` | 351 | Rankings page: mode toggle, sort tabs, mobile list, desktop table, loading, error, empty |
| `src/features/rankings/queries.ts` | 47 | `RankEntry`, `RankingType`, `rankingsQuery(type)`, row normalization |
| `src/features/rankings/stats.ts` | 147 | `computeRankingStats`. Dead code in the app: only `stats.test.ts` imports it. Do not port. |
| `src/features/rankings/stats.test.ts` | 163 | Behavior reference for the AKO unit rules (see Business rules) |
| `src/features/transfers/components/MoneyTransferDialog.tsx` | 100 | Wallet dialog shell: header, Send/History tabs, `initialTab`, submit guard |
| `src/features/transfers/components/MoneyTransferSend.tsx` | 484 | Send form: rules loading, recipient search, amount, message, confirmation, submit |
| `src/features/transfers/components/MoneyTransferHistory.tsx` | 159 | History list: pagination, rows, empty, error |
| `src/features/transfers/api.ts` | 134 | RPC wrappers and response parsers |
| `src/features/transfers/types.ts` | 35 | Transfer domain types |
| `src/features/transfers/format.ts` | 32 | Money parsing and formatting, fallback rules, message limit constant |
| `src/features/transfers/components/MoneyTransferDialog.test.tsx` | 338 | Behavior tests (see Business rules and Edge cases) |
| `src/features/transfers/moneyTransfersMigration.test.ts` | 127 | SQL contract tests for the transfer migrations |
| `src/features/transfers/moneyTransferRulesMigration.test.ts` | 66 | SQL contract tests for the rules migration |
| `src/components/Navbar.tsx` | (read only) | Entry points: `openTransferDialog` (line 116), desktop menu (line 293), mobile `onOpenTransfer` (line 361), lazy import (line 36), `?wallet=history` handling (lines 109–113, 126–130), mount (lines 389–398) |
| `src/lib/query-client.ts` | 22–25 | `PAGE_DATA_QUERY_OPTIONS` (gcTime 60 min, refetchOnMount "always") |
| `src/lib/errors.ts` | — | `getErrorMessage(error, fallback)`: returns `error.message` if it is a string, else the fallback |
| `src/lib/boot/preload.ts` | 11, 100 | Prefetches `rankingsQuery("sportsbook")` after a signed-in boot |
| `src/lib/boot/route-modules.ts` | 9 | Route chunk loader for rankings |
| `supabase/migrations/20260602130000_performance_optimizations.sql` | 211–244 | Latest `get_user_rankings()` |
| `supabase/migrations/20260626111524_global_season_reset.sql` | 1020–1103 | Latest `get_casino_rankings()` |
| `supabase/migrations/20260720090000_add_money_transfer_notification_type.sql` | — | Notification type for transfers |
| `supabase/migrations/20260720090100_money_transfers.sql` | 322 (history) | Ledger table, history RPC, RLS |
| `supabase/migrations/20260720100000_optimize_money_transfer_recipient_search.sql` | — | Latest `search_money_transfer_recipients` |
| `supabase/migrations/20260724220000_money_transfer_rules.sql` | — | Latest `create_money_transfer`, `get_money_transfer_rules` |

Earlier rankings definitions, for reference only: `20260425010000_casino_profile_history_and_rankings.sql:71`, `20260524170000_hide_agent_profiles.sql:91`.

Not read in this task (see Open questions): `private.get_sportsbook_stats`, `src/index.css` tokens, `src/components/SectionLoader`, `src/lib/scroll-chrome`.

---

## Surfaces

### S1. Rankings page (`/rankings`)

Route title: "Rankingi" (`usePageTitle`). The page is a full-height screen with the app Navbar on top and a bottom-nav-aware scroll area. The bottom nav is hidden on scroll down via `getNextScrollChromeState` (`src/lib/scroll-chrome`). Scroll padding clears the bottom nav (`--mobile-bottom-nav-scroll-padding`).

Local state, reset on each mount: `rankingType = "sportsbook"`, `sortBy = "total_profit"`.

**Layout at 390pt (top to bottom):**

1. Navbar.
2. Scroll area. Horizontal padding is 0 for the list and 12pt (`px-3`) for header and tabs. Top padding is 8pt (`pt-2`).
3. Header row. Column layout with `gap-3` and `mb-3` (12pt). The title is on top and the mode toggle is below it, left-aligned.
   - Title: `<h1>` "Rankingi". Classes `text-xl font-bold`. 20pt bold. Web `sm:text-2xl` does not apply at 390.
   - Mode toggle container: `app-subsurface inline-flex w-max items-center rounded-lg p-1`. Padding 4pt, radius 8pt, subsurface background (`app-subsurface` token, not read here).
     - Options in order: "Zakłady" (value `sportsbook`), "Kasyno" (value `casino`).
     - Button: `rounded-md px-3 py-1.5 text-xs font-semibold transition-colors`. Padding 12pt horizontal and 6pt vertical, 12pt text, radius 6pt.
     - Active: `bg-primary text-primary-foreground shadow-sm`.
     - Inactive: `text-muted-foreground hover:bg-primary/10 hover:text-foreground`. Use the pressed state (`bg-primary/10`) on touch.
4. Sort tab strip. Wrapper `mb-3 overflow-x-auto px-3 scrollbar-hide touch-pan-x`. Horizontal `ScrollView`, no visible scrollbar, 12pt side padding.
   - Inner row `flex w-max min-w-full gap-2 pb-1 pr-1`. Gap 8pt.
   - Tabs in order: "Profit" (`total_profit`), "Win rate" (`win_rate`), "Zakłady" (`total_bets`).
   - Tab: `shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all`. Padding 16pt by 6pt, pill radius, 12pt semibold.
   - Active: `gradient-primary text-primary-foreground shadow-sm`. The gradient token is defined in `src/index.css` (not read here).
   - Inactive: `border border-border/70 bg-muted/60 text-muted-foreground`.
   - Tapping a tab only changes the sort. It does not refetch.
5. Content, one of three states (see below). The list is full-bleed (no horizontal padding) and separated by top and bottom borders.

**Mobile list (`data-testid="rankings-mobile-list"`).** Container `divide-y divide-border border-y border-border bg-card/80`.

Each row is a pressable that navigates to `/profile/{id}` (Expo route equivalent: `/profile/[id]`). Row classes: `grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 text-sm transition-colors hover:bg-muted/50`. Row grid is auto, flexible, auto, with 12pt gap, 12pt horizontal and 12pt vertical padding.

- Current user's row adds `bg-primary/10`. Rows with rank ≤ 3 add `font-semibold`.
- Rank cell: `w-8 text-center text-base font-bold`, 32pt wide, 16pt bold, centered.
  - Rank 1 shows "🥇", rank 2 "🥈", rank 3 "🥉". Rank 4 and below show the number.
- Name block (`min-w-0`):
  - Name line: `block truncate font-medium`. Shows `username`, one line, ellipsis.
  - Current user adds a suffix "(ty)" with `ml-1 text-xs text-muted-foreground`.
  - Subline: `mt-1 block truncate text-[11px] text-muted-foreground`, 11pt, one line.
  - Text: `Profit {formatProfit(total_profit)} · WR {win_rate.toFixed(1)}% · {total_bets} zakł.`
  - Example: `Profit +36.00 zł · WR 66.7% · 14 zakł.`
- Metric cell (right-aligned, `text-right`):
  - Label: `block text-[10px] font-semibold uppercase text-muted-foreground`. 10pt semibold uppercase. The source text is "Profit", "Win rate" or "Zakłady", and uppercase is applied by the style (`textTransform: 'uppercase'`).
  - Value: `block font-bold` plus a tone class (see Business rules). 14pt bold, with the tone color.
  - The label and value depend on the active sort tab (see Business rules).
- Empty list: `px-4 py-8 text-center text-muted-foreground` with the empty message (below). Shown inside the list container.

**Loading state.** `SectionLoader` with label "Wczytywanie rankingu...". Use the app's shared section loader. Its visuals were not inspected here (see Open questions). The loader is shown only when there is no cached data (`isLoading`).

**Error state.** Shown when the query has an error (see Business rules for the cache caveat). Container `app-surface social-edge-surface rounded-none`, full width.

- Title: "Nie udało się wczytać rankingu". `text-sm font-semibold text-foreground`, 14pt semibold.
- Body: "Sprawdź połączenie i spróbuj ponownie.". `mt-1 text-xs text-muted-foreground`.
- Button: "Spróbuj ponownie" or "Ładowanie..." while fetching. Button classes: `mt-4 rounded-full border border-border px-4 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-60`. Disabled while fetching. On press, call `refetch()`.
- Block padding: `px-4 py-8 text-center`, so 16pt horizontal and 32pt vertical.

**Empty messages (both modes, shown inside the list when there are zero rows):**
- Zakłady mode: "Brak danych — nikt jeszcze nie postawił zakładu"
- Kasyno mode: "Brak danych — nikt jeszcze nie zagrał w kasynie"

**Desktop table (web only, ≥640px).** Not needed at 390. It is documented here so the tablet layout can be decided later. Container `app-surface hidden rounded-xl overflow-hidden sm:block`. Header `grid grid-cols-5 gap-2 p-3 text-xs font-bold text-muted-foreground border-b` with "#", "Gracz", "Profit", "Win rate", "Zakłady". The three metric headers are non-button spans with `cursor-pointer hover:text-foreground` and `text-right`. The active one has `text-foreground`. Rows are `grid grid-cols-5 gap-2 p-3 text-sm items-center border-b last:border-0`, with the same tone and highlight rules. Win rate is `{toFixed(1)}%`. Both the mobile list and the desktop table are in the DOM on web at once, and CSS hides one of them. In Expo, render only the mobile list at 390.

**Motion and haptics.** Web uses Tailwind `transition-colors` on rows, buttons and tabs (150ms default), and `transition-all` on sort tabs. No haptics exist on web (no `vibrate` or haptic calls were found). The Expo version should use a pressed background on rows and no haptics unless decided otherwise (see Open questions).

---

### S2. Wallet dialog (transfer shell)

Opened from the Navbar only (see Business rules, Entry points). Web uses a Radix Dialog with a centered panel. The Expo version may use a modal or sheet; the content below is the same either way.

**Panel.** Width `w-[calc(100%-1.25rem)]`, so 370pt at 390pt width (10pt margin per side). Max width `max-w-lg`. Radius `rounded-2xl` (16pt). Border `border-border/70`. Padding 0. Overflow hidden.

**Web open and close motion** (Radix, `src/components/ui/dialog.tsx:44`): `data-[state=open]:animate-in data-[state=closed]:animate-out fade-in-0 fade-out-0 zoom-in-95 zoom-out-95 duration-200`. The open animation also includes `slide-in-from-top-[48%]` and `slide-in-from-left-1/2`, and the close animation has matching slides. Duration 200ms. For Expo, use a 200ms fade plus scale from 0.95 to 1. The slide is optional.

**Header.** Container `border-b border-border/70 bg-gradient-to-br from-primary/12 via-primary/5 to-transparent px-5 pb-4 pt-5`. Padding 20pt horizontal, 16pt bottom, 20pt top. The gradient fades from primary at 12% to transparent.

- Icon tile: `mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-primary`. 40pt square, 12pt radius, 8pt bottom margin. Icon is lucide `WalletCards`, `h-5 w-5` (20pt), primary color.
- Title: "Portfel". `text-left text-xl`. 20pt, left-aligned.
- Description: "Dostępne saldo: " followed by `<strong>{formatMoney(balance)} zł</strong>`. The strong text uses `text-foreground`. Example: `Dostępne saldo: 1 234,50 zł`.

**Tabs.** Tab list in `px-5 pt-4` (20pt sides, 16pt top). `TabsList` is `grid w-full grid-cols-2`, two equal columns. Triggers in order: "Wyślij" (value `send`), "Historia" (value `history`).

Tab content (both): `m-0 h-[min(430px,calc(100dvh-13rem))] overflow-y-auto px-5 pb-5 pt-4`. Height is the smaller of 430pt and the screen height minus 208pt. The web `dvh` value is unreliable in iOS standalone PWAs (see memory note), so Expo can use the native screen height directly. Padding 20pt sides, 16pt top, 20pt bottom.

Tab state:
- The active tab resets to `initialTab` every time the dialog opens (`initialTab` defaults to `send`).
- Switching tabs does not reset form state in the Send tab while the dialog stays mounted. Inactive Radix tab content unmounts, so the Send form state (recipient, amount, message) is lost on switch. Treat this as current behavior.
- The Send tab's `onCompleted` switches to History after a successful transfer.

**Submit guard.** While a transfer is submitting, closing the dialog is ignored (the close action does nothing). Keep this in Expo: disable the close control and back-dismiss while submitting.

---

### S3. Send tab (`MoneyTransferSend`)

**Rules loading and error (top of tab).** On mount the form fetches `get_money_transfer_rules`. Until it resolves, the Send form shows the loading state:

- Continue button label "Ładowanie zasad..." (disabled).

If the fetch fails:
- Inline box `rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive` with the error message (from `getErrorMessage`, fallback "Nie udało się pobrać zasad transferów"). A toast shows the same message.
- Retry control "Spróbuj ponownie": `mt-1 font-semibold underline underline-offset-2`. It re-runs the rules fetch.
- Continue button label "Zasady niedostępne" (disabled).

**Recipient field.** Label "Odbiorca" (`htmlFor transfer-recipient`).

State A, no recipient selected: a search input.
- Input with `pl-9` padding. Search icon (lucide `Search`) at `absolute left-3 top-3 h-4 w-4`.
- Placeholder "Wpisz nazwę użytkownika". `autoComplete="off"`, no autocorrect.
- Dropdown appears when the trimmed query is at least 2 characters. Container `absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border bg-popover p-1 shadow-lg`. Max height 224pt, 4pt inner padding, 12pt radius.
  - While searching: "Szukam...".
  - On search error: the error message in `text-destructive`. Fallback "Nie udało się wyszukać użytkowników".
  - No results: "Brak dostępnych użytkowników".
  - Results: rows `flex w-full items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted`. Row layout: avatar `h-8 w-8` (32pt), then "@{username}" in `text-sm font-medium`. Up to 8 rows. Tapping a row selects that recipient.

State B, recipient selected: a card `flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/5 p-3`. 12pt padding and radius, primary tint.
- Avatar `h-10` class size per the web (confirm at implementation).
- Caption "Wybrany odbiorca" (small label).
- "@{username}" (`font-semibold`).
- "Zmień" button: `text-xs font-semibold text-primary`. Clears the selection and the search query, and returns to State A.

**Amount field.** Label "Kwota" (`htmlFor transfer-amount`).
- Input `inputMode="decimal"`, placeholder "0,00", classes `pr-12 text-lg font-bold`. 18pt bold. Right padding leaves room for the suffix.
- Suffix "zł", absolute, `right-3 top-2.5`, sits inside the input on the right.
- Quick action "Wyślij całe saldo" (`text-xs font-semibold text-primary`). It sets the input to `balance.toFixed(2)`, which is a dot-decimal string such as `1234.50`, and displays it in the comma-decimal field. See Edge cases.
- Helper text below the field: `text-xs`. "Minimum {formatMoney(minAmount)} zł · maksymalnie {maxTransfersPerHour} transferów w ciągu godziny". Example: `Minimum 1,00 zł · maksymalnie 5 transferów w ciągu godziny`.
- Amount input accepts only the characters the parser can use. The stored input string is what the user typed.

**Message field.** Label "Wiadomość" with a trailing "(opcjonalnie)" (`font-normal text-muted-foreground`).
- Counter `{len}/{limit}` is shown only when `len >= limit - 200`. With the default limit 2000, it appears at 1800 characters.
- Textarea `rows={3}` `resize-none`, placeholder "Dodaj krótką wiadomość...".
- Input is rejected when `Array.from(value).length` would exceed the limit. Length counts code points, not UTF-16 units.

**Too-new note.** Shown only when `accountIsTooNew` and the eligibility date is known. Container `flex gap-2 rounded-lg bg-muted px-3 py-2.5 text-xs text-muted-foreground`. Clock3 icon on the left. Text: "Transfery będą dostępne {formatTransferDate(eligibleAt)}, po {min_account_age_days} dniach od utworzenia konta." The date is formatted with `formatTransferDate`.

**Continue button.** Full width, `h-11 w-full gradient-primary font-bold text-primary-foreground`. 44pt tall, matching touch target. Send icon (lucide `Send`) with `mr-2 h-4 w-4` before the label.
- Label: `Dalej` when rules are loaded. `Zasady niedostępne` when the rules fetch failed. `Ładowanie zasad...` while loading.
- Disabled when rules are not loaded, or when `accountIsTooNew`.
- When enabled, a press runs validation (below). Validation errors show as toasts. The button stays enabled while the form has a validation problem, so the user gets feedback on press.

**Validation order (on Continue, and again on submit).** The first failure wins and shows its message as a toast:

1. No rules: "Najpierw ponów pobieranie zasad transferów" if the rules fetch failed, otherwise "Poczekaj na pobranie zasad transferów".
2. No recipient: "Wybierz odbiorcę".
3. Amount is null (unparseable) or below the minimum: `Wpisz kwotę co najmniej {formatMoney(minAmount)} zł`. Example: "Wpisz kwotę co najmniej 1,00 zł".
4. Amount above balance: "Niewystarczające saldo".
5. Message longer than the limit: `Wiadomość może mieć maksymalnie {messageLimit} znaków`.
6. Account too new: `Konto nadawcy musi istnieć od co najmniej {minAccountAgeDays} dni`.

**Confirmation view.** Replaces the form when Continue passes validation and a recipient and amount exist. The form stays mounted in state, and the confirmation is shown in its place.

- Back button: "Wróć" with lucide `ArrowLeft`. Disabled while submitting. On press, it clears the confirmation and the idempotency key.
- Summary card: `app-subsurface rounded-xl border border-border/60 p-4`. 16pt padding.
  - Caption "Sprawdź transfer": `text-xs font-semibold uppercase tracking-wide`.
  - Recipient row: avatar `h-11 w-11` (44pt), then "@{username}" (`font-semibold`), then "Odbiorca" (`text-xs`).
  - Amount: `text-lg font-black text-primary`, formatted as `{formatMoney(amount)} zł`. 18pt black weight.
  - Message: shown only when the trimmed message is not empty. Container `whitespace-pre-wrap break-words rounded-lg bg-background/80 p-3 text-sm text-muted-foreground`. Shows the trimmed text.
- Balance row: `rounded-lg border border-border/60 px-3 py-2.5 text-sm`. Label "Saldo po transferze" and `<strong>{formatMoney(balanceAfter)} zł</strong>`. `balanceAfter = balance - amount`.
- Warning: `flex gap-2 rounded-lg bg-amber-500/10 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-300`. ShieldCheck icon, text "Transfer zostanie wykonany natychmiast i nie można go cofnąć." (The `dark:` class is web-only. In Expo use the amber 300 color in the dark theme, which is the app default.)
- Submit button: `h-11 w-full gradient-primary font-bold`. Label "Wyślij {formatMoney(amount)} zł" (example: "Wyślij 25,50 zł"). While submitting: "Wysyłanie...". Disabled while submitting.

**Submit results.**
- Success:
  - Local balance updated immediately to `balance_after` from the server.
  - Toast: `Wysłano {formatMoney(amount)} zł do @{username}`. Example: "Wysłano 25,50 zł do @Odbiorca".
  - Dialog switches to the History tab.
  - Profile refresh runs in the background. If it fails, log to console "Post-transfer profile refresh failed:". Do not show an error, and keep the success state.
- Error: toast with the server message (`getErrorMessage`, fallback "Nie udało się wykonać transferu"). The form stays on the confirmation view. The idempotency key is kept, so the next submit reuses it.

**Motion and haptics.** No haptics on web. No custom animations in the send form beyond the dialog's open and close and Tailwind color transitions.

---

### S4. History tab (`MoneyTransferHistory`)

Mounted when the tab is active, so it loads fresh on each open. Page size 20.

**Loading.** On mount, load offset 0. Text "Ładowanie historii...".

**Error.** Message from `getErrorMessage`, fallback "Nie udało się pobrać historii transferów". Shows an outline button "Spróbuj ponownie" that reloads from offset 0.

**Empty.** A 44pt muted circle with lucide `Check` icon. Title "Brak transferów" and body "Wysłane i otrzymane środki pojawią się tutaj.".

**Rows.** Each entry is an `article` with `rounded-xl border border-border/60 p-3` (12pt padding, 12pt radius). Layout: direction tile, then title and subline, then amount.

- Direction tile `h-9 w-9 rounded-full` (36pt circle).
  - Sent: `bg-muted text-muted-foreground`, lucide `ArrowUpRight`.
  - Received: `bg-emerald-500/12 text-emerald-600 dark:text-emerald-400`, lucide `ArrowDownLeft`.
- Avatar `h-9` (36pt) for the counterparty.
- Title: `text-sm font-semibold truncate`.
  - Sent: "Wysłano do @{counterparty_username}".
  - Received: "Otrzymano od @{counterparty_username}".
- Subline: `text-[11px]`. `formatTransferDate(created_at)`, plus " · konto usunięte" when `counterparty_deleted` is true.
- Amount: `shrink-0 font-black`.
  - Sent: `text-foreground`, prefixed with "−" (U+2212).
  - Received: emerald color, prefixed with "+".
  - Then `{formatMoney(amount)} zł`. Example: "+12,00 zł".
- Message (only when non-empty): `mt-2 border-t border-border/60 pt-2 text-xs text-muted-foreground whitespace-pre-wrap break-words`.

**Pagination.** Button "Pokaż starsze" (`variant="ghost"`, full width). While loading more: "Ładowanie..." and disabled. Shown only when the last page returned exactly 20 rows. Appends the next page using `offset = history.length`.

---

## Data contract

All calls go through `supabase.rpc`. On error, the wrappers throw `new Error(error.message)`, so the UI can show the server message. Server messages are Polish and are shown to users as-is.

### Rankings

**`get_user_rankings()`** (sportsbook mode). Latest: `20260602130000_performance_optimizations.sql:211-244`.
- Args: none. No season parameter.
- Security: SECURITY INVOKER, STABLE. Granted to `anon` and `authenticated`.
- Returns one row per profile: `id`, `username`, `total_bets`, `won_bets`, `lost_bets`, `win_rate`, `total_profit`, `balance`.
- Source of stats: `private.get_sportsbook_stats(NULL::UUID)`. Formula for `win_rate` is inside that function (not read here).
- Filter: `s.total_bets > 0 AND NOT private.is_agent_profile(p.id)`.
- Order: `total_profit DESC`.

**`get_casino_rankings()`** (casino mode). Latest: `20260626111524_global_season_reset.sql:1020-1103`.
- Args: none.
- Security: SECURITY DEFINER, STABLE, `SET search_path = public, private`.
- Season scope: `v_season_started_at := private.get_active_season_started_at()`. Only bets and games with `created_at >= v_season_started_at` count.
- Sources (CTE `casino_units`):
  - `casino_roulette_bets`: won, lost or pending. Profit is `payout − stake` on win, `−stake` on loss, rounded to 2 dp.
  - `casino_blackjack_games`: won, lost, push or pending.
- `resolved_bets` counts won and lost only.
- `win_rate = ROUND(won / resolved × 100, 1)`, or 0 when there are no resolved bets.
- Filter: `total_bets > 0 AND NOT private.is_agent_profile(p.id)`.
- Order: `COALESCE(s.total_profit, 0) DESC`.
- Earlier versions: `20260425010000_casino_profile_history_and_rankings.sql:71`, `20260524170000_hide_agent_profiles.sql:91`.

**Row shape (client `RankEntry`):**
```ts
interface RankEntry {
  id: string;
  username: string;
  total_profit: number;
  win_rate: number;
  total_bets: number;
  won_bets: number;
  lost_bets: number;
  balance: number;
}
type RankingType = 'sportsbook' | 'casino';
```

**Normalization.** `normalizeRankingRows` applies `Number()` to `total_profit`, `win_rate`, `total_bets`, `won_bets`, `lost_bets` and `balance`. Keep this coercion in Expo, because numeric columns can arrive as strings.

**Query.** Key `['rankings', type]`. Function calls `get_user_rankings` or `get_casino_rankings` with no params. A raw error (not wrapped in `Error`) is thrown. Options spread `PAGE_DATA_QUERY_OPTIONS` (`src/lib/query-client.ts:22-25`): cached data shows instantly and refreshes in the background, gcTime 60 min, refetchOnMount "always".

**Preload.** After a signed-in boot, `rankingsQuery('sportsbook')` is prefetched (`src/lib/boot/preload.ts:100`). Casino rankings are not prefetched.

### Transfers

Types (`src/features/transfers/types.ts`):
```ts
interface MoneyTransferRecipient {
  id: string;
  username: string;
  avatar_url: string | null;
}
interface MoneyTransferRules {
  min_amount: number;
  max_message_length: number;
  max_transfers_per_hour: number;
  min_account_age_days: number;
  sender_eligible_at: string | null;
  sender_eligible: boolean;
  server_now: string;
}
interface MoneyTransferResult {
  id: string;
  amount: number;
  recipient_username: string;
  balance_after: number;
  created_at: string;
}
interface MoneyTransferHistoryEntry {
  id: string;
  direction: 'sent' | 'received';
  counterparty_id: string | null;
  counterparty_username: string;
  counterparty_avatar_url: string | null;
  counterparty_deleted: boolean;
  amount: number;
  message: string | null;
  created_at: string;
}
```

**`get_money_transfer_rules()`** (`api.ts:52-56`). Args: none. Parser `parseMoneyTransferRules` (`api.ts:10-50`) throws "Serwer zwrócił nieprawidłowe zasady transferów" when:
- any of `min_amount`, `max_message_length`, `max_transfers_per_hour`, `min_account_age_days` is not a number,
- `sender_eligible` is not a boolean,
- `server_now` is not a string,
- `sender_eligible_at` is neither null nor a string.

This is the source of truth. Client fallbacks apply only until rules load.

**`search_money_transfer_recipients(p_query, p_limit)`** (`api.ts:85-95`). Client sends `p_limit: 8`. Returns an array of `MoneyTransferRecipient` (`(data ?? [])`).
- Server: empty result when `CHAR_LENGTH(p_query) < 2`.
- `LIKE` pattern escapes `\`, `%` and `_`. Matches `LOWER(username) LIKE '%' || pattern || '%' ESCAPE '\'`.
- Excludes the caller, agents and restricted accounts.
- Ordering: exact match first, then prefix match. Limit is `LEAST(GREATEST(COALESCE(p_limit,8),1),8)`.
- Errors: unauthenticated raises "Musisz być zalogowany". An agent or restricted caller raises "Transfery są niedostępne dla tego konta".

**`create_money_transfer(p_recipient_id, p_amount, p_message, p_idempotency_key)`** (`api.ts:97-112`). Parser `parseMoneyTransferResult` throws "Serwer zwrócił nieprawidłowy wynik transferu" on a shape mismatch. Returns `MoneyTransferResult`.
- Client sends `message` as typed (untrimmed). See Edge cases.
- Idempotency: lookup by `(sender_id, idempotency_key)`. If the stored recipient, amount or message differs, raises "Identyfikator operacji został już wykorzystany". Otherwise returns the stored transfer.
- Errors (RAISE messages, `%` is a substituted value):
  - "Kwota musi wynosić co najmniej % zł i mieć maksymalnie 2 miejsca po przecinku"
  - "Wiadomość może mieć maksymalnie % znaków"
  - "Nie znaleziono konta nadawcy"
  - "Nie znaleziono odbiorcy"
  - "Konto nadawcy musi istnieć od co najmniej % dni"
  - "Transfery są niedostępne dla jednego z tych kont"
  - "Nieprawidłowe saldo konta"
  - "Możesz wykonać maksymalnie % transferów w ciągu godziny"
  - "Niewystarczające saldo"
  - "Musisz być zalogowany"
  - "Nie możesz wysłać pieniędzy do siebie"
  - "Brak identyfikatora operacji"
- Locks are taken `FOR UPDATE`, ordered by profile id, to avoid deadlocks.

**`get_money_transfer_history(p_limit, p_offset)`** (`api.ts:114-134`). Client sends limit 20 and offset from the page. Server: rows where the caller is sender or recipient, `ORDER BY created_at DESC, id DESC`, limit clamped to 1–50, offset ≥ 0 (`20260720090100_money_transfers.sql:322`). The client throws "Serwer zwrócił nieprawidłową historię transferów" when any `direction` is neither `sent` nor `received`.

**Ledger and permissions.** `money_transfers` is append-only. `authenticated` has no direct write access. `UNIQUE(sender_id, idempotency_key)`. Direct `UPDATE` on `profiles` is revoked except for `avatar_url`, so balances change only through the RPC.

---

## Business rules

### Rankings

1. Two boards: sportsbook (`get_user_rankings`) and casino (`get_casino_rankings`). Switching the mode changes the query key. Cached data for the other board is not shown.
2. Players with no bets (`total_bets = 0`) and agent profiles are excluded server-side, for both boards.
3. Default sort is profit, descending. The client re-sorts the returned rows by the chosen metric, descending: `[...rows].sort((a, b) => b[sortBy] - a[sortBy])`. Ties keep the server order.
4. Rank is the index in the sorted list plus one. Ties get distinct ranks. Medals go to ranks 1–3.
5. Primary metric shown on the right of each mobile row depends on the active sort:
   - Profit: label "Profit", value `+12.34 zł` or `-5.00 zł`, tone applied.
   - Win rate: label "Win rate", value `{win_rate.toFixed(1)}%`, no tone.
   - Zakłady: label "Zakłady", value `{total_bets}`, no tone.
6. Profit format is `${profit >= 0 ? '+' : ''}${profit.toFixed(2)} zł`. Dot decimal, no thousands separator, so `1234.5` displays as `+1234.50 zł`.
7. Profit tone: greater than 0 is `text-success`, less than 0 is `text-destructive`, zero has no tone.
8. The current user's row gets `bg-primary/10` and a "(ty)" suffix. Ranks 1–3 get `font-semibold`.
9. Tapping a row opens `/profile/{id}`.
10. No period or season selector exists on this page. The sportsbook board is all-time (no season filter). The casino board is limited to the active season by the server.
11. Loading is shown only when there is no cached data. With cached data, rows show immediately and refresh in the background.
12. The error branch replaces the rows on any error, including a background refetch error. See Edge cases.
13. Empty copy depends on the mode (see S1).

### Transfers

1. Only users with an eligible account can send. Eligibility is server-decided (`sender_eligible`). The client also blocks Continue when `accountIsTooNew`.
2. Account age: the server gate is `min_account_age_days` (fallback 14). `sender_eligible_at` is the moment the account becomes eligible. The client re-fetches rules at that time (`max(eligibleAt − server_now, 0) + 50 ms` timer) and unlocks automatically.
3. Without loaded rules, the client estimates eligibility from `profile.created_at + min_account_age_days × 86 400 000 ms`. This only affects the too-new check during the fallback path. Continue stays disabled until rules load.
4. Amount:
   - Parsed by `parseMoney`: trim, replace the first comma with a dot, then accept only `^\d+(?:\.\d{1,2})?$`. Otherwise the amount is null.
   - Must be at least `min_amount` (fallback 1 zł).
   - Maximum two decimal places (server enforced).
   - Must not exceed the balance.
5. Message: optional. Maximum `max_message_length` characters (fallback 2000), counted with `Array.from`.
6. Recipient: must be chosen from search results. Free typed usernames are not accepted by the client.
7. Search: needs at least 2 trimmed characters. Debounced 250 ms. Up to 8 results. Skipped while a recipient is selected.
8. Rate limit: at most `max_transfers_per_hour` per hour (fallback 5). Enforced by the server. The UI only shows it as helper text.
9. Self-transfer is forbidden (server). Agents and restricted accounts cannot send or receive (server, and excluded from search).
10. Idempotency: a key is created when the user presses Continue (`crypto.randomUUID()`). Retries after a server error reuse the same key. Going Back clears the key. A new key is created on the next Continue.
11. A transfer is final. The confirmation shows a warning: "Transfer zostanie wykonany natychmiast i nie można go cofnąć."
12. After success: balance is set from the server response, the dialog moves to History, and the profile is refreshed in the background.
13. The dialog cannot be closed while a submit is in progress.
14. Entry points:
    - Navbar desktop menu (`Navbar.tsx:293`) calls `openTransferDialog('send')`.
    - Mobile menu `onOpenTransfer` (`Navbar.tsx:361`) calls `openTransferDialog('send')`.
    - The wallet balance chip in the Navbar (lines 247, 324) opens the top-up dialog, not transfer.
    - `?wallet=history` opens the dialog on the History tab (`Navbar.tsx:109-113`). Closing it removes the `wallet` query param with a replace navigation (`Navbar.tsx:126-130`). The Expo version can use a route param or a store flag with the same effect.
15. The dialog is mounted only when a profile is loaded (`Navbar.tsx:389-398`).

---

## Edge cases and gotchas

1. **Error hides cached rankings.** `RankingsPage` renders the error block whenever `error` is set, even when cached rows exist. A background refetch failure therefore replaces a good list with the error message. Decide whether Expo keeps this or shows cached rows with a banner.
2. **Rank uses list index.** Ties get distinct ranks (for example 3 and 4 with equal profit). Medal goes by index.
3. **Metric headers on web are not buttons.** Desktop sort headers are spans with click handlers, so they are not keyboard or screen-reader accessible. In Expo, the sort tabs are real buttons.
4. **Duplicate DOM on web.** Mobile list and desktop table are both rendered, and CSS hides one. Render only what is needed in Expo.
5. **Label clash.** The mode toggle and the sort tab both use "Zakłady" for different things (sportsbook mode vs total bets sort). Keep the copy, but the two controls are in different rows.
6. **Mixed decimal styles.** Rankings use dot decimals with `toFixed` and no grouping ("+1234.50 zł"). Transfers use comma decimals with grouping ("1 234,50 zł"). Do not unify them without a decision.
7. **Intl grouping separator.** `Intl.NumberFormat('pl-PL')` groups thousands with a no-break space (U+00A0). Keep it in copy comparisons and tests.
8. **Hermes and Intl.** Verify that Hermes on the pinned Expo SDK supports `pl-PL` for `NumberFormat` (min and max fraction digits 2) and `DateTimeFormat` with `dateStyle: 'medium'` and `timeStyle: 'short'`. If not, use a formatter that gives the same output.
9. **`parseMoney` rejects grouping.** "1.000,00" becomes "1.000.00" and fails the regex, so the amount is null. The validation message then says "Wpisz kwotę co najmniej 1,00 zł", which is misleading for a user who typed a large amount. Consider a dedicated message for this case.
10. **Dot input accepted.** `parseMoney` also accepts "25.50" (the first comma is replaced, and an existing dot passes the regex).
11. **"Wyślij całe saldo" format mismatch.** It sets the input to `balance.toFixed(2)`, which is `1234.50`. The field uses comma decimals, so the user sees a dot-decimal value that the parser still accepts. Format the value with a comma in Expo.
12. **Untrimmed message sent.** The confirmation shows the trimmed message, but `createMoneyTransfer` sends the raw `message`. Whether the server trims it is not verified in this task.
13. **Idempotency mismatch error.** Retrying with a different recipient, amount or message under the same key raises "Identyfikator operacji został już wykorzystany". The client only reuses a key for the same confirmation, so this should not occur in normal use.
14. **Background profile refresh failure is silent.** The success path logs to console only. The local balance already shows `balance_after`.
15. **Form state is lost on tab switch.** Inactive tab content unmounts, so the Send form resets when the user switches to History and back. After a successful send the form is unmounted too, so the next open starts empty.
16. **History reloads on every open.** There is no cache. The Expo version can keep the React Query cache if desired, but the current behavior is a fresh load.
17. **Deleted counterparties.** `counterparty_deleted` adds " · konto usunięte" to the subline. The name and avatar may be null or stale.
18. **Pagination stop rule.** "Pokaż starsze" appears only when the last page is exactly 20 rows. A final page of exactly 20 shows the button once more, and tapping it returns zero rows.
19. **Eligibility timer.** The timer fires `max(eligibleAt − server_now, 0) + 50 ms` after rules load. If the device clock is wrong, the server time (`server_now`) still drives the delay. The UI unlocks only after rules are re-fetched, so the server remains the authority.
20. **Retry key behavior.** After a server error on submit, the same key is sent on retry. If the first attempt actually succeeded on the server, the retry returns the stored transfer and the user sees success.
21. **Dialog height.** The web tab content height uses `dvh`, which is unreliable in iOS standalone PWAs. This is web-only. Expo should size from the native screen height.
22. **Haptics.** None on web. Do not add without a decision.
23. **Amber dark-mode class.** The warning uses `text-amber-700 dark:text-amber-300`. The app defaults to dark. Verify the light-mode color is unnecessary in Expo.

---

## Open questions

1. **Season scope for sportsbook rankings.** `get_user_rankings` has no season filter, while `get_casino_rankings` is limited to the active season. Should the sportsbook board also be season-scoped? This decides whether the page needs a season label.
2. **Sportsbook `win_rate` formula.** Defined inside `private.get_sportsbook_stats` (not read in this task). Confirm the formula and the rounding before porting, or reuse the server value as-is.
3. **Error with cached rows.** Keep the current behavior (error replaces rows on background failure) or show cached rows with a banner?
4. **Tablet layout.** Does Expo need the desktop table at tablet widths (≥640pt), or is the mobile list enough for all targets?
5. **Haptics.** None on web. Add success and error haptics for send and retry, or leave none?
6. **Dialog presentation.** Centered modal (matches web) or bottom sheet (more native)? The content and copy are the same.
7. **Hermes Intl for pl-PL.** Verify number and date formatting on the pinned SDK. Decide between built-in Intl and a formatter.
8. **Idempotency key source.** `globalThis.crypto.randomUUID()` may not exist on Hermes. Confirm the `expo-crypto` `randomUUID` export on the pinned SDK, or pick another source.
9. **Message trimming.** Should the client send the trimmed message to match the confirmation? Check whether the server trims. Currently the raw value is sent.
10. **`parseMoney` grouping.** Keep rejecting "1.000,00" with the current message, or add a specific message and/or accept grouping?
11. **Visual tokens.** `gradient-primary`, `app-surface`, `app-subsurface`, `social-edge-surface`, `text-success`, `bg-popover`, `shadow-lg`, and the `text-primary` and `bg-primary` values come from `src/index.css`. Not read in this task. Confirm the values before styling.
12. **SectionLoader and scroll-chrome.** The visuals of `SectionLoader` and the scroll thresholds in `getNextScrollChromeState` were not inspected. Both are needed for the loading state and the tab bar hide behavior.
13. **Send form reset after success.** The form unmounts after success. Confirm that the empty form on the next open is the intended behavior.
14. **Entry points in Expo navigation.** The web opens transfers from the account menu only. Confirm where the Expo app places the entry point and whether the wallet chip should also open transfer.
