# 12a. Casino lobby, hub, layout and roulette logic

Scope: the data and logic behind the casino hub (`/casino`), the roulette route (`/casino/roulette`) and its lobby wrapper. The roulette UI components (`RouletteGame`, `RouletteWheel`) are specified separately and appear here only where needed.

Viewport: 390px. Only unprefixed classes apply at this width. Tailwind `lg:` and up is desktop; `md:` (768px) is the hero breakpoint.

Line counts are from `wc -l` at the time of writing. Line references are `file:line` in the repo root.

## Files covered

| Path | Lines |
| --- | --- |
| `src/pages/CasinoLayout.tsx` | 30 |
| `src/pages/CasinoHub.tsx` | 126 |
| `src/features/slots/model.ts` | 129 (only `SLOT_GAMES` used here) |
| `src/features/casino/components/CasinoLobby.tsx` | 94 |
| `src/pages/CasinoRoulettePage.tsx` | 38 |
| `src/features/casino/api/casinoQueries.ts` | 31 |
| `src/features/casino/api/roulette.ts` | 439 |
| `src/features/casino/hooks/useRouletteTable.ts` | 444 |
| `src/features/casino/lib/roulette.ts` | 239 |
| `src/features/casino/lib/rouletteWheel.ts` | 86 |
| `src/features/casino/lib/casinoAudio.ts` | 77 |
| `src/features/casino/lib/preferences.ts` | 19 |
| `src/lib/query-client.ts` | 25 |
| `src/hooks/usePageTitle.ts` | 12 |
| `supabase/migrations/20260611150000_roulette_client_advance_and_bet_queue.sql` | 461 |
| `supabase/migrations/20260612120000_reduce_roulette_cron_load.sql` | 28 |

Cross-reference only (not covered here): `src/features/casino/components/RouletteGame.tsx` (510), `RouletteWheel.tsx` (370), `src/features/casino/lib/blackjackSfx.ts`, `src/components/ui/progress.tsx` (23), `src/types/database.ts` (roulette types at 13-79), `src/lib/boot/preload.ts:101`, `src/index.css` (`.casino-responsive-bg` ~1619, `.slot-lobby-symbol` ~456, `--mobile-bottom-nav-scroll-padding` line 121), `src/App.tsx` 168-181 (routes), `docs/casino-mobile-visuals.md` (41).

Routes (`src/App.tsx` 168-181): `/casino` is `CasinoLayout` with index `CasinoHub`; `roulette` is `CasinoRoulettePage` (line 176); `roulette/dev` is the lazy `CasinoRouletteDevPage` (lines 43-44, 178, not specified here); a blackjack route also sits under the layout.

## Surfaces

### S1. Casino shell (`CasinoLayout.tsx`)

- Returns `null` when `user` or `profile` is missing (line 17).
- Outer shell (line ~19): `h-safe-screen w-full max-w-full flex flex-col overflow-hidden casino-page-bg`.
- `<Navbar />` (line 21, specified elsewhere), then `<main>` (line 22): `min-w-0 flex-1 min-h-0 overflow-x-hidden overflow-y-auto`. This is the only scroll container.
- Child routes receive `{ user, profile }` through `<Outlet context>` (line 26).
- A `useLayoutEffect` (line 13) sets `main.scrollTop = 0` whenever `pathname` changes.

### S2. Hub `/casino` (`CasinoHub.tsx`)

Page title: `Kasyno — BSPLIC 2.0` (`usePageTitle("Kasyno")`, line 44).

Top to bottom at 390px:

1. Root (lines 46-53): `data-testid="casino-hub-page"`. Class: `casino-responsive-bg relative mx-auto min-h-full w-full overflow-hidden bg-cover bg-center bg-no-repeat p-4 pb-[var(--mobile-bottom-nav-scroll-padding)] pt-6 md:px-6`. Background from `getCasinoBackgroundStyle("/casino/hub-image.webp", "/casino/hub-mobile-background.webp")`. At 390px the mobile image `/casino/hub-mobile-background.webp` is used. `--mobile-bottom-nav-scroll-padding` is `calc(5.75rem + var(--safe-area-bottom))`.
2. Overlay (line 54): `absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.18),transparent_34%),linear-gradient(180deg,rgba(10,5,8,0.54),rgba(5,4,7,0.92)_58%,rgba(5,4,7,0.98))]`.
3. Content wrapper (line 55): `relative z-10 mx-auto w-full max-w-7xl space-y-8`.
4. Heading (lines 56-58): wrapper `space-y-3 pt-4 text-center md:pt-10`. `<h1>` text **"Wybierz grę"**, class `text-4xl font-black uppercase tracking-wider text-white drop-shadow-lg md:text-6xl`.
5. Grid (line 62): `mx-auto grid max-w-5xl grid-cols-1 gap-5 md:grid-cols-2 md:gap-6`. One column at 390px. Order: four slot tiles, then Ruletka, then Blackjack.
6. Slot tiles (lines 63-97), iterated from `Object.entries(SLOT_GAMES)` in this order:

   | id | title | image | offset |
   | --- | --- | --- | --- |
   | `bandit` | Midnight Bandit | `/casino/slots/bandit.webp` | 0 |
   | `candy` | Candy Cascade | `/casino/slots/candy.webp` | 8 |
   | `ember` | Ember Forge | `/casino/slots/ember.webp` | 16 |
   | `tide` | Pearl Tide | `/casino/slots/tide.webp` | 24 |

   - `<Link to="/casino/slots/${id}" data-slot-card={id}>`, class `group relative flex min-h-[290px] overflow-hidden rounded-3xl border border-amber-200/30 bg-black md:min-h-[380px]`.
   - Image (lines 70-75): `src={game.image}`, `loading="lazy"`, `alt=""`, class `absolute inset-0 h-full w-full object-cover object-[center_30%] transition-transform duration-500 group-hover:scale-105 motion-reduce:transform-none`.
   - Gradient (line 76): `absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent`.
   - Symbol row (line 77): `pointer-events-none absolute inset-x-[12%] top-[24%] flex items-center justify-center gap-3 opacity-90 transition-transform duration-500 group-hover:scale-105 sm:top-[22%]`. Three `<span class="slot-lobby-symbol">` with sprite indices `[1, 2, 6]`. `data-size="large"` for index 1, `"small"` for the others. Sprite position comes from `getSlotCardSymbolStyle` (lines 26-41).
   - `getSlotCardSymbolStyle`: `globalIndex = offset + index`. Sheet is `/casino/slots/symbols-forge-tide.webp` when `globalIndex >= 16`, else `/casino/slots/symbols.webp`. `spriteIndex = globalIndex % 16`. Position is `${((spriteIndex % 4) * 100) / 3}% ${(Math.floor(spriteIndex / 4) * 100) / 3}%`. Sets CSS vars `--slot-symbol-sheet` and `--slot-symbol-position`.
   - Second overlay (line 87): radial plus linear gradient. Copy the exact class string from line 87 when porting; it was not transcribed here.
   - Text block (line 88): `relative mt-auto p-6 text-white`. `<h2>` (line 89): `mb-2 font-serif text-4xl font-black tracking-tight`, text is the game title. CTA (line 92): `mt-4 inline-block rounded-full bg-white/15 px-4 py-2 text-xs font-bold backdrop-blur`, text **"Zagraj →"**.

7. Roulette and Blackjack tiles (lines 99-121), in array order:

   | id | title | image |
   | --- | --- | --- |
   | `roulette` | Ruletka | `/casino/roulette-cover.webp` |
   | `blackjack` | Blackjack | `/casino/blackjack-cover.webp` |

   - `<Link to="/casino/${id}">`, class `group relative flex min-h-[290px] overflow-hidden rounded-2xl border border-amber-200/30 bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300 md:min-h-[380px]`.
   - Image: `data-testid="casino-${id}-card-art"`, `loading="lazy"`, `alt=""`, class `absolute inset-0 h-full w-full object-cover object-[center_35%] transition-transform duration-500 group-hover:scale-105 motion-reduce:transform-none`.
   - Gradient (line 115): `absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent`. No symbol row.
   - Text block (line 116): `relative mt-auto p-6 text-white`. `<h2>` (line 117): same classes as the slot tiles. CTA (line 118): **"Zagraj →"**, class `mt-4 inline-block rounded-full bg-white/15 px-4 py-2 text-xs font-bold` (no `backdrop-blur`).

States: none. The hub has no loading, empty or error state. Tiles render at once and images load lazily. No lucide icons are used in the covered files.

### S3. Roulette route `/casino/roulette` (`CasinoRoulettePage.tsx`)

- Page title: `Ruletka — BSPLIC 2.0` (line 12).
- Returns `null` without `user` or `profile` (line 15).
- Shell (lines 18-25): `data-testid="casino-roulette-shell"`, class `casino-responsive-bg relative min-h-full w-full overflow-hidden bg-cover bg-center bg-no-repeat`. Both `--casino-bg-desktop` and `--casino-bg-mobile` are `url('/casino/roulette-table.webp')`, so there is no desktop/mobile art switch.
- Overlay (line 26): `absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.14),transparent_35%),linear-gradient(180deg,rgba(3,16,10,0.20),rgba(3,16,10,0.38)_55%,rgba(3,16,10,0.68))]`.
- Inner container (line 27): `relative z-10 mx-auto w-full max-w-[1800px] p-4 pb-10 pt-1.5 md:p-6 md:pb-14`. It has no bottom-nav scroll padding, unlike the hub (see G15).
- Renders `<CasinoLobby userId={user.id} username={profile.username} avatarUrl={profile.avatar_url ?? null} balance={Number(profile.balance)} refreshProfile={refreshProfile} />`.

### S4. Lobby wrapper (`CasinoLobby.tsx`)

- Root (line 37): `w-full max-w-full min-w-0 space-y-5 text-white`.
- Hero (lines 38-43): `data-testid="casino-roulette-hero"`, Framer Motion `initial={{ opacity: 0, y: 20 }}` and `animate={{ opacity: 1, y: 0 }}`. Class `relative hidden overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl sm:p-8 md:block`. The `hidden` class removes it below `md`, so at 390px the hero and all of its status UI are not shown.
- Hero contents (desktop only, for reference):
  - Two decorative glows (lines 45-46): `bg-amber-500/10` and `bg-red-500/10`, both `blur-3xl`, on `h-64 w-64` circles.
  - `<h1>` **"Ruletka"**: `mt-2 text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl`.
  - Subtitle `mt-1 text-xs font-medium text-white/50`: when idle **"Stół czeka na pierwszy zakład"**; otherwise the phase label, but not when phase is `waiting`.
  - Right column `w-full max-w-xs space-y-2 md:w-72`:
    - Label `text-xs text-white/60`: **"Postaw, aby ruszyć rundę"** when idle, else **"Do spinu"**.
    - Countdown `font-mono text-sm font-bold text-white`: hard-coded **"--:--"** when idle, else `status.countdownLabel`.
    - `<Progress className="h-1.5 bg-white/10">`, value `0` when idle, else `progressValue`.
    - Round `text-right font-mono text-[11px] text-white/45`: **"#{roundNumber ?? '—'}"**.
- `<RouletteGame ... onStatusChange={setStatus} />` (lines 84-91) renders unconditionally. At 390px the visible countdown is RouletteGame's mobile countdown (`md:hidden`, `RouletteGame.tsx` 452-453, labels "Czeka na zakład", "Wynik za", "Spin za").

Lobby status object (`useState`, lines ~24-30):

- Initial: `{ roundNumber: null, phase: 'waiting', countdownLabel: '--:--', countdownMs: 15000, isIdle: false }`.
- `progressValue` (lines ~31-34) = `clamp(countdownMs / (phase === 'spinning' ? 6000 : 15000) * 100, 0, 100)`.

### S5. Table states as shown by the lobby

| State | Source condition | Subtitle | Label | Countdown | Bar | Round |
| --- | --- | --- | --- | --- | --- | --- |
| Idle | `!isLoading && !currentRound` | "Stół czeka na pierwszy zakład" | "Postaw, aby ruszyć rundę" | "--:--" (hard-coded) | 0 | "#—" |
| Waiting | `currentRound.phase === 'waiting'` | none | "Do spinu" | mm:ss to `betting_closes_at` | `countdownMs / 15000` | "#n" |
| Spinning | `currentRound.phase === 'spinning'` | "Koło się kręci" | "Do spinu" | mm:ss to `spin_started_at + 6 s` | `countdownMs / 6000` | "#n" |
| Settled | Not confirmed (see G3: the snapshot does not return settled rounds as `currentRound`) | "Runda rozliczona" | "Do spinu" | not confirmed | not confirmed | "#n" |

Before the first snapshot the status is the initial object above, so `isIdle` is `false`. The desktop hero then shows "Do spinu", "--:--" and a full bar.

### S6. Roulette wheel and table (cross-reference)

Specified in the roulette UI spec. The data and timing here drive it: `ROULETTE_WHEEL_NUMBERS`, `SEGMENT_ANGLE`, the 800 ms settle, the 9000 ms max spin, the 35 ms tick haptic and the `cubic-bezier(0.2, 0.8, 0.25, 1)` easing (`RouletteWheel.tsx` 39-41, 178).

## Data contract

### D1. Supabase RPCs

No `.from()` calls exist in the covered files. Every server access goes through these RPCs in `src/features/casino/api/roulette.ts`:

| RPC | Params | Caller | Result and notes |
| --- | --- | --- | --- |
| `get_roulette_table_snapshot` | `p_table_key: 'main'`, `p_recent_spins_limit: 50`, `p_recent_wins_limit: 20` | `useRouletteTable.ts:97-99` (`'main'`, `ROULETTE_RECENT_SPINS_LIMIT`), `casinoQueries.ts` `rouletteSnapshotQuery` | Array or row, first row taken (`roulette.ts:175-196`), normalized. Shape `RouletteTableSnapshot` (`roulette.ts:47-53`): `currentRound`, `recentSpins`, `recentWins`, `activeBets`, `roundParticipants`. Error fallback "Nie udało się pobrać stanu stołu ruletki". |
| `place_roulette_table_bet` | `p_table_key: 'main'`, `p_user_id`, `p_bet_type`, `p_bet_value`, `p_stake: Math.round(stake * 100) / 100` (`roulette.ts:198-224`) | Hook `placeBetForRound` via `placeRouletteBet` | Returns the bet row (`id`, `round_id`, `user_id`, `bet_type`, `bet_value`, `stake`, `payout`, ...). Hook then prepends the bet, upserts the participant, calls `refreshProfile` (line ~336) and `syncFreshSnapshot`. |
| `advance_roulette_round_if_due` | `p_table_key: 'main'` (`roulette.ts:226-237`) | `advanceRouletteRoundIfDue`, called from `useRouletteTable.ts:178` | No result used. Called only when the current phase is overdue. |

Exported but without callers in `src` (do not port unless needed): `play_roulette_round` (`roulette.ts:55-70`, legacy), `get_current_roulette_round` (86), `get_recent_roulette_spins` (103), `get_recent_roulette_wins` (121), `get_my_current_roulette_bets` (139), `get_roulette_round_participants` (153; returns `[]` when the error names the function).

Server-side SQL for the snapshot, from `20260611150000` migration:

- Current round (lines 25-46): earliest round with `phase IN ('waiting', 'spinning')` for the table, ordered by `round_number ASC`, `LIMIT 1`.
- Recent spins (lines 49-65): `phase = 'settled'`, `round_number DESC`, `LIMIT LEAST(GREATEST(limit, 1), 50)`.
- Recent wins: `LEAST(GREATEST(limit, 1), 100)`, filtered to `is_win = TRUE AND payout > 0`.

### D2. Realtime

- Channel `casino-roulette-rounds-main` (`roulette.ts:245`).
- `postgres_changes`, `event: '*'`, `schema: 'public'`, `table: 'casino_roulette_rounds'`, `filter: 'table_key=eq.main'` (`roulette.ts:240-260`).
- The handler ignores the payload and calls `syncSnapshot()` without the spinner (`useRouletteTable.ts:215-217`).
- Subscribed in the hook's mount effect (`useRouletteTable.ts` 212-222). Cleanup calls `supabase.removeChannel` (`roulette.ts:260`).
- `casino_roulette_bets` is in the realtime publication (migration `20260417130000`) but no client subscribes to it. Other players' bets therefore appear only on the next poll.

### D3. Polling and resync (`useRouletteTable.ts`)

- Adaptive timer: `window.setTimeout` (line 241) re-armed in `finally` after each `syncRoundState`. Delay from `getRouletteNextSyncDelayMs(currentRound)`. Not scheduled when `document.visibilityState !== 'visible'`. Cleared on unmount.
- Resume triggers (lines 269-271): `document` `visibilitychange`, `window` `focus`, `window` `pageshow`. Removed in cleanup (lines 276-278).
- Countdown: `window.setInterval(updateCountdown, 1000)` (line 308), cleared at line 311. Uses `Math.ceil(ms / 1000)` and sets state only when that second value changes.
- `syncRoundState`: when the target time has passed, calls `advanceRouletteRoundIfDue()` once per key `${round.id}:${round.phase}`, then does a fresh snapshot.
- Advance failures: `console.warn` throttled to 30 s (`ADVANCE_ERROR_LOG_INTERVAL_MS = 30_000`, `useRouletteTable.ts:41`; warn at ~186). Polling continues.
- De-duplication: `syncSnapshot(withSpinner)` reuses an in-flight promise. `syncFreshSnapshot` runs one extra read if a request was already in flight, so a realtime event during a fetch is not lost.
- Win refresh (lines ~112-119): when the newest settled win for the user has a new `round_id`, the hook calls `refreshProfile()`.

Delay table from `getRouletteNextSyncDelayMs` (`roulette.ts`):

| Condition | Delay (ms) |
| --- | --- |
| No `currentRound` | 15000 (`ROULETTE_SYNC_IDLE_MS`) |
| Target exists and has passed (remaining <= 0) | 5000 (`ROULETTE_SYNC_FALLBACK_MS`) |
| Target exists, remaining <= 5000 | `max(250, remaining + 250)` (`ROULETTE_SYNC_TARGET_BUFFER_MS` = 250) |
| Target exists, remaining > 5000 | 5000 |
| No target, phase `settled` | 1500 (`ROULETTE_SYNC_SETTLED_MS`) |
| No target, any other phase | 5000 |

Target (`getRouletteCountdownTargetMs`): `waiting` gives `betting_closes_at`; `spinning` with `spin_started_at` gives `spin_started_at + 6000`; otherwise `null`.

### D4. React Query

- Key: `['casino', 'roulette', 'snapshot']`. Factory `rouletteSnapshotQuery` in `casinoQueries.ts` (31 lines). `queryFn: getRouletteTableSnapshot('main', 50)`.
- Options: spread of `PAGE_DATA_QUERY_OPTIONS = { gcTime: 3_600_000, refetchOnMount: 'always' }` (`src/lib/query-client.ts`).
- Global defaults (`query-client.ts`): `staleTime` 60 s, `gcTime` 5 min (overridden for this query), `retry` 1, `refetchOnWindowFocus` false.
- Hook: seeds `recentSpins` and `recentWins` from `getQueryData` once at mount (line 53). Writes each fresh snapshot with `setQueryData` (line 101). The hook does not read `currentRound` from the cache.
- Preload: `prefetchQuery(rouletteSnapshotQuery())` in `src/lib/boot/preload.ts:101`, signed-in boot only, after the first screen has its data.
- Signing out clears the cache.

### D5. Mutations from the client

- `place_roulette_table_bet` only. No cancel, undo, repeat or remove RPC exists in `src` or in `supabase/migrations`.

### D6. localStorage

| Key | Values | Reader and writer | Missing value |
| --- | --- | --- | --- |
| `bsplic_roulette_bet_type_v1` | `straight`, `color`, `parity`, `range` | `preferences.ts`. Read in `RouletteGame.tsx:84`, written at `:203` | `null` (`getStoredRouletteBetType`); default chosen in RouletteGame |
| `bsplic.casino.sound` | `'muted'` or `'on'` | `casinoAudio.ts:1`, `:27-41`. Toggled by RouletteGame `handleToggleSound` (~207-213) | Not muted (`isCasinoSoundMuted` returns false) |

Keys are exact strings. The roulette preference uses underscores and the sound key uses dots. The blackjack mute key is separate (`bsplic.blackjack.muted`, `'true'` or `'false'`) and is out of scope.

## Roulette rules & state machine

### R1. Table and round model

- Single table, key `'main'` (`DEFAULT_TABLE_KEY`, `roulette.ts:23`).
- Phases (`RouletteRoundPhase`): `waiting` → `spinning` → `settled`.
- `currentRound` in the snapshot is the earliest round in `waiting` or `spinning`. Settled rounds appear only in `recentSpins`.
- Idle means no `waiting` or `spinning` round exists.

### R2. Transitions

| From | To | Trigger | Effect |
| --- | --- | --- | --- |
| idle | `waiting` (new `round_number`) | `place_roulette_table_bet` (line ~393) when no open waiting round exists | `betting_closes_at = now() + 15 s` |
| `waiting` | `spinning` | `advance_roulette_round_if_due` once `betting_closes_at` has passed (lines ~220-227) | `winning_number = FLOOR(random() * 37)` (0-36); `winning_color = get_roulette_color(n)`; `spin_started_at` set |
| `spinning` | `settled` | `advance_roulette_round_if_due` once `spin_started_at + 6 s` has passed (lines ~234-279) | Each bet paid (R4); winners' balances credited with the sum of payouts |

Bets placed during a `spinning` round:

- If an open waiting round already exists, the bet joins it (lines ~364-367).
- Otherwise a new waiting round is inserted (line ~393) with `betting_closes_at = GREATEST(spin_started_at + 6 s, now()) + 15 s`. The next betting window opens only after the reveal ends.

Timing constants: `ROULETTE_BETTING_WINDOW_MS = 15_000` and `ROULETTE_SPIN_REVEAL_MS = 6_000` (`roulette.ts:47-48`). The migration uses `INTERVAL '15 seconds'` and `INTERVAL '6 seconds'`, and they match.

Advance uses a per-table advisory lock: `pg_try_advisory_xact_lock(hashtext('roulette:' || table_key))`. `advance_roulette_round_if_due` has `lock_timeout = '3s'` (migration `20260612120000`). A `pg_cron` job `bsplic-roulette-advance-main` runs `advance('main')` every minute. It was 5 s before the clients started nudging rounds.

Clients call `advance_roulette_round_if_due` as a nudge. `EXECUTE` is granted to `authenticated` (`20260611150000`, line 461). The previous migration `20260611120919` had revoked it from `authenticated`.

### R3. Bet types and values

| `bet_type` | Label (`getRouletteBetTypeLabel`) | Values (`value` → label) | Payout on win | Win rule |
| --- | --- | --- | --- | --- |
| `straight` | Numer | `'0'` … `'36'` (label is the number) | `ROUND(stake * 36, 2)` | `winning_number = bet_value::INTEGER` |
| `color` | Kolor | `red` → Czerwone; `black` → Czarne | `ROUND(stake * 2, 2)` | `winning_color = bet_value` |
| `parity` | Parzystość | `even` → Parzyste; `odd` → Nieparzyste | `ROUND(stake * 2, 2)` | Matching parity; zero loses (line ~258) |
| `range` | Zakres | `low` → `1-18`; `high` → `19-36` | `ROUND(stake * 2, 2)` | Matching range; zero loses (line ~262) |

- Bet value strings are compared as strings. `'0'` is a valid straight value.
- Payout is the total return including the stake. Net win is `payout - stake`. Losing bets pay 0.
- Stake is deducted at placement: `balance = ROUND(balance - p_stake, 2)` (line ~424).

### R4. Colors and wheel

Colors (`getRouletteColor`, `roulette.ts:54-57`):

- `0` → `green`.
- Red set: 1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36.
- All other numbers 1-36 → `black`.

Color labels (`getRouletteColorLabel`, lowercase): `czerwone`, `czarne`, `zielone`.

Wheel order (`ROULETTE_WHEEL_NUMBERS`, `rouletteWheel.ts:1-4`), 37 entries:

`0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26`

Spin angle (`rouletteWheel.ts:6-86`):

- `SEGMENT_ANGLE = 360 / 37` (about 9.7297°). `BALL_FULL_SPINS = 4`.
- `getRouletteBallPocketAngle(idx) = idx * SEGMENT_ANGLE`, where `idx` is the position of the winning number in `ROULETTE_WHEEL_NUMBERS`.
- `computeRouletteBallRotation(from, idx)`: normalize both angles to [0, 360). `delta = target - current`, plus 360 if negative. Result `from + delta + 4 * 360`.
- `computeRouletteBallSettledRotation(from, idx)`: same, without the four turns.
- Per-number visual offset: `ROULETTE_BALL_DEFAULT_ANGLE_OFFSET_DEG = -1`, with a per-number map (`ROULETTE_BALL_NUMBER_ANGLE_OFFSETS_DEG`, lines 12-45, e.g. `0: -0.5`, `1: 2`, `27: -3.5`, `36: -4.5`). Applied in `RouletteWheel.tsx` (~line 271), not in this file.
- The wheel is cosmetic. The outcome is already stored on the server.

### R5. Chips and stake input

- No chip denominations are defined in the covered code or in RouletteGame. The stake is a free-form amount.
- The stake is entered in a Sheet (`docs/casino-mobile-visuals.md`). Changing the amount does not place a bet.

### R6. Limits and validation

Limits in code: stake must be > 0, at most 2 decimal places, and no more than `balance`. No minimum or maximum table limit exists in the covered code.

Client validation, `validateRouletteBetInput` (`roulette.ts:182-215`), in order:

1. `Wybierz typ zakładu` (bet type not one of the four).
2. `Stawka musi być większa od 0` (`Number(stake)` not finite or <= 0).
3. `Stawka może mieć maksymalnie 2 miejsca po przecinku` (`Math.round(x * 100) !== x * 100`).
4. `Saldo jest za małe na taki zakład` (stake > balance).
5. `Wybierz poprawną wartość zakładu` (value not valid for the type).

Straight values are validated as integers 0-36. The function returns the stake rounded to cents.

Server validation, `place_roulette_table_bet` (lines ~322-356), in order:

1. `Wymagane uwierzytelnienie` (no `auth.uid()`).
2. `Brak dostępu do zakładu` (`auth.uid() <> p_user_id`).
3. `Nieobsługiwany typ zakładu`.
4. `Stawka musi być większa od 0 i mieć maksymalnie 2 miejsca po przecinku` (`p_stake <= 0` or not rounded to 2 places).
5. `Niepoprawna wartość zakładu` (straight regex `^([0-9]|[1-2][0-9]|3[0-6])$`; color `red|black`; parity `even|odd`; range `low|high`).
6. `Stół ruletki jest teraz synchronizowany. Spróbuj ponownie za chwilę.` (advisory lock not acquired).
7. `Nie znaleziono użytkownika` (profile row missing).
8. `Saldo jest za małe na taki zakład` (`p_stake > balance`, line ~419).

Client error messages: server `error.message` is shown when present. Client fallbacks in `roulette.ts`: "Nie udało się przyjąć zakładu", "Zakład nie został zapisany", and the others listed in D1 and D3.

### R7. Formatting

- `formatRouletteCountdown(ms)`: `Math.ceil(ms / 1000)`, floored at 0, `mm:ss` with zero padding. Example: 14999 ms gives `00:15`.
- Round label: `#${round_number}` in the lobby, `#—` when null.
- `formatRouletteBetValue`: straight shows the number as-is; other types show the option label.
- Stake sent to the server as `Math.round(stake * 100) / 100`.
- Phase labels (`getRoulettePhaseLabel`): `waiting` → "Przyjmowanie zakładów"; `spinning` → "Koło się kręci"; `settled` → "Runda rozliczona".
- Bet-type labels: Numer, Kolor, Parzystość, Zakres.

## Audio

Module: `src/features/casino/lib/casinoAudio.ts` (77 lines). All audio is synthesized with WebAudio. No audio files are used.

Sounds in the covered code:

- Win chime only. `playCasinoWinChime()` is called from the RouletteGame win effect (`RouletteGame.tsx` 180-200). No spin, bet or lose sound is defined in the covered files.

Chime (`casinoAudio.ts:43-69`):

- Returns early if `isCasinoSoundMuted()`. No context is created in that case.
- Three sine oscillators at 659.25 Hz (E5), 880 Hz (A5) and 1318.5 Hz (E6).
- Onsets at `currentTime + 0.02 + index * 0.11`, so +0.02 s, +0.13 s and +0.24 s.
- Per note: gain 0.0001 at onset, exponential ramp to 0.12 at onset + 0.02 s, exponential ramp to 0.0001 at onset + 0.5 s.
- Oscillator stops at onset + 0.55 s. Total length is about 0.8 s.
- Wrapped in try/catch. Best effort.

AudioContext (`getAudioContext`, lines 5-25):

- Lazy singleton, created on the first chime call.
- Uses `window.AudioContext`, falling back to `webkitAudioContext`.
- Calls `resume()` if the state is `suspended`.
- Returns `null` on any error or when neither constructor exists.

Mute:

- `isCasinoSoundMuted()` returns `localStorage['bsplic.casino.sound'] === 'muted'`, false on error.
- `setCasinoSoundMuted(muted)` writes `'muted'` or `'on'`, errors ignored.
- Mute does not affect haptics. `vibrateCasino` has no mute check.

Haptics (`vibrateCasino(pattern)`, lines 71-77): `navigator.vibrate?.(pattern)` inside try/catch.

- Win: `[60, 40, 90]` (RouletteGame).
- Tick: `35` (`RouletteWheel.tsx:178`).

Expo port notes (not decided here): WebAudio is not available in React Native. Candidates are a bundled short sound asset with `expo-audio` or `expo-av`, or a pre-rendered file generated from the same oscillator spec. Haptics map to `expo-haptics`. Keep the mute key semantics (`'muted'` or `'on'`) and store them in the same place as other preferences.

## Edge cases & gotchas

- **G1. Outcome is decided on the server.** The winner is chosen at `waiting` → `spinning`. The client wheel aims at `ROULETTE_WHEEL_NUMBERS.indexOf(winning_number)`. Never compute results on the device.
- **G2. Any client can advance a round.** Overdue clients call `advance_roulette_round_if_due`. The advisory lock makes this safe, and the `pg_cron` job runs every minute. A stalled client does not stall the table.
- **G3. `settled` is probably unreachable as `currentRound`.** The SQL filter (line ~39) returns only `waiting` and `spinning`. The "Runda rozliczona" subtitle and the 1500 ms branch in `getRouletteNextSyncDelayMs` are therefore likely dead on the snapshot path. See open question Q1.
- **G4. After a spin the table goes idle** (no `currentRound`) unless someone bet during the spin, which created the next waiting round. The hero then shows the idle copy, not "Runda rozliczona".
- **G5. Initial status is not idle.** The lobby's initial status has `isIdle: false` (S4). Before the first snapshot the desktop hero shows "Do spinu", "--:--" and a full bar.
- **G6. Idle countdown is hard-coded.** The "--:--" in the idle branch is written in JSX, not taken from `status.countdownLabel`.
- **G7. Clock skew.** Countdowns compare server timestamps (`betting_closes_at`, `spin_started_at`) with `Date.now()` on the device. Skew shifts the displayed countdown. The server still decides when rounds change.
- **G8. Cache holds `currentRound` but the hook ignores it.** The React Query entry is the full snapshot. The hook seeds only `recentSpins` and `recentWins` (line 53). Keep it that way, so a cached live round is never shown first.
- **G9. Bets during a spin** go to a waiting round whose window starts after the reveal ends (R2).
- **G10. Lock contention** returns the Polish message in R6 item 6. Show it as-is or as a retry prompt.
- **G11. No undo.** Accepted bets cannot be cancelled or removed. No client path exists for this.
- **G12. Realtime is table-wide.** Every change to a `casino_roulette_rounds` row for `main` triggers a full snapshot fetch with no spinner. Other players' bets are not subscribed and appear on the next poll (5 s during an active round).
- **G13. Null render before auth.** `CasinoLayout` (line 17) and `CasinoRoulettePage` (line 15) return `null` until `user` and `profile` exist. Whether the boot splash covers this gap is outside this file.
- **G14. Hub has no loading state.** Tiles render at once. Images are lazy-loaded.
- **G15. Roulette page has no bottom-nav padding.** The hub uses `pb-[var(--mobile-bottom-nav-scroll-padding)]`; the roulette inner container uses `pb-10`. Check at 390px that RouletteGame's fixed bottom controls do not cover the last content.
- **G16. Two mute keys in two formats.** Roulette sound uses `'muted'` or `'on'` under `bsplic.casino.sound`. Blackjack uses `'true'` or `'false'` under `bsplic.blackjack.muted`. Preference keys also differ in style (underscores vs dots).
- **G17. Unused RPC wrappers.** Six exports in `roulette.ts` have no callers (D1). Do not port them unless a screen needs them.
- **G18. Payout includes the stake.** Net win is `payout - stake`. Do not display `payout` as profit.
- **G19. String values.** Straight values are strings. Use explicit checks (`!== ''`, `=== '0'`). A truthiness check would reject `'0'`.
- **G20. Decimal check.** The client checks two decimals with float arithmetic (`Math.round(x * 100) !== x * 100`). In the port, validate the input string or use integer cents.
- **G21. Progress denominators differ by phase.** 15000 ms for `waiting` and 6000 ms for `spinning` (hero only, S4).
- **G22. Later migrations.** `20260626111524`, `20260629132603`, `20260703181500` and `20260922190000` touch roulette tables or history. None redefines the RPCs in this spec. Their contents were not re-read.

## Open questions

- **Q1.** Confirm that `settled` never reaches `currentRound` in the running app. If so, decide whether the "Runda rozliczona" copy and the 1500 ms sync branch are dropped or kept as dead code in the port.
- **Q2.** RouletteWheel allows up to 9000 ms of spin (`ROULETTE_BALL_MAX_SPIN_DURATION_MS`), while the server reveal is 6 s from `spin_started_at`. Confirm the wheel finishes before the next betting window opens, or that the overlap is acceptable. Check in the RouletteWheel spec.
- **Q3.** The snapshot returns `activeBets` and `roundParticipants`. This doc does not confirm whether they are per-user or table-wide. Read the full body of `get_roulette_table_snapshot` (migration lines 51 onward) before porting the participants list.
- **Q4.** Confirm the exact parity and range predicates in the settlement block (migration lines ~255-262). This doc records the outcome rule (zero loses) but did not re-read the predicate text.
- **Q5.** Confirm that the SQL `get_roulette_color` matches the client `RED_NUMBERS` set (`roulette.ts:7-9`). The two were not compared line by line.
- **Q6.** Confirm whether a later bet in an open waiting round extends `betting_closes_at`. The UPDATE path (migration lines ~364-367) was not fully read.
- **Q7.** Confirm the product intent for limits. The code has no minimum or maximum stake beyond `> 0` and the balance check.
- **Q8.** Confirm there is no chip UI planned for Expo. Current design uses a free-form stake in a Sheet.
- **Q9.** Choose the RN audio approach for the win chime (bundled asset or generated file) and the haptics mapping.
- **Q10.** The mobile countdown labels and the `RouletteGame` status derivation (`countdownLabel`, `mobileCountdownLabel`) are defined in RouletteGame and need the RouletteGame spec to confirm the settled display.
