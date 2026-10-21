# 08a Profile (own `/profile`, public `/profile/:userId`)

Target: phones (web layout below 1024px). Desktop-only parts are noted inline.

Desktop-only (`lg:`): one occurrence, `ProfileBadgesSection.tsx:23` (`lg:grid-cols-3`, badges in 3 columns at 1024px and up). The `sm:` rules (640px and up) are noted inline in S3, S4 and S5.

## Files covered

| Path | Lines |
|---|---|
| src/pages/ProfilePage.tsx | 326 |
| src/features/profile/api/profileQueries.ts | 129 |
| src/features/profile/components/ProfileBadgesSection.tsx | 82 |
| src/features/profile/components/ProfileHistoryPanel.tsx | 421 |
| src/features/profile/hooks/useProfileHistory.ts | 253 |
| src/features/player-card/components/PlayerCardHero.tsx | 114 |
| src/features/player-card/displayModel.ts | 49 |

Referenced, not covered here: `src/features/social/images` (`compressImageFile`), `src/components/Navbar`, `src/features/replay/ReplayLaunchCard`, `src/contexts/AuthContext`, `src/lib/query-client` (`PAGE_DATA_QUERY_OPTIONS`).

## Surfaces

### S1. Profile page shell (`ProfilePage.tsx`)

Entry: route `/profile` (own) and `/profile/:userId` (public). `usePageTitle("Profil")`.

**Target resolution** (`ProfilePage.tsx:29-98`)
- `userRef` = `decodeURIComponent(useParams().userId)`.
- No ref: target = `user.id`, own = true.
- Ref equals `user.id`: target = `user.id`, own = true.
- Ref matches UUID regex `^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$` (case-insensitive): target = ref, no request.
- Otherwise username: `profiles.select("id").ilike("username", ref).limit(1).maybeSingle()`; `data?.id ?? null`. `error` is ignored.
- `resolvingTarget` starts `Boolean(ref)`; while true the page renders `null` (`:145`), with no Navbar and no loader. See Edge cases 11-12.
- `isOwnProfile = !ref || (target !== null && target === user?.id)` (`:99-100`).
- Own and not (`user` && `profile`) → `<Navigate to="/" />` (`:146`).

**Layout at 390px** (container `h-safe-screen bg-background overflow-hidden flex flex-col`, `Navbar` on top, scroller `flex-1 min-h-0 overflow-y-auto`, content `max-w-4xl mx-auto p-4 space-y-4`), top to bottom:
1. Header card (`app-surface rounded-xl p-6`), see S2.
2. `PlayerCardHero` (S3).
3. `ReplayLaunchCard` (own profile only; component not covered here).
4. `ProfileHistoryPanel` (S5/S6).
5. `ProfileBadgesSection` (S4), rendered when `targetUserId` is set (also for others).

**Loading (public profile only)**: when `!isOwnProfile && publicQuery.isPending`, renders Navbar + `<SectionLoader label="Wczytywanie profilu..." />` inside `max-w-4xl mx-auto p-4`, same outer container.

**Share URL**: `getShareableProfileUrl()` = `new URL(window.location.pathname, window.location.origin)`. Passed to PlayerCardHero as `profileUrl`. For own profile this is `origin/profile`, not a userId URL.

**Header card (S2)**
- Row: left group `flex items-center gap-3`; right (own only) balance block.
- `Avatar` `h-14 w-14 border border-border`. `AvatarImage` `src = displayAvatarUrl ?? undefined`, `alt = "Avatar " + displayName`. `AvatarFallback` `text-base font-bold`, content `displayName.charAt(0).toUpperCase()`.
- `h1` `text-2xl font-bold` = displayName.
- `p` `text-sm text-muted-foreground`: `Dołączył: {displayDate}`; for public profile, appended `<span class="ml-2 text-xs bg-muted px-2 py-0.5 rounded-full">Profil publiczny</span>`.
- Balance (own only): `p` "Saldo" `text-sm text-muted-foreground`; value `text-2xl font-bold text-primary` = `Number(profile.balance).toFixed(2) + " zł"`.
- Avatar upload (own only), `mt-3`: `<label htmlFor="profile-avatar-input">` class `inline-flex cursor-pointer items-center rounded-md bg-muted px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted/80`. Text: `Przesyłanie...` while loading, else `Wybierz zdjęcie profilowe`. Hidden `<input id="profile-avatar-input" type="file" accept="image/*" class="sr-only" disabled={loading}>`.

**Avatar upload pipeline** (`handleAvatarChange`, `:173-236`)
1. Guard: not own or no user/profile → return.
2. No file → return.
3. `!file.type.startsWith("image/")` → `toast.error("Wybierz plik obrazu")`, reset input value, return.
4. `setAvatarUploadLoading(true)`.
5. `compressImageFile(file, { maxDimension: 640, targetBytes: 135 * 1024, absoluteMaxBytes: 140 * 1024, minDimension: 256 })` → `{ blob }`.
6. Path: `` `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg` ``.
7. `storage.from("profile-avatars").upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false })`. Error → `throw new Error(uploadError.message)`.
8. `storage.from("profile-avatars").getPublicUrl(path)` → `publicUrl`.
9. `profiles.update({ avatar_url }).eq("id", user.id)`. Error → throw.
10. `setAvatarOverrideUrl(url)`; `await refreshProfile()`; `toast.success("Zdjęcie profilowe zaktualizowane")`.
11. catch: `toast.error(error instanceof Error ? error.message : "Nie udało się zaktualizować zdjęcia profilowego")`.
12. finally: `setAvatarUploadLoading(false)`, `event.target.value = ""`.

### S3. Player card hero (`PlayerCardHero.tsx`, props `{model, profileName, profileUrl}`)

Entry: `ProfilePage` renders it for both own and public profiles. `<section aria-label="Karta gracza" class="player-card-hero card-shadow rounded-2xl border border-amber-200/20 p-4 text-white sm:p-5">`, inner `relative z-10 space-y-4`. Dark gold card (background comes from the `.player-card-hero` class, not read here).

Layout at 390px, top to bottom:
1. Row (stacked on phone, `sm:flex-row sm:justify-between`):
   - Left: `<p>` "Karta gracza" class `text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-100/70`; `<h2>` = `model.archetype.label`, class `mt-1 text-xl font-black tracking-tight sm:text-2xl`.
   - Right (`flex flex-wrap items-center gap-2`): pill `<span>` "Sportsbook" (`w-fit rounded-full border border-amber-100/20 bg-white/10 px-3 py-1 text-xs font-semibold text-amber-50`); button `type=button` class `inline-flex items-center gap-1.5 rounded-full border border-amber-100/20 bg-white/10 px-3 py-1 text-xs font-semibold text-amber-50 transition-colors hover:bg-white/15` with `<Share2 className="h-3.5 w-3.5" />` (lucide `Share2`) + text "Udostępnij profil".
2. Metrics grid `grid gap-2 sm:grid-cols-3` (3 tiles, stacked on phone). Each tile `rounded-xl border border-white/10 bg-black/20 p-3`; label `text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-100/65`; value `mt-1 text-xl font-black tracking-tight`:
   - "Zysk": `formatProfit(profit)`, value class `text-emerald-300` if `profit >= 0` else `text-rose-200`.
   - "Win rate": `` `${winRate.toFixed(1)}%` `` class `text-white`.
   - "Seria": `currentStreak.toString()` class `text-amber-100`.
3. Two tiles `grid grid-cols-2 gap-2`, each `rounded-xl border border-white/10 bg-white/5 p-3`; label as above; value `mt-1 text-lg font-bold`:
   - "Kupony" = `totalCoupons` (= `totalBets`).
   - "Wygrane" = `wins`.

Copy: "Karta gracza", "Sportsbook", "Udostępnij profil", "Zysk", "Win rate", "Seria", "Kupony", "Wygrane".

**Share** (`handleShareProfile`):
- If `typeof navigator.share === 'function'`: `navigator.share({ title: "Profil " + profileName, text: "Sprawdź profil gracza " + profileName, url: profileUrl })`; success → `toast.success("Profil udostępniony")`; error with `name === "AbortError"` → silent return; other error → `toast.error("Nie udało się udostępnić profilu")`.
- Else: `navigator.clipboard.writeText(profileUrl)` → `toast.success("Link do profilu skopiowany")`; catch → `toast.error("Nie udało się skopiować linku do profilu")`.

**Formatting**
- `formatProfit(p)`: `(p >= 0 ? "+" : "") + p.toFixed(2) + " zł"`. Zero renders `+0.00 zł`. Negative keeps `-`.
- Win rate: `toFixed(1)` + `%`. The RPC `win_rate` is already a 0–100 percentage (`ROUND(won / resolved * 100, 1)`, 0 when no resolved bets), so no ×100 in the client. See Business rules.

**Archetype** (`displayModel.ts`, `derivePlayerCardDisplayModel`):
- Input `SportsbookSummary { totalBets, wins, winRate, totalProfit, currentStreak }`. Output `{ profit, winRate, currentStreak, totalCoupons: totalBets, wins, archetype }`.
- `deriveArchetype` in order (first match wins):
  1. `totalProfit > 0` → key `na-plusie`, label "Na plusie".
  2. `currentStreak >= 3` → `na-fali`, "Na fali".
  3. `totalBets >= 25` → `weteran-kuponow`, "Weteran kuponów".
  4. else → `nowy-gracz`, "Nowy gracz".
- `ProfilePage` feeds it `rankingStats?.<field> ?? 0` and `displayStreak`. A missing stats row therefore yields zeros, and the archetype depends only on the streak: "Na fali" at 3 or more, otherwise "Nowy gracz".

### S4. Badges (`ProfileBadgesSection.tsx`, props `{badges: Badge[]}`)

Entry: `ProfilePage` bottom, when `targetUserId` set. `<section aria-label="Odznaki" class="app-surface rounded-xl p-4">`, heading `<h2 class="font-bold mb-3">Odznaki</h2>`.

Grid: `<ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">`. Phone = 1 column. Lists all 15 `BADGE_DEFINITIONS` in object order, locked and unlocked alike (catalog, not just owned).

Per item `<li aria-label={definition.name}>`, class `rounded-xl p-3 transition-all` plus `app-subsurface` and, if unlocked, `ring-1 ring-primary/25`.
- Row `flex items-start gap-3`.
- Icon box `flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border`: unlocked `border-primary/20 bg-background`; locked `border-border bg-muted/40`.
- `<img src={imageSrc} alt={"Odznaka " + name} loading="lazy" decoding="async" class="h-14 w-14 object-contain">`; locked adds `grayscale opacity-60`.
- Text column `min-w-0`: name `text-sm font-semibold leading-tight`; description `mt-1 text-xs leading-relaxed text-muted-foreground`; status `mt-2 text-xs font-medium`, unlocked `text-primary` with `` `Odblokowano: ${dd.mm.yyyy}` `` (Intl pl-PL, day/month 2-digit, year numeric), locked `text-muted-foreground` with "Nieodblokowana".
- Unlock lookup: `badges.find(b => b.badge_key === key)`; key = catalog key.

Badge catalog (`src/types/database.ts:293-309`, key → image, name, description):
| key | image | name | description |
|---|---|---|---|
| debiutant | /badges/debiutant.png | Debiutant | Pierwszy postawiony zakład |
| trafiony | /badges/trafiony.png | Trafiony zakład | Pierwszy wygrany zakład |
| kuponista | /badges/kuponista.png | Kuponista | Pierwszy kupon AKO |
| goraca_passa | /badges/goraca_passa.png | Gorąca passa | 3 wygrane z rzędu |
| nie_do_zatrzymania | /badges/nie_do_zatrzymania.png | Nie do zatrzymania | 5 wygranych z rzędu |
| mistrz_serii | /badges/mistrz_serii.png | Mistrz serii | 10 wygranych z rzędu |
| pierwszy_tysiac | /badges/pierwszy_tysiac.png | Pierwszy tysiąc | Łączne wygrane powyżej 1000 zł |
| wieloryb | /badges/wieloryb.png | Wieloryb | Pojedynczy zakład na 500 zł lub więcej |
| ryzykant | /badges/ryzykant.png | Ryzykant | Kupon AKO z 5+ wydarzeniami |
| analityk | /badges/analityk.png | Analityk | Win rate powyżej 60% (min. 20 zakładów) |
| staly_bywalec | /badges/staly_bywalec.png | Stały bywalec | Seria 7 dni |
| legenda | /badges/legenda.png | Legenda | Seria 30 dni |
| pomyslodawca | /badges/pomyslodawca.png | Pomysłodawca | Pierwsza zaakceptowana propozycja |
| wszechstronny | /badges/wszechstronny.png | Wszechstronny | Zakłady w 4+ kategoriach |
| multi_fan | /badges/multi_fan.png | Multi-fan | 10 kuponów AKO |

Image files live in `public/badges/` (these are the paths; the files themselves not inspected).

### S5. History panel shell (`ProfileHistoryPanel.tsx`, 421 lines, props `{history: ProfileHistoryState}`)

Entry: `ProfilePage` renders it after the player card (and after `ReplayLaunchCard` on own profile). Card: `app-surface rounded-xl p-4`.

Header row `mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between` (stacked on phone):
- `<h2 class="font-bold">Historia</h2>`.
- Segmented switch `app-subsurface inline-flex w-max items-center rounded-lg p-1`, two buttons `type=button`, class `rounded-md px-3 py-1.5 text-xs font-semibold transition-colors`. Active: `bg-primary text-primary-foreground shadow-sm`. Inactive: `text-muted-foreground hover:bg-primary/10 hover:text-foreground`. Options: "Zakłady" (sportsbook), "Kasyno" (casino). Switching calls `setHistoryType`.

**Sportsbook view** (`SportsbookHistory`):
- Filter chips: horizontal scroller `-mx-1 mb-3 px-1 overflow-x-auto scrollbar-hide touch-pan-x`, inner `flex w-max min-w-full gap-2 pb-1 pr-1`. Five chips, each `press-scale shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200`. Active: `bg-foreground text-background shadow-md`. Inactive: `border border-border/70 bg-muted/60 text-muted-foreground hover:border-primary/30 hover:text-foreground`. Labels in order: "Wszystkie" (all), "Wygrane" (won), "Przegrane" (lost), "W toku" (pending), "Zwroty" (refund). Note: the chip buttons have no `type` attribute.
- Filtering is client-side (`deriveSportsbookCouponRows(visibleCoupons, filter)`) over the visible slice only. A filter can hide everything from the loaded set while `hasMore` still says more exist.
- Body states:
  - `loadingCoupons` → `<HistorySkeleton />` (defined below in the file).
  - `sportsbookHistoryError` → `<p class="text-sm text-destructive text-center py-4">` with "Nie udało się załadować historii zakładów" (`useProfileHistory.ts:143`).
  - No filtered rows → `<p class="text-sm text-muted-foreground text-center py-4">Brak zakładów</p>`.
  - Else → list `space-y-2` of `SportsbookCouponRow` (key = `coupon.id`).
- Footer buttons (`mt-3 flex gap-2`), shown only when `!loading && !error && coupons.length > 0 && (expanded || coupons.length > 10 || hasMore)`:
  - "Pokaż mniej" (only when expanded): `flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted`, calls `collapseSportsbookHistory`.
  - "Pokaż więcej" (when `!expanded || hasMore`): same classes plus `disabled:cursor-wait disabled:opacity-70`, `disabled={loadingMoreCoupons}`, label `Ładowanie...` while loading. Calls `showMoreSportsbookHistory`.
  - Both buttons sit side by side in a `flex gap-2` row, `flex-1` each.

### S5b. Sportsbook coupon row (`SportsbookCouponRow`, same file)

- Shown when `coupon.legs !== null && legs.length > 1` ("AKO" coupon). Single bet: `ako = false`.
- Outer `app-subsurface rounded-lg overflow-hidden`. Header `<button type=button class="flex items-center justify-between p-3 w-full text-sm text-left">` calls `onToggle` only when `ako` (single bets are not expandable).
- AKO header (`ako` only, `:205-218`): badge `inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary` reads `AKO {legs.length}`; next to it `font-medium text-xs text-muted-foreground` reads `kurs {displayedOdds.toFixed(2)}`; then `ChevronUp` when expanded, else `ChevronDown`, both `h-3.5 w-3.5 text-muted-foreground` (lucide).
- Single bet header (`:219-228`): `<p class="font-medium truncate">` = `legs[0].bet_title || "Zakład"`; `<p class="text-xs text-muted-foreground">` = `{legs[0].selected_option} • kurs {displayedOdds.toFixed(2)}`. When `legs` is `null` the first `p` shows "Zakład" and the second renders ` • kurs X.XX` with an empty selection (the `?.` chain yields nothing).
- Derived inputs (`ProfileHistoryPanel.tsx:178-195`): `ako = legs !== null && legs.length > 1`. `legs` is normalised with `?? []` for the calculations. `displayedOdds = getDisplayedCouponOdds({ totalOdds: Number(total_odds), legs: legs.map(oddsAtTime: Number(odds_at_time), result) })`. `displayedWin = getDisplayedCouponWin({ status, isAko: ako, stake: Number(stake), displayedOdds, couponPayout: Number(payout), legs: legs.map(legPayout: Number(leg_payout ?? 0)) })`. Formulas are in Business rules.
- `status` is the value after `deriveCouponStatus` (see Business rules), not the raw server status. The filter and the status line both use this derived value.

**Stake and status block** (right side, `:232-251`):
- Stake: `{Number(stake).toFixed(2)} zł`, `font-bold`.
- Status line (`text-xs font-medium`):
  - `won` → `+{displayedWin.toFixed(2)} zł`, `text-success`.
  - `lost` → "Przegrana", `text-destructive`.
  - `refund` → `Zwrot {displayedWin.toFixed(2)} zł`, `text-primary`.
  - otherwise → "W toku", `text-muted-foreground`.

**Expanded legs** (AKO only, when `expanded`, `:256-295`): container `border-t border-border px-3 pb-3 pt-2 space-y-1.5`. Each leg is a row `flex items-center justify-between text-xs`:
- Left: `truncate font-medium` = `bet_title || "Zakład"`; below or beside it `text-muted-foreground` = `{selected_option} • kurs {Number(odds_at_time).toFixed(2)}`. Note: the leg's own `odds_at_time`, not the coupon's `displayedOdds`.
- Right: result pill `ml-2 shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded`:
  - `won` → "Wygrana", `bg-success/10 text-success`.
  - `lost` → "Przegrana", `bg-destructive/10 text-destructive`.
  - `refund` → "Zwrot", `bg-primary/10 text-primary`.
  - otherwise → "W toku", `bg-muted-foreground/10 text-muted-foreground`.
- Leg results are raw per-leg values from the RPC, not derived.

### S6. Casino history view (`CasinoHistory`, same file, `ProfileHistoryPanel.tsx:300-402`)

Shown when `historyType === "casino"`. No filter chips; the filter state applies only to sportsbook.

Body states, checked in this order:
- `loadingCasinoHistory` → `<HistorySkeleton />`: `<SectionLoader size="sm" label="Wczytywanie historii..." />`, which holds the boot splash through `useBootHold()`.
- `casinoHistoryError` → `<p class="text-sm text-destructive text-center py-4">` with "Nie udało się załadować historii kasyna".
- Merged list empty → `<p class="text-sm text-muted-foreground text-center py-4">Brak betów z kasyna</p>`.
- Else → `space-y-2` list of visible rows, key = `entry.id`. Visible = first 10 (`HISTORY_PREVIEW_SIZE`) unless `casinoHistoryExpanded`.

Row (`app-subsurface flex items-center justify-between rounded-lg p-3 text-sm`):
- Left (`min-w-0 flex-1`, `flex items-center gap-2`):
  - `<p class="font-medium truncate">` = `game_type`.
  - Optional `round_label`: `shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary`.
  - Optional `bet_label`: `text-xs text-muted-foreground truncate`.
- Right:
  - Stake: `{stake.toFixed(2)} zł`, `font-bold`.
  - Status (`text-xs font-medium`):
    - `won` → `+{payout.toFixed(2)} zł`, `text-success`. This is the gross payout, not profit.
    - `lost` → "Przegrana", `text-destructive`.
    - `push` → `Zwrot {payout.toFixed(2)} zł`, `text-primary`.
    - otherwise → "W toku".

Footer (`mt-3 flex gap-2`), shown when `!loadingCasinoHistory && !casinoHistoryError && casinoHistory.length > 0 && (casinoHistoryExpanded || casinoHistory.length > 10 || hasMoreCasinoHistory)`. Same shape and copy as the sportsbook footer (S5): "Pokaż mniej" when expanded (`collapseCasinoHistory`); "Pokaż więcej" when `!expanded || hasMoreCasinoHistory`, `disabled={loadingMoreCasinoHistory}`, "Ładowanie..." while loading (`showMoreCasinoHistory`).

Casino statuses come from the RPC as `pending | won | lost | push`. There is no `deriveCouponStatus` step here. A casino push is shown as "Zwrot", the same copy as a sportsbook refund, but it uses a different status value.

## Data contract

### Supabase calls in ProfilePage.tsx
| Call | Params / columns | Notes |
|---|---|---|
| `from("profiles").select("id").ilike("username", ref).limit(1).maybeSingle()` | username = raw ref (no escaping of `%`/`_`) | Username resolution, `:78-83` |
| `storage.from("profile-avatars").upload(path, blob, {contentType:"image/jpeg", cacheControl:"31536000", upsert:false})` | path `{userId}/{ms}-{rand6}.jpg` | `:196-202` |
| `storage.from("profile-avatars").getPublicUrl(path)` | | `:208-210` |
| `from("profiles").update({avatar_url}).eq("id", user.id)` | | `:214-217` |

### Query factories (`profileQueries.ts`)
All spread `PAGE_DATA_QUERY_OPTIONS` (from `src/lib/query-client`).

| Factory | Query key | RPC | Params | Returned shape / mapping |
|---|---|---|---|---|
| `profileBadgesQuery(userId)` | `["profile", userId, "badges"]` | `get_public_badges` | `{p_user_id}` | `Badge[] ?? []` (`:53-64`) |
| `profileStatsQuery(userId)` | `["profile", userId, "stats"]` | `get_user_stats` | `{p_user_id}` | `data[0]` → `toRankingStats`, else `null` (`:67-78`) |
| `publicProfileQuery(userId)` | `["profile", userId, "public"]` | `get_public_profile` | `{p_user_id}` | `PublicProfile ?? null` (`:80-91`) |
| `sportsbookHistoryPreviewQuery(userId)` | `["profile", userId, "history", "sportsbook"]` | `get_user_coupon_history` | `{p_user_id, p_limit: 11, p_offset: 0}` | `{entries: first 10, hasMore: length > 10}` (`:93-110`) |
| `casinoHistoryPreviewQuery(userId)` | `["profile", userId, "history", "casino"]` | `get_user_casino_history` | `{p_user_id, p_limit: 11, p_offset: 0}` | same; entries through `toCasinoHistoryEntries` (`:112-129`) |

Constants: `HISTORY_PREVIEW_SIZE = 10` (`profileQueries.ts:11`), fetch limit = 11 (`profileQueries.ts:12`).

Page-level wiring (`ProfilePage.tsx:108-121`):
- badges: `enabled: Boolean(targetUserId)`.
- own stats: `profileStatsQuery`, `enabled: targetUserId && isOwnProfile`.
- public: `publicProfileQuery`, `enabled: targetUserId && !isOwnProfile`.

Type helpers:
- `RankingStats { totalBets, wins, losses, winRate, totalProfit }` (numbers).
- `toRankingStats(row)` maps `total_bets, won_bets, lost_bets, win_rate, total_profit` through `Number()`.
- `toCasinoHistoryEntries(data)` maps `stake` and `payout` through `Number()`.

Public profile → RankingStats mapping (`ProfilePage.tsx:132-142`): `total_bets→totalBets`, `won_bets→wins`, `lost_bets→losses`, `win_rate→winRate`, `total_profit→totalProfit`, all `Number()`.

### History hook `useProfileHistory(targetUserId)` (`src/features/profile/hooks/useProfileHistory.ts`, 253 lines)

State:
- `historyType: "sportsbook" | "casino"` (default `sportsbook`), `filter: "all" | "won" | "lost" | "pending" | "refund"` (default `all`).
- `moreCoupons`, `moreCasinoHistory`: entries loaded by "show more", appended in memory only.
- `moreCouponsAvailable`, `moreCasinoHistoryAvailable`: `boolean | null`, null until a batch loads.
- `loadingMoreCoupons`, `loadingMoreCasinoHistory`, `sportsbookHistoryExpanded`, `casinoHistoryExpanded`, `expandedCoupons: Set<string>`.

Reset: `useEffect([targetUserId])` clears all "more" state, both expanded flags, and `expandedCoupons`. Filter and historyType are NOT reset.

Preview queries (`profileQueries.ts`):
- Sportsbook preview: `enabled = Boolean(targetUserId)`, always fetched.
- Casino preview: `enabled = Boolean(targetUserId) && historyType === "casino"` (lazy until the user switches tab).

Merge: `coupons = mergeById(preview.entries, moreCoupons)`; same for casino. `mergeById` keeps the first occurrence by `id` (preview wins, because the preview refreshes in the background and an entry may shift into it).

Derived:
- `hasMoreCoupons = moreCouponsAvailable ?? preview.hasMore ?? false`. Same for casino.
- `loadingCoupons = Boolean(targetUserId) && sportsbookPreview.isPending`. `loadingCasinoHistory` also requires `historyType === "casino"`.
- `sportsbookHistoryError = isError && !data ? "Nie udało się załadować historii zakładów" : null`. Casino: `"Nie udało się załadować historii kasyna"`. Errors only shown when there is no cached data.

Show-more logic:
- `showMoreSportsbookHistory()`: if not expanded and `coupons.length > 10`, only sets expanded = true (no request). Otherwise calls `loadMoreSportsbookHistory()`. Casino mirrors this.
- `loadMore...()`: guard on `targetUserId` and an in-flight flag (state, not ref). RPC `get_user_coupon_history` with `p_limit: 31` (`HISTORY_BATCH_SIZE + 1`) and `p_offset: coupons.length` (the merged length, not a server count). Appends `entries.slice(0, 30)`, sets `moreCouponsAvailable = entries.length > 30`, sets expanded = true. Casino: `get_user_casino_history`, same limit and offset based on `casinoHistory.length`, entries through `toCasinoHistoryEntries`.
- Errors: `console.error` plus `toast.error("Nie udało się załadować kolejnych zakładów")`; casino: `toast.error("Nie udało się załadować kolejnych wpisów kasyna")`. `finally` resets the loading flag.
- `collapse...()`: sets expanded = false only. Loaded "more" entries stay in memory, so re-expanding is instant.

Constants: `HISTORY_BATCH_SIZE = 30`, `HISTORY_BATCH_FETCH_LIMIT = 31` (`useProfileHistory.ts:24-25`); `HISTORY_PREVIEW_SIZE = 10` re-exported from `profileQueries.ts:11` (`useProfileHistory.ts:14`).

### localStorage keys
None in the files covered here.

## Business rules

### Avatar image limits (passed to `compressImageFile`)
- Max dimension 640 px, min dimension 256 px.
- Target size 135 KiB (138 240 bytes), absolute max 140 KiB (143 360 bytes).
- Output MIME `image/jpeg`, extension `.jpg`. Exact quality/algorithm lives in `src/features/social/images` (not read).
- Accepted input: any file whose `type` starts with `image/`. Input `accept="image/*"`.

### Display formatting
- Join date: `new Date(created_at).toLocaleDateString("pl-PL")` (`ProfilePage.tsx:152-154`). Expected dd.mm.yyyy on web; the pl-PL output on Hermes (Expo) is unverified and must be checked on device.
- Badge date: `Intl.DateTimeFormat("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" })` (`ProfileBadgesSection.tsx:8-14`). Throws `RangeError` on an invalid date, unlike `toLocaleDateString`, which returns "Invalid Date".
- Balance: `Number(balance).toFixed(2)` + `" zł"`. Dot decimal, no thousands separator, not locale formatted.
- Streak: own = `profile.current_streak`; public = `publicProfile.current_streak ?? 0`.

### Coupon display (`src/features/coupons/display.ts`, sportsbook history rows only)
- `roundMoney(x)` = `Math.round(x * 100) / 100`.
- `deriveCouponStatus({ status, legs })`, first match wins:
  1. Raw `refund` and (no legs, or every leg `refund`) → `refund`.
  2. Any leg `lost` → `lost`.
  3. Legs present and every leg `won`, `lost` or `refund`: all `refund` → `refund`; otherwise → `won` (won + refund = won).
  4. Raw `won` or `lost` → that value.
  5. Else `pending`.
  The status line and the status filter both use this derived value. Casino rows skip this step.
- `getDisplayedCouponOdds({ totalOdds, legs })`, first match wins:
  1. More than one leg, at least one `refund` leg, and every leg has finite odds > 0 → product of leg odds with refund legs counted as 1.
  2. Exactly one leg and its `oddsAtTime` > 0 → that odds.
  3. `totalOdds` if > 0.
  4. Else 1.
- `getDisplayedCouponWin({ status, isAko, stake, displayedOdds, couponPayout, legs })`:
  - `refund`: `couponPayout` if > 0; else `roundMoney(stake)` if > 0; else 0.
  - Any status other than `won`: 0.
  - AKO `won`: `couponPayout` if > 0; else `roundMoney(stake * displayedOdds)` if both > 0; else 0.
  - Single `won`: `legs[0].legPayout` if > 0; else `roundMoney(stake * displayedOdds)` if both > 0; else `couponPayout` if > 0; else 0.

### Sportsbook stats (season-scoped)
Chain: `private.sportsbook_ranking_units` (`supabase/migrations/20260626111524_global_season_reset.sql:731-798`) → `private.get_sportsbook_stats` (`supabase/migrations/20260602130000_performance_optimizations.sql:106-141`) → `get_user_stats` / `get_public_profile`. Both unit branches filter on `private.get_active_season_started_at()`.
- Unit = one coupon with `total_odds > 1` (season filter on `coupons.created_at`), or one standalone bet (`placed_bets.coupon_id` NULL, or coupon `total_odds <= 1`; season filter on `placed_bets.created_at`). A coupon with `total_odds > 1` counts once regardless of leg count; a coupon with `total_odds <= 1` counts once per leg. The SQL AKO test (`total_odds > 1`) differs from the client test (`legs.length > 1`).
- Coupon unit result: any leg `lost` → `lost`; all legs `refund` → `refund`; all legs `won`/`lost`/`refund` → `won`; else `pending`.
- Coupon unit profit (rounded to 2 dp): `lost` → -stake; `refund` → 0; `won` → `COALESCE(NULLIF(payout, 0), ROUND(stake * total_odds, 2)) - stake`; `pending` → 0.
- Standalone unit profit (rounded to 2 dp): `won` → `COALESCE(payout, 0) - stake` (NULL payout gives -stake); `lost` → -stake; else 0.
- `total_bets` = count of all units, including `pending` and `refund`. `won_bets` / `lost_bets` = count of unit results `won` / `lost`.
- `win_rate` = `ROUND(won / (won + lost) * 100, 1)`, on a 0-100 scale; 0 when there are no resolved units. Pending and refund units are excluded.
- `total_profit` = `ROUND(SUM(profit), 2)`; 0 when there are no units.
- Client: tile "Kupony" = `totalBets`, "Wygrane" = `wins` (S3).

### Badges (triggers and awards)
Migration refs are to `supabase/migrations/`; the trigger functions are in the season reset migration (`20260626111524_global_season_reset.sql`) unless noted.
- `placed_bets` INSERT → `check_badges_on_bet_insert` (`:316-378`): `debiutant` (first season bet), `wieloryb` (stake >= 500), `kuponista` (`coupon_id` not NULL), `ryzykant` (coupon with >= 5 legs), `multi_fan` (>= 10 distinct `coupon_id` in season), `wszechstronny` (>= 4 distinct `category_id` in season).
- `placed_bets` INSERT → `update_user_streak()` (`20260314120000_streaks_and_badges.sql:26-75`): `staly_bywalec` at streak >= 7, `legenda` at streak >= 30. Awarded live on every insert, not only by backfill.
- `placed_bets` UPDATE when `result` changes → `check_badges_on_bet_result` (`:380-480`): `trafiony` (first season `won`), `goraca_passa` (3 consecutive `won`), `nie_do_zatrzymania` (5), `mistrz_serii` (10), `pierwszy_tysiac` (sum of `placed_bets.payout` over season `won` rows > 1000; gross, not profit; `:466`), `analityk` (>= 20 resolved rows and won/resolved > 0.60, counted per `placed_bets` row; `:477`).
- `bet_proposals` UPDATE to `accepted` (`trg_badge_proposal`) → `check_badge_on_proposal_accept` (`20260524090000_agent_bet_proposal_source.sql:22-31`): `pomyslodawca`, human-sourced proposals only (`proposal_source` NULL or `human`).
- `award_badge` is idempotent (EXISTS check, then `INSERT ... ON CONFLICT DO NOTHING`).
- `backfill_streaks_and_badges` is EXECUTE for `service_role` only (`:728-729`). No app caller: references are the generated types (`src/integrations/supabase/types.ts`, `mobile/src/lib/database.types.ts`) and the grant assertions in `src/features/season-reset/seasonResetMigration.test.ts`.
- No cron job writes `current_streak` or badges.
- Badge list: `public.get_public_badges` (SECURITY INVOKER; `check_profile_access` false → `[]`) → `private.get_public_badges_for_rpc` (SECURITY DEFINER, `:1412-1442`), which returns only rows with `unlocked_at >= season start`, newest first. Own and public profiles both use this list.

### History paging
- Preview (sportsbook and casino): RPC limit 11 (`HISTORY_PREVIEW_FETCH_LIMIT`), show 10 (`HISTORY_PREVIEW_SIZE`); `hasMore` = 11 rows came back.
- Show more: RPC limit 31 (`HISTORY_BATCH_FETCH_LIMIT`) at offset = current merged length; append 30 (`HISTORY_BATCH_SIZE`); `hasMore` = 31 rows came back.
- Expanding a list that already has more than 10 entries makes no request (S5, `showMore`).

## Edge cases & gotchas

1. **Username lookup error or no match hangs on loader.** If the username resolves to `null` (or the lookup errors), `targetUserId` is `null`, so `isOwnProfile` is `false` and `publicQuery` is disabled. A disabled query with no data reports `isPending === true` in TanStack Query v5, so `loadingProfile` stays true and the page shows "Wczytywanie profilu..." indefinitely. No "not found" state exists in this file. (Verify against installed TanStack version before relying on it.)
2. **Missing or private user renders an empty profile, not a not-found state.** `get_public_profile` returns `'{}'` (not null) when the user is missing or `check_profile_access` denies access. `publicQuery.data` is therefore the truthy object `{}`, so `publicProfile` is `{}` and the public branch runs: name `...`, join date "Invalid Date" on web (`new Date(undefined)`), stats `NaN` (`Number(undefined)`; `??` does not catch NaN), so the hero shows "NaN zł", "NaN%", "NaN" and "NaN". Archetype "Nowy gracz", streak 0, and the "Profil publiczny" badge all show. Expected from the code, not device-verified. Missing and private profiles look identical.
3. **`avatarOverrideUrl` is not reset** when `userRef` changes while the component stays mounted. After uploading on own profile, navigating to another profile in the same mount shows the override avatar (`displayAvatarUrl` prefers it).
4. **Orphaned storage object**: the file is uploaded before the `profiles` update. If the update fails, the blob remains. Old avatar files are never deleted.
5. **Raw Supabase error text** from storage/profile update is shown in toasts (`error.message`), not localized.
6. **Share URL** for own profile is `/profile` (current pathname), not a user-specific URL.
7. Username matching uses `ilike` without escaping `%` and `_` wildcards.
8. `displayName.charAt(0)` for the fallback yields `.` while the name is `...`.
9. Input `disabled` during upload; value is reset in `finally`, so re-selecting the same file works.
10. **Streak goes stale.** `current_streak` changes only on a bet insert (`update_user_streak`: same day no change, yesterday +1, otherwise reset to 1) and in the season reset. No read-time decay exists and no cron writes it. A user who stops betting keeps the old `Seria` tile, and the "Na fali" archetype while profit is not positive, until the next bet. The streak counts betting days, not wins.
11. **Blank screen during resolution.** `resolvingTarget` starts true whenever a ref is present, so the page returns `null` (`ProfilePage.tsx:145`) until the target effect clears it. The result is a blank screen with no Navbar, no loader and no splash hold. For username refs this lasts until the `profiles` lookup settles.
12. **Stale profile on in-place navigation.** If the route stays mounted and `userId` changes to a username, `resolvingTarget` is not set back to true and `resolvedTargetUserId` keeps the previous ID until the new lookup returns. The previous user's header, stats and history stay on screen during the lookup. If the previous target was the signed-in user, own-only controls (balance, avatar upload) stay enabled too.
13. **Own-profile zero flash.** Own stats load separately (`profileStatsQuery`). Until they arrive `rankingStats` is null and the hero shows zeros: "+0.00 zł", "0.0%", "0", "0". The own profile has no loader; only the public profile does. Cached data (`PAGE_DATA_QUERY_OPTIONS`) avoids this on repeat visits.
14. **"Na fali" beside zero tiles.** With no stats (edge 13), or a zero stats row, and streak >= 3, the archetype is "Na fali" while the profit and tiles show zero. Rule 2 applies because profit is not > 0.
15. **`Kupony` counts pending and refund units.** `Kupony` = `total_bets`, which counts every unit (see Business rules). A new pending bet raises it at once. Refund units count but add 0 profit. Win rate ignores them. A coupon with `total_odds > 1` is one unit whatever its leg count.
16. **Payout fallback differs between SQL and client.** Stats use stored `total_odds` (AKO) and `placed_bets.payout` (standalone). History rows use `displayedOdds`, which excludes refund legs, and `leg_payout` or stake * odds for standalone bets. When the payout is NULL or 0: an AKO won with a refund leg gets `stake * total_odds` in stats but `stake * displayedOdds` in history, and these differ. A standalone won bet with NULL payout gets profit -stake in stats but shows stake * odds in history. With a stored payout the two agree.
17. **Badge catalog wording differs from the triggers.** `kuponista` says "Pierwszy kupon AKO" but triggers on any bet with a non-null `coupon_id`. `multi_fan` says "10 kuponów AKO" but counts 10 distinct `coupon_id` values with no leg-count check. `ryzykant` says "Kupon AKO z 5+ wydarzeniami" and the trigger checks for a coupon with >= 5 legs.
18. **`pierwszy_tysiac` uses gross payout.** The trigger sums `placed_bets.payout` over season `won` rows (stake included). The catalog says "Łączne wygrane powyżej 1000 zł", and the stats profit is net. If AKO legs carry NULL `payout`, they add nothing to the sum (open question 4).
19. **`formatBadgeDate` throws on an invalid date.** `Intl.DateTimeFormat.format` throws `RangeError` for an invalid `unlocked_at`. `ProfileBadgesSection.tsx:8-14` has no guard. The RPC returns valid timestamps today, so this is a defensive gap. Error-boundary coverage was not checked.
20. **Filter can hide every row while "Pokaż więcej" stays.** The sportsbook filter runs over the visible slice only: the first 10 when collapsed, all loaded entries when expanded. With "Wygrane" or any other filter, the list can show "Brak zakładów" while `hasMore` keeps "Pokaż więcej" visible. Each click loads 30 more, and the filter applies only to what has loaded.
21. **Show-more entries are stale and offset-paged.** Entries loaded by "Pokaż więcej" live in component state (`moreCoupons`), not in the React Query cache, so background refreshes never update them. A pending coupon loaded by show-more keeps showing "W toku" after it resolves, until the page remounts or `targetUserId` changes. Entries still inside the preview window refresh normally. Paging uses the merged length as offset, so new bets shift the server rows and the next batch repeats some entries. `mergeById` drops the duplicates, keeping the preview copy.
22. **Own profile while auth is loading.** `if (isOwnProfile && (!user || !profile))` returns `<Navigate to="/" />` (`ProfilePage.tsx:146`). If `/profile` renders before AuthContext has restored the session, `user` and `profile` are null and the page redirects to `/`. Whether the route guard prevents this was not checked (AuthContext not read).

## Open questions

1. **Disabled-query `isPending`** (edge 1): the public-profile loader depends on TanStack Query v5 reporting `isPending` for a disabled query with no data. Not checked; `node_modules` is absent in this worktree. Check the installed version and the `publicQuery` options.
2. **Badge wording** (edge 17): for `kuponista`, `multi_fan` and `ryzykant`, catalog text and trigger rules differ. Which one is intended?
3. **`analityk` vs displayed win rate** (edge 15): the badge counts `placed_bets` rows, the tile counts units. Is that intended?
4. **AKO leg payouts**: is `placed_bets.payout` set for AKO legs? `pierwszy_tysiac` sums it (edge 18). Not verified.
5. **Payout fallback** (edge 16): when `payout` is NULL or 0, which is authoritative, stored `total_odds` (stats) or displayed odds (history)? Standalone bets are the clearest case.
6. **Streak decay** (edge 10): should the streak decay on read after a missed betting day? No code does it today.
7. **Pre-season badge index**: `badges_user_badge_preseason_unique (user_id, badge_key)` (`supabase/migrations/20260626111524_global_season_reset.sql:65-80`) may block re-award of a badge in a later season. Not traced through the reset code.
8. **Auth-loading redirect** (edge 22): does the route guard stop `/profile` from rendering before auth resolves? AuthContext not read.
9. **Device checks** (Expo): pl-PL date output on Hermes (Display formatting), blank resolving state (edge 11), in-place navigation stale target (edge 12), NaN hero for a missing user (edge 2).
