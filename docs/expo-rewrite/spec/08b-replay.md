# 08b. Replay (rebuild spec)

Status: draft, in progress. Sections below are filled in order; `TODO` marks unfinished parts.

## Files covered

| Path | Lines |
|---|---|
| src/features/replay/ReplayPage.tsx | 80 |
| src/features/replay/ReplayLaunchCard.tsx | 13 |
| src/features/replay/ReplayHistoryList.tsx | 60 |
| src/features/replay/ReplayChart.tsx | 47 |
| src/features/replay/ReplaySummary.tsx | 52 |
| src/features/replay/ReplayCouponDetails.tsx | 20 |
| src/features/replay/ReplayShare.tsx | 102 |
| src/features/replay/model.ts | 171 |
| src/features/replay/poster.ts | 102 |
| src/features/replay/useReplayHistory.ts | 28 |
| src/features/replay/replay.css | 85 |
| docs/bsplic-replay.md | 52 |

Entry points (grep, src/ excluding replay folder):
- `src/App.tsx:152-158`: route `/replay`, wrapped in `<AuthenticatedRoute>`, element `<ReplayPage />`. `ReplayPage` is `lazy(loadReplayPage)` (`src/App.tsx:33`), loader `src/lib/boot/route-modules.ts:8` = `import("@/features/replay/ReplayPage")`.
- `src/pages/ProfilePage.tsx:22` imports `ReplayLaunchCard`; `src/pages/ProfilePage.tsx:318` renders `{isOwnProfile && <ReplayLaunchCard />}` between `<PlayerCardHero>` and `<ProfileHistoryPanel>`. Only the viewer's own profile shows it.

## Surfaces

### 1. Launch card (profile entry)

- Entry: `ProfilePage` own profile only. Order on the page: PlayerCardHero, ReplayLaunchCard, ProfileHistoryPanel, badges.
- Element: `<Link to="/replay">` (react-router), no fetch, no chart, no CSS import.
- Classes: `app-surface group flex min-h-20 items-center gap-4 rounded-xl p-4 transition-colors hover:border-primary/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`.
- Layout top to bottom (single row, flex, gap 16px, padding 16px, min height 80px):
  1. Icon `ChartNoAxesCombined` size 22, class `shrink-0 text-primary`, aria-hidden.
  2. Text block (`min-w-0 flex-1`): title `Replay` (block, font-semibold); subtitle `Bilans i historia kuponów` (block, mt-0.5, text-sm, muted-foreground).
  3. Icon `ArrowRight` size 18, class `shrink-0 text-muted-foreground group-hover:text-foreground`, aria-hidden.
- Copy (verbatim): `Replay`, `Bilans i historia kuponów`.
- Interaction: whole card is the link; hover border `primary/40`, arrow goes to foreground.

### 2. Replay page shell (`/replay`)

- Route: authenticated only. Signed-out users are sent through `AuthenticatedRoute`.
- `usePageTitle('Replay')`.
- Root: `h-safe-screen bg-background flex flex-col overflow-hidden`, then `<Navbar />`, then `<main className="replay-page min-h-0 flex-1 overflow-y-auto" aria-label="Replay">`.
- Content wrapper: `replay-content mx-auto w-full max-w-5xl px-3 pt-4 sm:px-6 sm:pt-6`.
- State: `period` (`'7' | '30' | 'all'`, default `'30'`), `history = useReplayHistory(user?.id ?? null)`, `model = buildReplay(history.data, period)` memoized on `[history.data, period]` (null until data).
- Header row (`mb-5 flex items-center justify-between gap-3`):
  - Left: ghost icon Button `h-11 w-11`, `asChild` Link to `/profile`, aria-label `Do profilu`, icon `ArrowLeft`; then `<h1>` `Replay`, `text-2xl font-bold tracking-tight sm:text-3xl`.
  - Right: ghost icon Button `h-11 w-11`, aria-label `Odśwież Replay`, title `Odśwież`, disabled while `history.isFetching`, onClick refetch; icon `RefreshCw`. Then `ReplayShare` (only when `model.coupons.length > 0`), `key={user?.id}`, props `model`, `username={profile?.username ?? 'Gracz'}`.
- Period row (`mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-3`):
  - Segmented control `app-subsurface inline-flex rounded-lg p-1`, role group, aria-label `Zakres Replay`. Three buttons, values `7`, `30`, `all`, label from `PERIOD_LABELS` (see model section). Button classes: `min-h-11 rounded-md px-3 text-sm font-semibold transition-colors ... sm:px-4`; selected `bg-foreground text-background shadow-sm`, else `text-muted-foreground hover:text-foreground`; `aria-pressed`.
  - Right: `<p class="text-sm text-muted-foreground">{model.rangeLabel}</p>` when model exists.
- Limited banner (when `model.limited`): `mb-4 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm`, role status, copy `Zakres jest częściowy: pokazujemy najnowsze 200 kuponów.`
- Error banner (when `history.isError`): `mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm`, role alert.
  - Text: with model `Nie udało się odświeżyć danych. Pokazujemy poprzedni zapis.`; without model `Nie udało się wczytać Replay.`
  - Button outline `Spróbuj ponownie`, disabled while fetching, onClick refetch.
- Loading skeleton (when no model and `history.isPending`): `app-surface rounded-xl p-6`, role status, aria-label `Wczytywanie Replay`. Text `Wczytywanie…` (text-sm muted), then aria-hidden bars `mt-4 h-12 w-48 rounded-lg bg-muted` and `mt-6 h-48 rounded-lg bg-muted/50`.
- Body:
  - If `model.coupons.length > 0`: `<ReplaySummary key={`${user?.id}-${period}`} model={model} />` (key resets local state on user or period change).
  - Else empty section: `app-surface rounded-xl px-5 py-12 text-center`, aria-label `Pusty Replay`.
    - `<h2 class="text-lg font-semibold">` `Brak kuponów w tym okresie`.
    - Buttons (centered, gap 12px, wrap): if period is not `all`, outline Button `Zobacz ostatnie kupony` (sets period to `all`); ghost Button asChild Link to `/profile` `Wróć do profilu`.

### 3. Summary card "Bilans" (`ReplaySummary.tsx:15-36`)

- Entry: rendered by `ReplayPage` when `model.coupons.length > 0`; `key={user.id}-{period}`, so changing period or user remounts it (resets chart selection and history filters).
- Wrapper `space-y-5`. Section `app-surface rounded-xl p-5 sm:p-6`, `aria-label="Bilans kuponów"`.
- Elements top to bottom:
  1. `<h2>` `Bilans`, `text-sm font-medium text-muted-foreground`.
  2. Net value `<p>`: class `replay-net mt-1 font-bold tracking-tight tabular-nums`, plus colour when there are settled results: `text-success` if net > 0, `text-destructive` if net < 0, else `text-foreground`. Text: `formatReplayMoney(netCents, true)` (e.g. `+12,50 zł`), or `—` when no settled results.
  3. When no settled results: `<p class="mt-2 text-sm text-muted-foreground">` `Brak rozliczonych kuponów.`
  4. `ReplayChart` (section 4), wrapped in `replay-chart mt-4`.
  5. Stats `<dl>`: `mt-5 grid grid-cols-2 gap-x-5 gap-y-5 border-t border-border pt-5 sm:grid-cols-4`. On a 390px phone this is a 2×2 grid. Each `<dt>` is `text-sm text-muted-foreground`; each `<dd>` is `mt-1 text-lg font-semibold tabular-nums` (`break-words` on money cells).
     - `Stawki rozliczonych`: `formatReplayMoney(stakeCents)` or `—`.
     - `Wypłaty rozliczonych`: `formatReplayMoney(payoutCents)` or `—`.
     - `Wygrane`: `{counts.won}` followed by `<span class="ml-1 text-sm font-normal text-muted-foreground">/ {won + lost}</span>`. Example `3 / 5`.
     - `Skuteczność`: `{winRate}%`, or `—` when `winRate` is null.
  6. Method disclosure: native `<details class="replay-method mt-4 text-sm">`. Summary `Jak liczymy?` plus `ChevronDown` size 14 (aria-hidden). Summary is `inline-flex min-h-10 cursor-pointer items-center gap-1 rounded-md text-muted-foreground hover:text-foreground`. Body `max-w-2xl space-y-2 pb-1 pt-2 leading-relaxed text-muted-foreground`, three paragraphs, verbatim:
     - `Bilans to wypłaty minus stawki rozliczonych kuponów, nie saldo konta. Kupony w grze są pomijane. Skuteczność to wygrane / (wygrane + przegrane); zwroty się nie liczą.`
     - `Wykres pokazuje obecne wyniki w kolejności postawienia, nie historię salda ani dat rozliczeń. Zakres 7 lub 30 dni oznacza ostatnie 7 × 24 lub 30 × 24 godziny od pobrania danych. Daty: Europe/Warsaw.`
     - `Tylko zakłady za wirtualne zł, bez kasyna, wpłat i transferów. Maksymalnie 200 najnowszych kuponów. {coverageLabel}.` (coverageLabel is `Część historii · limit 200 kuponów` or `Pełny dostępny zakres`.)
- Styling: `app-surface` (shared surface token), radius `rounded-xl` (12px in Tailwind), padding 20px (mobile) / 24px (≥640px).

### 4. Chart (`ReplayChart.tsx`)

- Data: `replayChart(model.timeline.map(e => e.cumulativeCents))`. The values are cumulative net in cents. The chart normalises them, so the unit doesn't matter for the drawing.
- Empty state (no timeline entries, i.e. only pending coupons): `<p class="py-10 text-sm text-muted-foreground">` `Wykres pojawi się po rozliczeniu kuponów.`
- SVG: `viewBox="0 0 1000 320" preserveAspectRatio="none" role="img" aria-label="Bilans kuponów w kolejności postawienia"`. Because of `preserveAspectRatio="none"` the SVG is stretched to the container. The 6px circle becomes an ellipse when the aspect ratio is not 1000:320.
  - Gradient `linearGradient` (id `{useId}-fill`, vertical, `currentColor` at 14% opacity at top to 0% at bottom).
  - Fill path: `{chart path} L976,{zeroY} L24,{zeroY} Z`, filled with the gradient.
  - Zero line: `<line x1=24 x2=976 y=zeroY class="replay-zero">`.
  - Curve: `<path class="replay-line">` with the chart path.
  - Cursor: vertical `<line x=point.x y1=20 y2=300 class="replay-cursor">`.
  - Dot: `<circle r=6 fill="currentColor">` at the selected point.
- Selection: default is the last timeline entry (newest settled coupon). The state is `selectedId` (a coupon id), not an index. If the id is gone after a refresh, it falls back to the last entry.
- Mouse hover/move (`onPointerMove`, only when `pointerType === 'mouse'`): `fraction = ((clientX - left) / width * 1000 - 24) / 952`, index = `clamp(round(fraction * count) - 1, 0, count - 1)`. Touch and pen don't use this; they use the range input.
- Scrubber: `<input type="range" class="replay-scrubber" min=0 max=count-1 value=selected disabled={count < 2}>`. Its `<label class="sr-only">` is `Wybierz kupon na wykresie`. `aria-valuetext` = `{date}, {STATUS}, bilans {+cumulative zł}`.
- Readout: `<output class="flex min-h-8 flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">`. Left: `{date} · {STATUS_LABELS[status]}` in muted text. Right: `formatReplayMoney(cumulativeCents, true)` in `font-semibold tabular-nums text-foreground`. This is the running net through the selected coupon, not a balance.
- Interaction: the hover/drag changes only the readout and dot. No click action.
- Motion: none in the SVG code. Any transition lives in `replay.css` (see CSS section, TODO).

### 5. Highlight card (`ReplaySummary.tsx:38-47`)

- Position: first column of a grid `items-start gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.6fr)]`. Below 1024px it's one column, so the card sits above the history list.
- Only rendered when `model.highlight` is set (always true when the summary renders).
- Section `app-surface min-w-0 rounded-xl p-5`. `aria-label` and `<h2 class="text-base font-semibold">` are `Najwyższa wypłata` when the highlight status is `won`, otherwise `Ostatni kupon`.
- Elements top to bottom:
  1. Row `mt-4 flex items-center justify-between gap-2 text-xs`: date `text-muted-foreground`, and status `<span class="replay-status font-medium" data-status={status}>` with `STATUS_LABELS`.
  2. Title `mt-3 break-words text-base font-semibold`: `legs[0].bet_title` or `Kupon`.
  3. Amount `mt-2 break-words text-2xl font-bold tabular-nums`: `—` if pending, else `formatReplayMoney(round(payout*100))` (unsigned), followed by `<span class="sr-only"> wypłaty</span>`.
  4. `mt-4 border-t border-border pt-4` wrapping `ReplayCouponDetails`.

### 6. History list (`ReplayHistoryList.tsx`)

- Position: second column (below the highlight card on phones). Section `app-surface min-w-0 rounded-xl`, `aria-label="Kupony"`.
- State: `filter` (`all|won|lost|pending|refund`, default `all`) and `limit` (default 20). Changing the filter resets `limit` to 20.
- Header row `flex items-center justify-between gap-3 px-5 pt-5`: `<h2 class="text-base font-semibold">` `Kupony` followed by `<span class="ml-1 font-normal text-muted-foreground">{model.coupons.length}</span>` (total in period, unfiltered). Right side: `<span class="text-sm text-muted-foreground">` `Wypłata`.
- Filter group: `role="group" aria-label="Filtr kuponów"`, `replay-filters mx-5 my-4 flex gap-1 overflow-x-auto pb-1` (horizontal scroll on phones). Buttons are `min-h-11 shrink-0 rounded-full px-3 text-sm font-medium`, with `aria-pressed`.
  - Labels: `Wszystkie`, `Wygrane`, `Przegrane`, `W grze`, `Zwroty`.
  - Selected: `bg-foreground text-background`. Unselected: `text-muted-foreground hover:bg-muted hover:text-foreground`.
  - Non-`all` buttons add `<span class="ml-1.5 tabular-nums">{model.counts[value]}</span>`. Counts are period-wide, not filtered.
- Rows: newest first (`coupons.slice().reverse()`), filtered, then cut to `limit`. `<ul class="divide-y divide-border border-t border-border">`, keyed by coupon id.
- Empty filtered result: `<p class="px-5 pb-6 text-sm text-muted-foreground" role="status">` `Brak kuponów z tym wynikiem.`
- Pager (shown only when filtered count > 20): footer `flex flex-wrap items-center justify-between gap-2 border-t border-border p-3`. Text `{visible} z {filtered}` in `px-2 text-sm text-muted-foreground`. Ghost button `Pokaż więcej` (adds 20) while `limit < count`, otherwise ghost button `Pokaż mniej` (resets to 20).

Row (`CouponRow`):
- `<li><details class="replay-coupon-row group">`. Native disclosure, so keyboard and open/close need no JS.
- Summary `grid min-h-20 cursor-pointer grid-cols-[minmax(0,1fr)_auto_16px] items-center gap-3 px-5 py-4 hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring`.
  - Column 1: title `block truncate text-sm font-semibold` (`legs[0].bet_title` or `Kupon`). Below it `mt-1 block text-xs text-muted-foreground`: `{date}`, plus ` · AKO {legs.length}` when there are 2 or more legs.
  - Column 2 (right aligned, `flex flex-col items-end gap-1`): status `replay-status text-xs font-medium` with `data-status`, then amount `text-sm font-semibold tabular-nums` (`—` if pending, else payout unsigned, with a `sr-only` ` wypłaty`).
  - Column 3: `ChevronDown` size 16 (`text-muted-foreground`, `group-open:rotate-180`).
- Body `border-t border-border bg-muted/20 px-5 py-4` with `ReplayCouponDetails`.

### 7. Coupon details (`ReplayCouponDetails.tsx`)

- Used in the highlight card and inside each history row.
- `div.replay-coupon-details`. Top `<dl class="grid grid-cols-2 gap-4 text-sm">`:
  - `Stawka` → `formatReplayMoney(round(stake*100))` (unsigned), `font-semibold tabular-nums`.
  - `Kurs łączny` → `×{total_odds.toFixed(2)}`.
- Legs: if `legs` is non-empty, `<ul class="mt-4 divide-y divide-border">`, each `<li class="py-3 first:pt-0 last:pb-0">` with:
  - `<p class="break-words text-sm font-medium">` `leg.bet_title` or `Wydarzenie`.
  - `<p class="mt-1 break-words text-sm text-muted-foreground">` `{selected_option} · ×{odds_at_time.toFixed(2)} · {STATUS_LABELS[leg.result]}`.
- If `legs` is null or empty: `<p class="mt-4 text-sm text-muted-foreground">` `Brak szczegółów tego kuponu.`
- No links, no actions.

TODO: section 8 (share dialog) after ReplayShare.tsx is read; section 9 (CSS translation) after replay.css is read.

## Data contract

TODO

## Business rules

Source: `src/features/replay/model.ts` (all 171 lines). All money is handled in integer cents after parsing; display divides by 100.

### Constants and labels
- `REPLAY_LIMIT = 200`.
- `ReplayPeriod = '7' | '30' | 'all'`. `PERIOD_LABELS`: `'7'` → `7 dni`, `'30'` → `30 dni`, `'all'` → `Ostatnie kupony`.
- `STATUS_LABELS`: `won` → `Wygrany`, `lost` → `Przegrany`, `pending` → `W grze`, `refund` → `Zwrot`.

### Parsing (`parseReplayHistory(input, capturedAt = Date.now())`)
- `z.array(couponSchema).parse(input)`; any invalid row throws (page shows the error state).
- Coupon schema (zod): `id` non-empty string; `total_odds` numeric; `stake` and `payout` "money"; `status` enum `won|lost|pending|refund`; `created_at` string that must end in `Z` or `±HH:MM` and be parseable by `Date.parse`; `legs` array or null, each leg `{id: string, bet_id?: string|null, selected_option: string, odds_at_time: numeric, result: status, bet_title: string|null}`.
- "numeric": a string is converted with `Number()` when `trim() !== ''`; the result must be finite and `>= 0`.
- "money": numeric, plus `Math.round(value*100)` must be a safe integer, and `value <= MAX_SAFE_INTEGER / (200*100)`.
- Dedupe by `id` (Map, last occurrence's value wins). Sort by `created_at` descending, tie-break `id` ascending. Keep the first 200.
- `hasMore = rawRows.length > 200`. This counts rows BEFORE dedupe.
- Unknown keys are stripped by zod (default object behaviour).

### Period filter (`buildReplay(history, period)`)
- `cutoff = period === 'all' ? -Infinity : capturedAt - N * 86_400_000` (N = 7 or 30). These are rolling 24-hour windows measured from capture time, not calendar days.
- Included coupons: `cutoff <= created_at <= capturedAt`, then sorted ascending by `created_at`, tie-break `id` ascending.
- `oldest` = last element of the newest-first list (the oldest retained coupon).
- `limited = hasMore && (oldest is missing || oldest.created_at >= cutoff)`. This is true only when the response was truncated and the retained window still reaches into the selected period.

### Aggregation (over the filtered, ascending list)
- `counts[status]` counts all statuses, including pending.
- `highlight`: the `won` coupon with the largest `payout` (ties go to the later coupon in ascending order, since the comparison is `>=`). If there is no won coupon, `highlight` is the newest coupon (last in ascending order). `null` only if the list is empty.
- Only non-pending coupons go into money and the timeline. For each: `stakeCents = round(stake*100)`, `payoutCents = round(payout*100)`, `netCents = payoutCents - stakeCents`, `cumulativeCents` = running sum of net in ascending order. Refund coupons are included with their recorded stake and payout.
- `stakeCents`, `payoutCents`, `netCents = payoutCents - stakeCents` are sums over non-pending coupons only.
- `settledCount = timeline.length` (non-pending, refunds included).
- `activeDays` = number of distinct Europe/Warsaw calendar days among ALL coupons in the period, pending included.
- `winRate = decided ? Math.round(won / (won + lost) * 100) : null`. Refunds and pending are excluded from the denominator. With only refunds/pending, `winRate` is `null` (no fake 0%).

### Labels
- `rangeLabel`: when coupons exist, `"{date of oldest} — {date of newest}"` using an em dash (U+2014) with spaces. When empty, `"Stan na {date of capturedAt}"`.
- `coverageLabel`: `limited` → `Część historii · limit 200 kuponów` (with a middle dot U+00B7); otherwise `Pełny dostępny zakres`.
- `formatReplayDate(value)`: `Intl.DateTimeFormat('pl-PL', {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Warsaw'})`. Output is a short Polish month, for example `21 paź 2026`. The exact string is ICU-dependent.
- `formatReplayMoney(cents, signed = false)`: `Intl.NumberFormat('pl-PL', {minimumFractionDigits: 2, maximumFractionDigits: 2})` applied to `cents/100`, then `" zł"`. A `+` prefix is added only when `signed && cents > 0`. Zero and negative values have no `+`. Polish grouping uses U+00A0, decimal comma. The ICU minimum grouping digits for `pl` is 2, so 1234 is `1234,00` and 12345 is `12 345,00`. The app relies on Intl, so the rebuild must use the same CLDR data.

### Chart math (`replayChart(values: number[])`)
- `series = [0, ...values]`. `min = min(0, ...series)`, `max = max(0, ...series)`, `span = max - min || 1`.
- `y(v) = (max === min) ? 160 : 280 - (v - min) / span * 240`. So min maps to y=280, max to y=40, and the zero line is `zeroY = y(0)`.
- `x(i) = 24 + i / max(1, series.length - 1) * 952`. The x range is 24 to 976, so the design space is 1000 wide with x-padding 24.
- `path = "M x,y L x,y …"` with 2 decimal places. The first command is `M`, the rest `L`.
- With no values, `series = [0]`, so a single point at `(24, 160)`.
- `values` is the cumulative net series in the chart's input units; the chart component decides which (see chart section, TODO).
- Stated intent: the curve is coupon-order performance, not a wallet balance.

## Poster

TODO

## Edge cases & gotchas

TODO

## Open questions

TODO
