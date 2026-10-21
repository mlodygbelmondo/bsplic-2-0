# Coupon (bet slip)

Scope: the betting coupon that collects odds selections from the sportsbook home list, lets the user set stakes for single or AKO (accumulator) bets, and places them through the server RPC. Phone only (below 1024px). Layout measured at 390px wide. The desktop column (`lg:` and up) is a fixed 300px aside that shows the same content; it is out of scope for the phone rebuild.

Source of truth for behavior is the web code listed below. Polish copy is verbatim. Nothing in the coupon files uses sound, haptics, React Query, or realtime channels.

## Files covered

/Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/src/components/CouponDrawer.tsx (485 lines)
/Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/src/contexts/CouponContext.tsx (133 lines)
/Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/src/features/home/hooks/useCouponPlacement.ts (203 lines)
/Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/src/features/home/api/coupons.ts (38 lines)
/Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/src/features/home/api/bets.ts (81 lines)
/Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/src/features/coupons/akoExclusions.ts (87 lines)
/Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/src/features/coupons/akoExclusionApi.ts (35 lines)
/Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/src/features/coupons/categoryEmoji.ts (14 lines)
/Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/src/features/coupons/display.ts (109 lines; not used by the placement flow)
/Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/src/features/social/copyCoupon.ts (76 lines)
/Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/src/features/social/hooks/useFeedInteractions.ts (260 lines)
/Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/src/features/social/lib/socialFormatters.ts (42 lines)
/Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/src/components/BetCard.tsx (290 lines)
/Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/src/contexts/AuthContext.tsx (236 lines)
/Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/src/features/home/layout/HomeShell.tsx (67 lines)
/Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/src/features/jackpot/pages/JackpotDevFlowPage.tsx (438 lines)
/Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/src/types/database.ts (309 lines)
/Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/src/components/ui/input.tsx (22 lines)
/Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/src/index.css (1790 lines)
/Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/supabase/migrations/20260618040000_harden_jackpot_state_and_ako_duplicates.sql (349 lines; latest `place_bet_secure` body at lines 142-345)
/Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/supabase/migrations/20260618044500_revoke_anon_place_bet_secure.sql (6 lines)
/Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/supabase/migrations/20260617010000_ako_exclusions.sql (42 lines)
/Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/supabase/migrations/20260726102000_agent_ako_exclusions.sql (251 lines; admin and agent write paths, does not redefine `place_bet_secure`)
/Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/src/features/home/hooks/useCouponPlacement.test.tsx (163 lines)
/Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/src/components/CouponDrawer.test.tsx (137 lines)
/Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/src/features/social/copyCoupon.test.ts (105 lines)

## Surfaces

### S1. Collapsed coupon trigger (floating button, phone only)

Entry: rendered by `CouponDrawer` whenever the sheet is closed (`!open`). `CouponDrawer` is mounted in `HomeShell` after the `<main>` bet list (HomeShell.tsx:62) and in `JackpotDevFlowPage` (JackpotDevFlowPage.tsx:395).

Exit: tap opens S2.

Geometry at 390px:
- Circle, 56 x 56 px (`h-14 w-14`), `rounded-full`, `shadow-2xl`.
- Fixed position, `right-4` (16px). Bottom is `calc(1rem + var(--mobile-floating-stack-offset, 4.75rem) + env(safe-area-inset-bottom))`, which is 92px plus the bottom safe area. Under `.bonus-campaign-cta-visible` the bottom becomes `calc(4.5rem + var(--mobile-floating-stack-offset, 4.75rem) + env(safe-area-inset-bottom))` (index.css:702), which is 148px plus safe area.
- z-index 40.
- Icon: lucide `Ticket`, 24 x 24 px.
- Count badge (only when items exist): 20 x 20 px circle, `absolute -right-2 -top-2`, `bg-card`, `text-[10px] font-bold`, `shadow`, shows the item count.

States:
- Empty (no items): `bg-card text-foreground border border-border`, no badge.
- Filled (items present): `gradient-primary text-primary-foreground` with `shadow-[0_8px_28px_hsl(355_100%_45%/0.45)]`, plus badge.
- Accessible name: `aria-label="Otwórz kupon"`.

Motion: `press-scale` (scale 0.94 on `:active`). `coupon-mobile-trigger` transitions bottom, background-color, color, border-color, box-shadow, and transform over 200 ms ease-out (index.css:697-701). `WebkitTapHighlightColor: transparent` is set inline.

### S2. Coupon sheet (open state, phone only)

Entry: tap S1. Also `preferredCouponType` sets the active tab when the sheet is already mounted (see S5).

Exit: X button (header), tap on backdrop, or Escape key (the Escape listener only runs while `open`). Each goes through `handleClose`, which sets `isClosing`, waits 220 ms, then sets `open` false. A successful placement also calls `handleClose`.

Backdrop: full screen, `fixed inset-0 z-[70] bg-black/60 backdrop-blur-[2px]`, `transition-opacity duration-200`, opacity 0 while closing. Tap closes.

Sheet container (`aside`): `fixed inset-x-2 bottom-2 z-[81]`, so 8px inset on each side and 8px from the bottom. Width is 374px at 390px wide. Height is `min(calc(var(--app-viewport-height,100svh) - 6rem), 680px)`, and `max-h` uses the same calc. At 844px tall, the sheet is 680px and its top edge sits at 156px. `bg-card`, `border border-border`, `rounded-2xl`, `card-shadow`, `overflow-hidden`, bottom padding `max(0.5rem, env(safe-area-inset-bottom))`.

Top to bottom inside the sheet (content width about 372px after borders):

1. Drag handle row. `lg:hidden flex justify-center py-2.5 border-b border-border/70`, about 24px tall. Inner bar 48 x 4 px, `rounded-full bg-muted-foreground/30`, `aria-hidden`. Decorative only; there is no swipe gesture.

2. Header row. `flex items-center justify-between px-4 py-3 border-b border-border`, about 52px tall.
   - Left: `h3`, `text-[13px] font-bold`, text is `{items.length} {eventsLabel}`. Examples: `0 zdarzenia`, `1 zdarzenie`, `2 zdarzenia`, `5 zdarzeń`.
   - Right group (gap 6px): `Wyczyść` (only when items exist), `text-[11px] font-semibold text-muted-foreground hover:text-foreground`. Then the close button: `lg:hidden p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted`, `aria-label="Zamknij kupon"`, lucide `X` 16 x 16 px.

3. Tab switcher. `px-3 py-2 border-b border-border`. Segmented control `grid grid-cols-2 rounded-lg bg-muted p-0.5` (2px inset). Each tab: `py-1.5 text-[13px] font-semibold text-center rounded-md transition-colors`.
   - Active: `bg-card text-foreground shadow-sm`.
   - Inactive: `text-muted-foreground`.
   - Labels: `Pojedyncze` (left), `AKO` (right).

4. Items list. `flex-1 min-h-0 overflow-y-auto px-3 py-3`. This is the only scrolling area; the header, tabs, and footer are `shrink-0`.
   - Empty state: centered in the full area, `px-2`. Text `Dodaj zdarzenia do kuponu klikając na kursy.` in `text-[12px] text-muted-foreground text-center max-w-[240px]`.
   - Items: `space-y-2.5` (10px gap). Each is an `article` keyed by bet id, `rounded-xl border border-border bg-background/60 p-2.5` (about 326px content width).
     - Line 1: category emoji and title, `text-[11px] text-muted-foreground truncate`. Text is `{emoji} {title}` with one space between. Emoji comes from `getCouponCategoryEmoji` (default `⚽`).
     - Line 2: selected option name, `font-bold text-[13px] leading-snug mt-0.5`.
     - Line 3: odds chip, `odds-yellow inline-block mt-1 rounded-md px-1.5 py-0.5 text-[11px] font-extrabold italic`, text `item.odds.toFixed(2)`.
     - Single tab only, `mt-2.5 grid grid-cols-[auto_1fr_auto] items-center gap-2`:
       - Label `Stawka` (`text-[11px] text-muted-foreground`).
       - Input, `type="number" min=0.01 step=0.01`, `h-8 text-base md:text-[12px] font-semibold text-center bg-muted border-border`, placeholder `0.00`. On phone the font is 16px.
       - Label `zł` (`text-[11px] text-muted-foreground`).
     - Remove button, top right of the card: `p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10`, `aria-label="Usuń zdarzenie"`, lucide `X` 14 x 14 px.

5. Footer. `border-t border-border p-3 space-y-2.5 shrink-0 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85`. Content width 348px.
   - Row: `Potencjalna wygrana` (`text-[14px] text-muted-foreground`) on the left, `{potentialWin.toFixed(2)} zł` (`text-[15px] font-bold text-success`) on the right.
   - AKO tab:
     - `Współczynnik {effectiveTotalOdds.toFixed(2)}` (`text-[11px] text-muted-foreground`).
     - Stake input, `type="number" min=0.01 step=0.01`, `text-center font-bold text-base md:text-[13px] h-9 bg-muted border-border`, placeholder `Stawka (zł)`.
     - Preset grid `grid grid-cols-6 gap-1.5`, six buttons of about 53px each. Each is `w-full text-[11px] font-semibold px-2 h-8 rounded-md transition-all duration-200`.
       - `5 zł`, `10 zł`, `25 zł`, `50 zł` (text is `{preset} zł`). Active when stake equals the preset: `bg-foreground text-background shadow-sm scale-[1.02]`. Inactive: `bg-card text-foreground hover:bg-muted`.
       - `2x`, `aria-label="Podwój stawkę"`, `bg-card`.
       - `Max`, `title="Postaw całe saldo"`, `disabled` when balance is 0 or less (`disabled:opacity-50 disabled:cursor-not-allowed`). Active when stake equals the max string and balance is above 0.
   - Single tab: `Łączna stawka: {totalStake.toFixed(2)} zł` (`text-[12px] text-muted-foreground`).
   - Insufficient funds (when items exist and total exceeds balance): `Niewystarczające środki — saldo {balance.toFixed(2)} zł` (`text-[11px] font-semibold text-destructive`).
   - AKO conflict notice (when an exclusion pair is selected): box `rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-[11px] font-semibold text-destructive`. Inside is lucide `AlertTriangle` 14 x 14 px (`mt-0.5 shrink-0`) and a `<p>` with the message.
   - Submit: `press-scale w-full gradient-primary text-primary-foreground font-bold h-10 text-[13px] rounded-lg shadow-[0_4px_16px_hsl(355_100%_45%/0.35)] transition hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none`. Label `Obstaw`, or `Stawianie...` while placing. Disabled when placing, when there are no items, when insufficient funds, or when there is an AKO conflict.

Desktop aside (`hidden lg:block w-[300px] shrink-0 h-full`) shows the same `drawerContent` inside a `rounded-2xl bg-card border border-border card-shadow` container. It is always visible and ignores `open`. Not covered further.

Motion (sheet): on open, `coupon-drawer-enter` runs 220 ms `cubic-bezier(0.16, 1, 0.3, 1)` from `translateY(24px)` and opacity 0 to `translateY(0)` and opacity 1 (index.css:694-705). The class replays on each open because the aside is only mounted while open. On close, the sheet gets `translate-y-4 opacity-95` with `transition-transform duration-200 ease-out`. Opacity changes are not transitioned, only transform. The close timer is 220 ms.

Motion (controls): `press-scale` on trigger and submit. Preset buttons use `transition-all duration-200`, with a 1.02 scale for the active one.

Sound: none. Haptics: none.

### S3. Desktop coupon column (out of scope)

`hidden lg:block w-[300px]`, always visible, same content as S2 without the drag handle and the close button. Mentioned for completeness only.

### S4. Entry from the bet list (BetCard)

Odds buttons on each bet card (BetCard.tsx:88-96). Tapping an unexpired, active option with no selection adds it with `addItem({ bet, selectedOption: option.name, odds: option.odds })`. Tapping the already selected option calls `removeItem(bet.id)`. Expired or inactive bets ignore taps. Selecting a different option on a bet that is already in the coupon replaces that item (`addItem` replaces by bet id). The card UI itself belongs to the sportsbook home spec.

### S5. Entry from a social coupon copy

`useFeedInteractions.handleCopyCoupon` (useFeedInteractions.ts:78-133) fetches the bets, builds items, calls `addItems(items)`, sets `setPreferredCouponType(items.length > 1 ? 'ako' : 'single')`, and calls `navigate('/')`. The sheet does not open by itself. The user sees the trigger filled with the new count, then taps it to open the sheet, where the preset tab is active.

### S6. Clear-coupon toast with undo

Tapping `Wyczyść` (header) stores the current items, calls `clearCoupon()`, and shows a sonner toast `Kupon wyczyszczony` with action `Cofnij`. Tapping `Cofnij` calls `addItems(clearedItems)`. The toast has no explicit duration in this code, so the sonner default applies. The toast is rendered by the app-level sonner Toaster, not by coupon files.

### Other toasts (from the coupon flow)

- `addItem` shows `Dodano do kuponu` on every single add, including replacements. The copy flow's `addItems` does not toast per item.
- Placement success, errors: see Data contract and Business rules.

## Data contract

### Supabase calls

1. `supabase.rpc('place_bet_secure', { p_user_id, p_total_odds, p_stake, p_items })`
   - Wrapper: `placeCouponSecure({ userId, totalOdds, stake, items })` in `src/features/home/api/coupons.ts`. It rounds stakes to 2 decimals, maps each item to `{ betId, selectedOption, odds, stake }`, and returns the new coupon UUID. On error it throws `new Error(error.message)`, so the server's RAISE text is shown verbatim in the toast.
   - Parameter types from the REVOKE/GRANT migration: `p_user_id UUID`, `p_total_odds NUMERIC`, `p_stake NUMERIC`, `p_items JSONB`.
   - Single tab: one call per item, in order, each with `p_total_odds: 1` and one item with `stake` equal to that item's stake.
   - AKO tab: one call with all items, `p_total_odds` equal to the product of client odds, `p_stake` equal to the total stake, and items with distributed stakes.
   - Example (AKO, test fixture): stake 10 over odds 1.5, 2, 2.5 gives `p_total_odds: 7.5` and item stakes 3.34, 3.33, 3.33.
   - Grant: EXECUTE for `authenticated` only (20260618044500).
   - Caller: `useCouponPlacement.placeBet`, invoked from the submit button and from Enter in the stake input.

2. `supabase.from('bet_ako_exclusions').select('bet_id_a, bet_id_b, reason').or(\`bet_id_a.in.(${idList}),bet_id_b.in.(${idList})\`)`
   - Wrapper: `fetchAkoExclusionsForBets(betIds)` in `src/features/coupons/akoExclusionApi.ts`. It dedupes and drops falsy ids, returns `[]` for fewer than 2 ids, throws on error, and maps rows to `{ betIdA, betIdB, reason }`.
   - Caller: effect in `CouponDrawer` (lines 136-159). It runs whenever the selection changes, on either tab. An `isCurrent` flag discards stale responses. On error it sets `[]` silently.
   - Table (20260617010000): `bet_ako_exclusions`, columns `id` UUID PK, `bet_id_a` and `bet_id_b` UUID NOT NULL with FK to bets ON DELETE CASCADE, `reason` TEXT (nullable), `created_by`, `created_at`. CHECK `bet_id_a <> bet_id_b`. Unique index on `(LEAST(a,b), GREATEST(a,b))`. RLS on. Read policy for `authenticated`. Write policies for admins (`public.has_role(auth.uid(), 'admin')`).

3. `supabase.from('bets').select('*').in('id', ids)`
   - Wrapper: `fetchBetsByIds(ids)` in `src/features/home/api/bets.ts` (lines 52-64). Empty input returns `[]`. Throws on error.
   - Caller: copy flow only (`handleCopyCoupon`). Not used by placement.

4. AuthContext profile load (AuthContext.tsx:65-66), run with `Promise.all`:
   - `supabase.from('profiles').select('*').eq('id', userId).single()`
   - `supabase.from('user_roles').select('role').eq('user_id', userId)`
   - The coupon reads `profile.balance` from this row. `refreshProfile()` (AuthContext.tsx:102) is called after each placement attempt that succeeded, or that partially succeeded. `updateProfileBalance` (line 106) exists but is not called by the coupon.

The coupon files do not read `coupons` or `placed_bets` directly. There is no realtime channel and no React Query key in the coupon flow. Coupon state lives in `CouponContext` and localStorage.

### Server RPC: `place_bet_secure` (latest body 20260618040000, lines 142-345)

Validation order and RAISE texts (verbatim; the client shows them as toasts):

| Check | Message |
| --- | --- |
| `p_user_id` is not `auth.uid()` | Nie możesz obstawiać w imieniu innego użytkownika |
| `p_items` not an array | Nieprawidłowy kupon |
| empty items | Dodaj co najmniej jedno zdarzenie do kuponu |
| `p_stake` null or <= 0 | Stawka musi być większa od 0 |
| `p_stake` not 2 decimals | Stawka może mieć maksymalnie 2 miejsca po przecinku |
| profile missing (after `FOR UPDATE` lock) | Nie znaleziono użytkownika |
| `p_stake` > balance | Niewystarczające środki (saldo: % zł) |
| item stake missing or <= 0 | Stawka każdego zakładu musi być większa od 0 |
| item stake not 2 decimals | Stawka zakładu może mieć maksymalnie 2 miejsca po przecinku |
| empty `selectedOption` | Wybierz opcję zakładu |
| bet not found | Zakład nie istnieje |
| bet not active | Zakład jest już zamknięty |
| `ends_at <= NOW()` | Czas na obstawianie tego zakładu minął |
| no canonical option by name | Wybrana opcja zakładu nie istnieje |
| canonical odds <= 0 | Nieprawidłowy kurs zakładu |
| sum of item stakes != `ROUND(p_stake, 2)` | Suma stawek zakładów musi być równa stawce kuponu |
| AKO only (count > 1): duplicate bet id | Nie możesz dodać tego samego zdarzenia do AKO więcej niż raz |
| AKO only: exclusion pair found | Tych zdarzeń nie można łączyć na AKO: % + % |

Then, in one transaction: `UPDATE profiles SET balance = ROUND(balance - p_stake, 2)`; `INSERT coupons` (status `pending`, `total_odds` = canonical product when item count > 1, otherwise 1); `INSERT placed_bets` per item (`odds_at_time` = canonical odds, `coupon_id`); `UPDATE bets SET bet_count = bet_count + 1`. Returns the coupon id.

The function is SECURITY DEFINER with `search_path = public`, and does not check `winning_option`.

The AKO exclusion query (`LIMIT 1`, no ORDER BY, lines ~300-305) runs only when the item count is above 1.

### localStorage

1. `bsplic.coupon.items.v1`
   - Owner: `CouponContext`. Read once on provider init (`useState(readStoredItems)`). Written in an effect on every `items` change. An empty list removes the key.
   - Shape: JSON array of `CouponItem`: `{ bet: Bet, selectedOption: string, odds: number }`. The full `Bet` object is stored as a snapshot.
   - On read: JSON parse, then each entry must pass `isStorableCouponItem` (string `selectedOption`, finite numeric `odds`, object `bet` with string `id`). Then the list keeps only `bet.is_active` and `ends_at` in the future. Any error returns `[]`. Because the write effect also runs on mount, the filtered list is written back.
   - Write errors are swallowed.

2. `bsplic.coupon.last-stake`
   - Owner: `CouponDrawer`. Holds the raw AKO stake string.
   - Read on mount: returns the stored raw string when it parses to a finite number greater than 0, otherwise `'10'`.
   - Written only after a successful AKO placement (`onSuccess`). Write errors are caught.

Other in-memory state (not persisted): `singleStakes` (map of bet id to stake string), `activeTab`, `open`, `isClosing`, `akoExclusions`.

## Business rules

1. Coupon type. `couponType` is `'ako'` when there are more than 1 items, otherwise `'single'` (CouponContext). The tab is user-selectable regardless. On the server, a request with one item is always a single bet.
2. One selection per bet. Adding a second option for a bet replaces the first. The same option tapped again removes it.
3. Single tab stakes. Each item has its own stake string. A new item starts at `'10'` (the `items` effect sets `previous[id] ?? '10'`). Stakes are removed for items that leave the coupon.
4. Single tab validation (client, in order): every item must have a stake that parses to a number greater than 0 (`Uzupełnij stawkę dla każdego zakładu`), and the raw string must have at most 2 decimals (`Stawka może mieć maksymalnie 2 miejsca po przecinku`). These are checked on click only, not by disabling the button.
5. AKO validation (client): stake must parse to a number greater than 0 (`Stawka musi być większa od 0`), and at most 2 decimals.
6. Total stake. AKO: `parseStake(stake)`. Single: sum of per-item stakes, each rounded to 2 decimals and summed with rounding at each step. If total is 0 or less: `Stawka musi być większa od 0`.
7. Balance check. Client: total greater than `Number(profile.balance)` shows `Niewystarczające środki (saldo: X zł)` on click and disables the button (the inline notice uses an em dash form). Server: same check under a row lock.
8. Stake split for AKO. Total is converted to cents. Each item gets `floor(total / n)` cents, and the first `total mod n` items get one extra cent. Example: 10 over 3 items gives 3.34, 3.33, 3.33. The item stakes sum to the charged stake.
9. Potential win. AKO: `round(stake * product of client odds, 2)`. Single: sum over items of `round(stake_i * odds_i, 2)`, rounded after each addition.
10. Effective total odds. AKO: product of client item odds (1 for an empty coupon). Single: always 1. Shown as `Współczynnik` on AKO only.
11. Odds used for placement. The client sends its stored item odds (`odds`), but the server ignores `p_total_odds` and uses canonical odds from `bets.options` for each `selectedOption`. Stored `odds_at_time` and the coupon's `total_odds` use canonical values.
12. Server-side bet eligibility: active, `ends_at` in the future, option found by name, canonical odds greater than 0.
13. AKO exclusions (client): checked only when the AKO tab is active and there are at least 2 selected bets. A pair listed in `bet_ako_exclusions` blocks `Obstaw`. The message is `Tych zdarzeń nie można łączyć na AKO: {titleA} + {titleB}`, with `. Powód: {reason}` appended when reason is not null. The pair reported is the first match in selection order. Singles are never blocked by exclusions. The server enforces the same rule for AKO only.
14. Duplicate bets in AKO are rejected by the server. The client already prevents them because the coupon keys items by bet id.
15. Success path. `refreshProfile()`, `clearCoupon()` (items empty, preferred tab reset), `onSuccess()` (drawer: saves the AKO stake when on the AKO tab, clears `singleStakes`, closes the sheet), then toast `Kupon postawiony pomyślnie!`.
16. Failure path. If one or more single bets were already placed, those items are removed from the coupon and the profile is refreshed. Then the error message is shown. The fallback message is `Nie udało się postawić kuponu`.
17. Copy flow eligibility (`copyCoupon.ts`): a leg is copied when its result is pending, it has a `bet_id`, the bet exists and is open (`is_active`, `winning_option === null`, `ends_at` after now), the bet is not already copied (dedupe by bet id), and the leg's option exists in the bet's current options with positive odds. Odds come from the current bet options, not from the stored leg odds. Skipped count is returned for the toast.
18. Copy messages: if none can be copied, `Wszystkie zdarzenia z tego kuponu są już niedostępne lub rozliczone`. If the coupon has no bet ids, `Ten kupon nie zawiera zdarzeń możliwych do skopiowania`. On success, `Skopiowano ${formatEventsCount(n)}, pominięto ${formatEventsCount(m)}` when some were skipped, otherwise `Skopiowano kupon: ${formatEventsCount(n)}`. Fetch errors show the error message or `Nie udało się skopiować kuponu`.
19. Polish plural helper (`formatEventsCount`, socialFormatters.ts:24-30): 1 gives `zdarzenie`, counts ending in 2 to 4 (except 12 to 14) give `zdarzenia`, all others give `zdarzeń`.

Tests that act as acceptance fixtures:
- `useCouponPlacement.test.tsx`: two singles with stakes 7 and 8 send two RPCs with `totalOdds: 1`; `10.999` is rejected with the 2-decimal message and no RPC call; AKO split 3.34/3.33/3.33 with `totalOdds` 7.5.
- `CouponDrawer.test.tsx`: `2x` doubles the AKO stake to 20; an exclusion pair blocks `Obstaw` with the Polish message including `Powód: Ten sam mecz`; singles stay enabled when an exclusion pair (reason null) is selected.
- `copyCoupon.test.ts`: current option odds (2.1) are used over stored leg odds (1.95); 9 legs with 8 skipped leave 1 item and `skippedCount` 8.

## Edge cases and gotchas

1. The server ignores `p_total_odds` and `winning_option`. The client `totalOdds` and displayed potential win use stored client odds, which can differ from canonical odds if the bet's options changed after the item was added. Stored items are not refreshed.
2. The server's `winning_option` check is absent. A bet that has a result but is still `is_active` and has a future `ends_at` would accept bets. Whether that state can happen depends on the admin settle path (not read here).
3. Exclusion conflict uses `LIMIT 1` with no ORDER BY. The server can report a different pair than the client does when several pairs conflict. Both block the bet, but the message text can differ.
4. Exclusion fetch is asynchronous. `Obstaw` is enabled until the response arrives, so a user can submit before exclusions load. The server still blocks it, and the error message is shown as a toast. A fetch error also clears exclusions silently, so the client gate opens.
5. Single tab is not atomic. Each bet is a separate RPC. If the third of five fails, the first two are placed and removed from the coupon, and the remaining items stay with their stakes. The error toast shows only the failing message.
6. The RPC has no idempotency key. If the network drops after the server commits, the item stays in the coupon and a retry places it again.
7. AKO tab with one item is placed as a single bet on the server (`total_odds` stored as 1), but the sheet shows the item odds as `Współczynnik` and calculates the potential win from them.
8. The single-tab total is checked against the balance before any RPC call, but each RPC is checked again on the server. If the balance changes between calls, the partial-failure path applies.
9. Client number parsing uses `Number()`, which accepts exponent notation (`1e1` is 10) and surrounding whitespace. The 2-decimal check runs on the same parsed value, so `10.10` is accepted and `10.999` is rejected.
10. The `Max` preset uses `Math.floor(balance * 100) / 100` in floating point. Example: a balance of 1.15 gives `114.99999999999999`, which floors to 114, so Max gives `1.14`.
11. Preset and Max highlighting compares strings. `stake` `'10.00'` does not highlight the `10 zł` preset. `doubleStake` strips a trailing `.00`, so the 2x result is `'20'`.
12. Doubling with an empty or invalid stake resets to `'10'`.
13. Count label (drawer header) is wrong for some numbers. It uses `1` to `zdarzenie`, `2` to `4` to `zdarzenia`, and everything else to `zdarzeń`. This gives `zdarzenia` for 0 (should be `zdarzeń`) and `zdarzeń` for 22 to 24 (should be `zdarzenia`). `formatEventsCount` is correct. See open questions.
14. Single-tab stake inputs use `value={singleStakes[id] ?? ''}`, and a new item starts at `'10'` only through the items effect. Removing an item drops its stake, and the `Cofnij` undo restores the item with stake `'10'`, not the previous value.
15. Remove and `Wyczyść` are not disabled while `placing` is true. The in-flight placement still uses the items captured when it started. Its failure path calls `removeItem` for placed singles, which is safe.
16. Enter in a stake input calls `placeBet` unless `placing`, empty items, insufficient funds, or an AKO conflict block it. Validation toasts still show for invalid stakes.
17. Insufficient-funds notice counts only parsed stakes. An empty single stake counts as 0, so the notice can be absent while `Obstaw` shows a stake toast on click.
18. Input focus selects all text (`selectInputContent`). On phone the stake inputs use 16px text so iOS does not zoom. The sheet has no keyboard avoidance code; it is fixed at the bottom with a fixed height.
19. The mobile sheet closes on X, backdrop, or Escape only. The drag handle is decorative and has no gesture.
20. `open` is local to the drawer and resets when `HomeShell` unmounts. Copying a coupon navigates to `/` and does not open the sheet.
21. Hit targets are small: remove icon about 22 px, header close about 28 px, preset buttons 32 px high, tabs about 30 px high, stake inputs 32 to 36 px high. Expand touch slop to 44 pt in the native build without changing the visual size.
22. Perf-lite (`html.perf-lite`) has no coupon rules (index.css 1777-1788). The sheet uses `backdrop-blur-[2px]` on the backdrop and `backdrop-blur` on the footer, plus the `coupon-drawer-enter` animation, with no plain fallback. AGENTS.md asks for a fallback on heavy glass effects.
23. The drawer is mounted in both `HomeShell` and `JackpotDevFlowPage`. Both mount their own instance, and both read the same context and storage.
24. `display.ts` (`getDisplayedCouponOdds`, `deriveCouponStatus`, `getDisplayedCouponWin`) is used only by social and profile history cards. It is not part of placement.
25. Stored items key is versioned only by the `.v1` suffix. There is no migration function. Corrupt JSON or invalid entries are dropped without a message.
26. `addItem` toasts on each add (`Dodano do kuponu`). `addItems` (copy flow, undo) does not.
27. `maxStake` string is the balance floored to cents and converted with `toString()`, so a balance such as 1000 gives `'1000'` and a balance of 0 disables `Max`.

## Open questions

1. Should the native client show canonical odds before placement (for example by refetching bets on sheet open), or keep the stored odds and accept that the displayed win can differ from the server's?
2. Does the admin settle path always set `is_active` to false when a result is recorded? The server does not check `winning_option`, so this decides whether a settled bet can still be placed.
3. For the AKO exclusion message, should the native client use the first match in selection order (current client behavior) or make the server choice deterministic with an ORDER BY? Changing it is a server migration.
4. Single-tab partial failure: keep the current behavior (earlier bets stay placed, error toast), or make the single tab one atomic RPC? A retry-safe design needs an idempotency key on `place_bet_secure`.
5. Should `Obstaw` wait for exclusions to load (current code does not), and should a failed exclusion fetch block submission instead of opening the gate?
6. Keep the drawer count label bug (`zdarzeń` for 0 and 22 to 24), or use `formatEventsCount` for correct Polish? Recommend the correct rule unless the copy must match the web exactly.
7. AsyncStorage key names: keep `bsplic.coupon.items.v1` and `bsplic.coupon.last-stake` so existing users keep their slip after the rebuild, or rename? Keep the names if migration matters.
8. Is the jackpot dev flow (`JackpotDevFlowPage.tsx:395`) a dev-only surface that the native app should skip?
9. Should the native sheet add swipe-to-dismiss, or keep close-by-button only? The web drag handle is decorative.
10. Sonner undo duration: the web uses the default. Confirm the native undo window.
