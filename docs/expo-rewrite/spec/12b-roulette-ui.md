# 12b. Roulette UI (`/casino/roulette`)

Scope: the visual and interaction layer of the roulette page. Covers the wheel and ball, the betting panel, the stake drawer (desktop bar and mobile sheet), the my-bets strip, the spin history, the stats card, the recent-wins feed, the participants list, the win toast, and the sound and haptic triggers that the UI fires. Round state, data fetching, bet validation, payouts and the audio helper module are specified in `12a-casino-lobby-roulette-logic.md` and are referenced here by function or hook name only. Lobby and hub layout also live in 12a.

Viewport: 390px for the base layout. Breakpoints used by these files: `sm:` (640px, 15 uses), `md:` (768px, 8 uses) and `xl:` (1280px, 4 uses). No `lg:` or `2xl:` class appears in any of the 12 component files. `tailwind.config.ts:12` overrides only the container `2xl` width, so the default screens apply.

Line counts are from `wc -l` at the time of writing. Line references are `file:line` under the repo root `/Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite`.

## Files covered

In scope (the 12 component files):

| Path | Lines |
| --- | --- |
| `/Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/src/features/casino/components/RouletteGame.tsx` | 510 |
| `/Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/src/features/casino/components/RouletteWheel.tsx` | 370 |
| `/Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/src/features/casino/components/BettingPanel.tsx` | 218 |
| `/Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/src/features/casino/components/StakeDrawer.tsx` | 271 |
| `/Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/src/features/casino/components/MyBetsStrip.tsx` | 195 |
| `/Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/src/features/casino/components/RecentSpinsCarousel.tsx` | 143 |
| `/Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/src/features/casino/components/RouletteStatsCard.tsx` | 152 |
| `/Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/src/features/casino/components/RecentWinsFeed.tsx` | 87 |
| `/Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/src/features/casino/components/RoundParticipantsList.tsx` | 152 |
| `/Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/src/features/casino/components/WinBanner.tsx` | 116 |
| `/Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/src/features/casino/components/ActiveBetsList.tsx` | 87 (dead, not mounted) |
| `/Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/src/features/casino/components/GameStatusBar.tsx` | 77 (dead, not mounted) |

Referenced, not restated (logic and data are in 12a):

| Path | Lines | Used for |
| --- | --- | --- |
| `/Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/src/features/casino/lib/rouletteWheel.ts` | 86 | Pocket order, angle math, per-number offsets |
| `/Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/src/features/casino/lib/casinoAudio.ts` | 77 | Win chime, mute flag, vibrate wrapper |
| `/Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/src/features/casino/lib/roulette.ts` | 239 | Labels, colours, payouts, countdown, validation |
| `/Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/src/features/casino/hooks/useRouletteTable.ts` | 444 | Round state, bets, countdown, realtime |
| `/Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/src/hooks/use-mobile.tsx` | 19 | `useIsMobile` (768px split) |
| `/Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/src/pages/CasinoRoulettePage.tsx` | 38 | Page shell, background variables |
| `/Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/src/features/casino/components/CasinoLobby.tsx` | 94 | Lobby wrapper, status header |
| `/Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/src/index.css` | n/a | `--mobile-floating-stack-offset` (120, 238–239), `.pulse-live`, reduced-motion (1763–1774), perf-lite (1777–1788) |

Tests that exist near these files (reference only): `RouletteGame.test.tsx`, `RouletteWheel.test.tsx` (asserts `--roulette-ball-size`), `WinBanner.test.tsx`, `CasinoLobby.test.tsx`, and `api/roulette.test.ts`.

## Surfaces

### Mount chain

1. `src/App.tsx:42` lazy-loads the page through `loadCasinoRoulettePage` (`src/lib/boot/route-modules.ts:17`). The route is `src/App.tsx:176` (`path="roulette"`).
2. `CasinoRoulettePage.tsx` sets `--casino-bg-desktop` and `--casino-bg-mobile` to `url('/casino/roulette-table.webp')` (lines 22–23) and renders `CasinoLobby` (line 28).
3. `CasinoLobby.tsx:84–91` renders `RouletteGame` with `userId`, `username`, `avatarUrl`, `balance`, `refreshProfile` and `onStatusChange`.
4. `RouletteGame.tsx` owns the shared state (table data, bet form, win keys, sound flag) and passes props down. `RouletteWheel` keeps its own spin state. `StakeDrawer` keeps `isDesktopOpen` (starts true) and `isMobileOpen` (starts false). `WinBanner` keeps its own show flag and count-up.
5. Images used on the page: `/casino/roulette-table.webp` (page background), `/casino/roulette-wheel-new-3.webp` (wheel), `/casino/roulette-cover.webp` (hub card at `CasinoHub.tsx:100`), `/casino/roulette-background.webp` (dev page only). Preload entries are in `src/lib/boot/preload.ts` (lines 65, 69, 70, 80).

### Layout by width

`useIsMobile()` (768px, `src/hooks/use-mobile.tsx`) decides which branch of the betting panel and stake controls mounts. The CSS `md:` and `xl:` classes then decide placement and visibility.

| Width | Grid and order | Visible in this band |
| --- | --- | --- |
| below 768px (base) | Single column. Centre stage (`order-1`), then left rail (`order-2`), then right rail (`order-3`, empty). | Sound button, mobile countdown (`md:hidden`), wheel, BettingPanel (inside centre, because `isMobile`), MyBetsStrip. Fixed mobile stake bar and sheet. No desktop stake bar. |
| 768px to 1279px (`md:`) | Still a single column, since the grid has no column template below `xl:`. Centre (`order-1`), left rail (`order-2`), right rail (`order-3`). | Sound button (`md:top-1`), wheel, MyBetsStrip. Left rail stats. BettingPanel is in the right rail. Floating desktop stake bar. No mobile countdown. |
| 1280px and up (`xl:`) | `xl:grid-cols-[360px_minmax(520px,1fr)_360px]`. Left rail `xl:order-1`, centre `xl:order-2`, right rail `order-3` (stays third). | Three columns. Wheel max width 560px (`RouletteWheel.tsx:28`). |

The wheel wrapper max width is `max-w-full sm:max-w-[420px] xl:max-w-[560px]` (`RouletteWheel.tsx:27–28`). The `sm:` step is 640px, so a phone in landscape gets a 420px wheel.

### RouletteGame (page shell)

- Root `data-testid="roulette-game-root"` (`RouletteGame.tsx:402`). It sets `--roulette-mobile-content-bottom-padding` (lines 68–70) and consumes it as `pb-[var(--roulette-mobile-content-bottom-padding)] md:pb-0` (line 404). The value is `max(0rem, offset - 0.375rem) + env(safe-area-inset-bottom) + 4.75rem`, where `offset` is `--mobile-floating-stack-offset` (default 4.75rem).
- `WinBanner` is the first child (lines 406–411).
- Table message strip (lines 413–421): renders `table.tableMessage` when set, with a fade-up motion. Amber strip, `text-sm`.
- Grid (423–426): `data-testid="roulette-table-layout"`, `grid min-w-0 gap-5 xl:grid-cols-[360px_minmax(520px,1fr)_360px]`.
- Left rail (427–432): `data-testid="roulette-left-rail"`, `order-2 min-w-0 space-y-5 xl:order-1`. Contains RoundParticipantsList, RecentSpinsCarousel, RouletteStatsCard, RecentWinsFeed (in that order).
- Centre stage (434–487): `data-testid="roulette-center-stage"`, `relative order-1 min-w-0 space-y-2 md:space-y-5 xl:order-2`.
  - Sound toggle (438–449): absolute, `right-1 top-20 md:top-1`, `h-11 w-11`, `z-30`. `aria-label` is `Włącz dźwięki` when muted, `Wycisz dźwięki` otherwise. Icon VolumeX when muted, Volume2 otherwise (h-4 w-4, aria-hidden).
  - Mobile countdown (451–468): `data-testid="roulette-mobile-countdown"`, `md:hidden`. Label is `Czeka na zakład` when idle, `Wynik za` while spinning, `Spin za` otherwise. Value is `--:--` when idle, else the countdown text. Round tag `#{round_number}` or `#--`.
  - RouletteWheel (470–475) receives `phase`, `winningNumber`, `spinStartedAt`, `roundId` from `table.currentRound`.
  - BettingPanel (477) is rendered here only when `isMobile`.
  - MyBetsStrip (479–486) receives `liveBets` (bets with `is_win === null`), `settledBets` and `resultNumber`/`resultColor` from the last settled round, plus `isRepeating` and `onRepeat`.
- Right rail (489–494): `data-testid="roulette-right-rail"`, `order-3 min-w-0 space-y-5`. Contains BettingPanel only when `!isMobile`.
- StakeDrawer (497–507): receives `balance`, `stake`, `loading={table.isPlacingBet}`, `submitDisabled`, `submitHint`, `potentialWin`, `betSummary` (the label of the selected value), `onStakeChange`, `onSubmit`.
- Submit gating (lines 101–119): `submitHint` is the first failing check in this order: bet type missing, value missing, stake not a positive number, stake above balance. `submitDisabled = table.isLoading || submitHint !== null`. Betting stays enabled while the wheel spins; the code comment says the bet queues into the next shared round.

### WinBanner (`WinBanner.tsx`)

- Root `data-testid="win-toast"` (line 73): `fixed`, `top-[calc(2.75rem+env(safe-area-inset-top)+0.5rem)]`, full width minus 12px on phones, `sm:` centred at `sm:w-[440px]` and `sm:top-24`.
- Inner card `role="status"`, `aria-live="polite"`, `aria-atomic="true"` (line 81). Emerald surface, rounded-2xl, backdrop blur, top highlight line.
- Copy: `Wygrałeś {amount} zł!` with the amount counting up from 0 over 900ms (`COUNT_UP_DURATION_MS`, line 14) with a cubic ease-out. The count restarts whenever `amount` changes while open.
- Share button `Udostępnij` (Share2 icon, `h-9`, emerald). Calls `onShare`.
- Close button `aria-label="Zamknij powiadomienie o wygranej"` (X icon, `h-9 w-9`). Calls `handleDismiss`, which hides locally and then calls `onDismiss`.
- Auto-dismiss after 6500ms (lines 50–53), which also calls `onDismiss`.
- Returns `null` when hidden, so nothing is mounted.

### BettingPanel (`BettingPanel.tsx`)

- Root `data-testid="roulette-bet-panel"`, `space-y-3`. Two cards, each `rounded-2xl bg-black/55 p-3 md:p-4`.
- Bet type grid (`grid grid-cols-2 gap-2`). Four types, each a button with `aria-pressed`:
  - straight: Hash icon, label `Numer`, description `x36`.
  - color: Palette icon, `Kolor`, `x2`.
  - parity: ArrowUpDown icon, `Parzystość`, `x2`.
  - range: ArrowDownUp icon, `Zakres`, `x2`.
  - Active card `border-amber-500/50 bg-amber-500/10`, inactive `border-white/10 bg-white/[0.02]`. Icon box `h-8 w-8 rounded-lg`.
- Value grid (`data-testid="roulette-bet-value-grid"`): `grid-cols-5 sm:grid-cols-6` for straight (numbers 0 to 36 in numeric order), otherwise `grid-cols-2`.
- Value buttons (`min-h-11`, `text-base font-semibold`): straight colours green/red/black (number colour), colour type red/black, parity and range neutral (`border-white/10 bg-white/[0.03] text-white/70`).
- Selected ring is `ring-2 ring-amber-300`. The settled winning option gets `ring-2 ring-emerald-300/90` (`getWinningOptionValue`, from `settledWinningNumber`). Zero is never a winning parity or range option.
- Value heading row shows `wypłata x36` (straight) or `wypłata x2` (others).
- Switching the type animates the value grid: AnimatePresence `mode="wait" initial={false}`, keyed by type, slides `x: 16 → 0 → -16` with a spring (stiffness 760, damping 44).

### StakeDrawer (`StakeDrawer.tsx`)

Desktop (mounted only when `!isMobile`, wrapper `hidden md:block`):

- Open bar (lines 77–171): `fixed inset-x-0 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-50 max-w-3xl`. Spring slide from y 96. Collapse button `aria-label="Schowaj stawkę"` (ChevronDown).
- Presets `data-testid="desktop-stake-presets"`: 10, 25, 50, 100 (`h-10 w-16`). Selected when `parsedStake === preset`. Not disabled by balance.
- Input `aria-label="Stawka ruletki"`: type number, `inputMode="decimal"`, `min="0.01"`, `step="0.01"`, `h-10 w-24`. Not disabled while loading.
- Buttons `1/2`, `2x`, `MAX`. `adjustStake` halves or doubles the current stake, floored at 0.01 and rounded to 2dp. `MAX` sets `floor(balance × 100) / 100`, floored at 0.01.
- Submit: `h-10 bg-amber-500`, Zap icon and `Postaw`. Shows `…` while loading. `disabled={loading || submitDisabled}`.
- Caption (lines 166–170): `Saldo: X.XX zł`, then a `·` separator when there is a status, then the status line. Status is `submitHint` in amber, or `Możliwa wygrana: X.XX zł` in emerald when `potentialWin` is set.
- Collapsed pill (lines 172–192): `fixed inset-x-0 bottom-[env(safe-area-inset-bottom)]`. `Pokaż stawkę` plus an amber badge showing `X.XX zł` or `—` when the stake is not positive.

Mobile (mounted only when `isMobile`, wrapper `md:hidden`):

- Fixed bar `data-testid="roulette-mobile-controls"` (line 201): `fixed inset-x-0 bottom-[var(--roulette-mobile-stake-nav-anchor)] z-40 border-t border-white/15 bg-[#0b1713]`. The anchor variable (lines 26–27) is `max(0rem, offset - 0.375rem) + env(safe-area-inset-bottom)`, so the bar sits above the floating nav.
- Trigger (`SheetTrigger`, `aria-label="Zmień stawkę ruletki"`): `min-h-12 min-w-24`. Shows `Stawka` and the value (`X.XX zł` or `Ustaw`).
- Submit (`flex-1`, `h-12`, `bg-amber-400`): `Postaw zakład`, or `Przyjmowanie…` while loading.
- Status line (lines 223–225): `role="status"`, one line, truncated. Shows `submitHint`, or `{betSummary ?? 'Zakład'} · wypłata {potentialWin ?? '0.00'} zł`.
- Sheet (`side="bottom"`, `SheetContent data-testid="mobile-stake-drawer"`, lines 227–266): `max-h-[85dvh] overflow-y-auto overscroll-contain rounded-t-2xl bg-[#0b1713]`. Close icon overridden to `h-11 w-11` at `right-2 top-2`.
  - Title `Wybierz stawkę`. Description `Saldo: X.XX zł. Kwota dotyczy jednego zakładu.`
  - Presets `grid-cols-4`, `min-h-12`. Disabled when `preset > balance` or loading. Selected `border-amber-300 bg-amber-400/15`.
  - Label `Własna kwota w zł` bound to the input by `useId`. Input `h-12`, text-lg, disabled while loading.
  - `1/2`, `2x`, `MAX` in a three-column row (`min-h-11`).
  - Footer `Gotowe` (`SheetClose`, `h-12 bg-amber-400`).
- Sheet timing (`src/components/ui/sheet.tsx`): open 500ms, close 300ms, `ease-in-out`. Overlay `bg-black/80`.

### RouletteWheel (`RouletteWheel.tsx`)

Covered in full under Wheel geometry. Surfaces are: the frame `data-testid="roulette-wheel-frame"`, the ball orbit `data-testid="roulette-ball-orbit"` (with `data-target-number`, `data-target-index`, `data-angle-offset`, `data-animation-state` and similar attributes), and the ball `data-testid="roulette-ball"`.

### MyBetsStrip (`MyBetsStrip.tsx`)

- Root `data-testid="roulette-my-bets-strip"` (`rounded-2xl bg-black/40 px-3.5 py-3`). Returns `null` when there are neither live nor settled bets to show.
- Mode `live` (any live bets): header `Grasz w tej rundzie` and `max → X.XX zł` (sum of stake × payout multiplier for live bets).
- Mode `result` (no live bets, settled bets exist): header `data-testid="roulette-round-result-label"` reads `Wypadło {resultNumber} {colour label}`. Shows `+X.XX zł` when the total payout is above zero, else `bez trafienia`.
- Chips (`rounded-full px-2.5 py-1 text-[11px]`):
  - Live: coloured dot (`h-2 w-2`). Neutral chips use amber for types other than straight and colour.
  - Settled losers: `opacity-45` with an X icon.
  - Settled winners: emerald border, glow shadow, Check icon. Amount shows `+payout`.
  - Label `{type label}: {value label}`.
- Repeat button (result mode only) `data-testid="roulette-repeat-bets"`: `ml-auto`, amber pill, RotateCcw icon. Text `Powtórz` (or `Stawiam…` while repeating). `aria-label` is `Powtórz N ostatni zakład` / `Powtórz N ostatnich zakładów` (singular for N = 1), or `Stawianie …` while repeating.

### RoundParticipantsList (`RoundParticipantsList.tsx`)

- Card `rounded-2xl border border-white/10 bg-white/[0.03] p-4`. Title `Gracze w rundzie` with a count badge.
- Empty copy: `Brak zakładów w tej rundzie.`
- Each participant row: avatar (image, or the first two letters of the username on amber), name (truncated), `{bet_count} zakład` (singular for 1, else `zakłady`), and the total stake as `{total_stake.toFixed(2)} zł`.
- Under the row, a list of bet chips (`pl-12`). Each chip has a colour dot (red, black or green, or neutral amber), the label `{type}: {value}`, and the stake.

### RecentSpinsCarousel (`RecentSpinsCarousel.tsx`)

- Returns `null` when there are no spins.
- Card with title `Ostatnie spiny`. Streak badge `data-testid="roulette-color-streak"` shows `{n}× {colour} z rzędu` when the leading run has length 2 or more.
- Horizontal Embla carousel (`align: 'start'`, `dragFree: true`). Prev and next arrow buttons are disabled at the ends (`canScrollPrev` and `canScrollNext`, updated on `select`).
- Each item (`min-w-[72px]`): a number circle (`h-10 w-10`, coloured border and fill) and `#{round_number}` in mono.

### RouletteStatsCard (`RouletteStatsCard.tsx`)

- Card `data-testid="roulette-stats-card"`. Returns `null` until there are at least 5 settled spins.
- Title `Statystyki · {total} spinów`.
- Colour split bar (`role="img"`, red / black / green segments) with percentage labels `X% czerwone`, `Y% czarne`, `Z% zielone`.
- `Najczęstsze` (hot): top 3 numbers by count, with the count filter `> 0`. Flame icon, orange.
- `Zimne` (cold): bottom 3 numbers by count, no count filter. Snowflake icon, sky. Always rendered.
- Number chips show `{number}` plus `×{count}` in small text.

### RecentWinsFeed (`RecentWinsFeed.tsx`)

- Empty state: card with `Ostatnie wygrane` and `Brak ostatnich wygranych`.
- Non-empty: scrollable card (`max-h-[400px]`, scrollbar hidden) with up to 10 rows. Each row: avatar, username, `+{payout.toFixed(2)}` in emerald (no `zł` suffix), and a meta line `{type} • {value} • #{round_number}`. Rows animate in with a stagger of `index × 0.04s`.

### Sound and haptic triggers (UI-fired)

| Trigger | Where | Effect |
| --- | --- | --- |
| New user win detected (first time for its key) | `RouletteGame.tsx:180–199` | `playCasinoWinChime()`, `vibrateCasino([60, 40, 90])`, confetti (150 particles, spread 70, origin y 0.6, gold, red, green and white) |
| Wheel settle (ball reaches pocket) | `RouletteWheel.tsx:178` | `vibrateCasino(35)` |
| Mute toggle | `RouletteGame.tsx` `handleToggleSound` | `setCasinoSoundMuted`. Mutes only the win chime (see `casinoAudio.ts`). |

No sound or haptic call exists in StakeDrawer, BettingPanel or MyBetsStrip. The mute flag does not gate `vibrateCasino`, so haptics continue when sound is muted.

### Toast copy (sonner)

| Event | Copy |
| --- | --- |
| Bet accepted into the current round | `Zakład przyjęty do wspólnej rundy!` |
| Bet queued for the next round | `Zakład czeka na następną rundę!` |
| Bet failed | Error message, or `Nie udało się przyjąć zakładu.` |
| Repeat succeeded | `Zakład powtórzony!` or `Zakłady powtórzone!` |
| Repeat, balance too low | `Saldo jest za małe, aby powtórzyć zakłady.` |
| Repeat failed | `Nie udało się powtórzyć zakładów.` |
| Win shared | `Wygrana udostępniona na Socialu!` |
| Share failed | Error message, or `Nie udało się udostępnić wygranej.` |

### Share to Social

`handleShareWin` (`RouletteGame.tsx:287–338`) calls `createCasinoShare` from `@/features/social/api/social`. The content is `Wygrana w ruletce: X zł. Numer N.`, or without the number when the winning number is unknown. Optimistic: it marks the win key as shared and dismisses the banner first, and rolls back both keys on failure. `isSharingWin` is reset in `finally`.

### Repeat bets

`handleRepeatBets` (`RouletteGame.tsx:247–285`) places last-round bets one at a time through `placeBet`, then shows one toast for the outcome.

### Not mounted (dead code)

- `ActiveBetsList.tsx` (87 lines): not imported anywhere in `src/` outside its own file. Copy `Twoje zakłady`, `Brak aktywnych zakładów`.
- `GameStatusBar.tsx` (77 lines): not imported anywhere in `src/` outside its own file. Copy `Kasyno Premium`, `Ruletka`, `Do spinu`. It is the only roulette file using `pulse-live` and `animate-ping`, and it has no perf-lite gating.

## Wheel geometry

### Constants

| Constant | Value | Where |
| --- | --- | --- |
| `ROULETTE_WHEEL_IMAGE` | `/casino/roulette-wheel-new-3.webp` | `RouletteWheel.tsx:23` |
| `ROULETTE_WHEEL_IMAGE_SIZE` | 1138 (intrinsic width and height) | `RouletteWheel.tsx:24` |
| `ROULETTE_WHEEL_IMAGE_FILTER` | `brightness(0.87) contrast(1.11) saturate(0.94) drop-shadow(0 34px 48px rgba(0, 0, 0, 0.88)) drop-shadow(0 0 30px rgba(127, 29, 29, 0.38))` | `RouletteWheel.tsx:25–26` |
| `ROULETTE_WHEEL_MAX_WIDTH_CLASS` | `max-w-full sm:max-w-[420px] xl:max-w-[560px]` | `RouletteWheel.tsx:27–28` |
| `ROULETTE_WHEEL_FRAME_MAX_WIDTH_CLASS` | `max-w-[1138px]` | `RouletteWheel.tsx:29` |
| `ROULETTE_BALL_SIZE` | `clamp(8px, 2.8%, 16px)` | `RouletteWheel.tsx:31` |
| `ROULETTE_BALL_SPINNING_TOP_START` | `8%` | `RouletteWheel.tsx:32` |
| `ROULETTE_BALL_SPINNING_TOP_END` | `12%` | `RouletteWheel.tsx:33` |
| `ROULETTE_BALL_SETTLED_TOP` | `25.3%` | `RouletteWheel.tsx:34` |
| `ROULETTE_BALL_ORBIT_ORIGIN` | `50% 50%` | `RouletteWheel.tsx:35` |
| `ROULETTE_BALL_TRANSLATE_X` / `_Y` | `-50%` / `-50%` | `RouletteWheel.tsx:36–37` |
| `ROULETTE_BALL_SETTLE_DELAY_MS` | 100 | `RouletteWheel.tsx:38` |
| `ROULETTE_BALL_SETTLE_DURATION_MS` | 800 | `RouletteWheel.tsx:39` |
| `ROULETTE_BALL_MAX_SPIN_DURATION_MS` | 9000 | `RouletteWheel.tsx:40` |
| `ROULETTE_SPIN_EASING` | `cubic-bezier(0.2, 0.8, 0.25, 1)` | `RouletteWheel.tsx:41` |
| Settle easing (inline) | `cubic-bezier(0.18, 0.72, 0.2, 1)` | `RouletteWheel.tsx:281–286` |
| Ball opacity and transform | `0.5s ease-out` | `RouletteWheel.tsx:281–286` |
| Spin reveal window | `ROULETTE_SPIN_REVEAL_MS` = 6000 | `src/features/casino/lib/roulette.ts:48` |

### Pocket order and segments

`ROULETTE_WHEEL_NUMBERS` (`rouletteWheel.ts`) is the physical pocket order, clockwise from 0. Segment size is `360 / 37` = 9.7297°. Pocket angle for index `i` is `i × 9.7297°` (`getRouletteBallPocketAngle`).

```
0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
```

The ball's target index is `ROULETTE_WHEEL_NUMBERS.indexOf(winningNumber)`, or 0 when the number is null or not found (`RouletteWheel.tsx:85–89`).

### Per-number visual offsets

`ROULETTE_BALL_NUMBER_ANGLE_OFFSETS_DEG` (`rouletteWheel.ts`, lines 12–45) corrects the ball's visual angle so it lands on the artwork's pocket. Values are in degrees. Any number not listed uses `ROULETTE_BALL_DEFAULT_ANGLE_OFFSET_DEG` = -1.

`0: -0.5, 1: 2, 2: -2, 3: 0, 6: -3, 7: 0, 8: -2, 9: 0, 10: -2, 11: -5, 12: -0.5, 13: -4, 14: 1, 16: 2, 17: -2, 18: 0, 20: 1, 22: 0, 23: -4, 24: 1, 25: -2, 27: -3.5, 28: -0.5, 29: 0, 30: -5, 31: 1, 32: 0, 33: 2, 34: -2.3, 35: -0.5, 36: -4.5`

Not listed (use -1): 4, 5, 15, 19, 21, 26.

The offset is added only to the rendered rotation (`adjustedBallRotation = ballRotation + angleOffsetDeg`, line 273). Spin and settle deltas use the un-offset `targetRotation`.

### Rotation math

- `normalizeRotation(r) = ((r % 360) + 360) % 360`.
- Spin target (`computeRouletteBallRotation(from, index)`): `delta = normalize(pocket) - normalize(from)`, plus 360 if negative. Result is `from + delta + 4 × 360`. Four full turns always, so the spin is never less than 1440°.
- Settle target (`computeRouletteBallSettledRotation(from, index)`): same delta, but `from + delta`, with no full turns. It is applied to `targetRotation` at settle time, so the settle delta is zero in practice.
- `fromRotation` is the last rotation stored in `ballRotationRef`, so the ball carries its position between rounds.

### Ball state machine (visual only)

Round phases and triggers are in 12a. The visual states of the orbit and the ball are:

| `activeSpin.phase` | Orbit rotation | Ball top | Ball transition |
| --- | --- | --- | --- |
| `staged` | `fromRotation`, no transition | 8% | `none` |
| `spinning` | `targetRotation`, transform `durationMs` `ROULETTE_SPIN_EASING` | 12% | `top durationMs ROULETTE_SPIN_EASING`, opacity and transform 0.5s |
| `settled` | `targetRotation` (zero delta) | 25.3% | `top 800ms settle easing`, opacity and transform 0.5s |
| `settled` via `settleInstantly` | target, transition `none` | 25.3% | `none` |

Spin duration (`RouletteWheel.tsx:134–137`):

- If `animationTiming.spinDurationMs` is provided (tests), use it.
- Otherwise `min(9000, max(0, spinStartedAt + 6000 - now))`. A client that joins late gets a shorter spin. If the reveal window has passed, the duration is 0 and the spin has no animation.

Settle timer: fires at `durationMs + 100` ms (`animationTiming.settleDelayMs` when provided). Plays `vibrateCasino(35)` and sets `phase: 'settled'`.

Trigger rules (`RouletteWheel.tsx:91–247`):

- Phase `waiting` clears `triggeredRoundRef` and does not clear `activeSpin`, so the ball stays where it was.
- A spin starts when phase is `spinning`, `winningNumber` is set, `roundId` is set, and this round has not triggered yet.
- A settled round with `current` null, or with a `targetNumber` that differs from `winningNumber`, uses `settleInstantly` (duration 0, no animation). This is the late-joiner path.
- Two nested `requestAnimationFrame` calls separate the `staged` and `spinning` frames so the browser paints the start position first.

### Frame and decoration

- Wrapper `motion.div`: `initial {opacity: 0, scale: 0.92}`, `animate {opacity: 1, scale: 1}`, `transition {delay: 0.1, type: 'spring', stiffness: 100}`.
- Ambient glow (`blur-3xl`, `scale-90`): `bg-red-950/60` while spinning, `bg-red-950/25` otherwise, `transition-colors duration-700`.
- Dark disc `absolute inset-[7%] rounded-full bg-black/70 blur-3xl`.
- Wheel image: `object-contain`, `opacity-95`, `draggable={false}`, `alt="Koło ruletki"`. Static. Only the orbit rotates.
- Vignette: `radial-gradient(circle at 50% 48%, transparent 42%, rgba(8,3,3,0.34) 68%, rgba(0,0,0,0.74) 100%)`, `mix-blend-multiply`, `z-10`.
- Inner ring `inset-[8%]`, `shadow-[inset_0_0_60px_rgba(0,0,0,0.58),0_0_68px_rgba(127,29,29,0.28)]`, `z-10`.
- Orbit `absolute inset-0 z-20 transform-gpu`, `transform: rotate(...)` with `transform-origin: 50% 50%`. Rendered only while `activeSpin` is non-null.
- Ball `absolute left-1/2 rounded-full border-white/90`, radial gold gradient, `translate3d(-50%, -50%, 0)`, size from `--roulette-ball-size`.

## Edge cases & gotchas

- **Orbit is never cleared.** `setActiveSpin(null)` is never called in `RouletteWheel.tsx`. After the first spin, the ball stays at the last pocket through `waiting` and until the next spin. Before any spin, no ball is rendered.
- **Late joiner on a settled round.** `settleInstantly` sets transition `none`, so the ball appears in the pocket with no animation.
- **Late joiner mid-spin.** If the 6-second reveal window has passed, the spin duration is 0 and the ball jumps.
- **Zero-delta settle.** `computeRouletteBallSettledRotation` runs on `targetRotation`, so the settle does not move the orbit. Only the ball's `top` moves (12% to 25.3%, 800ms). A float error could add 360°, which looks identical.
- **Side effects inside state updaters.** `vibrateCasino(35)` and the `ballRotationRef` writes sit inside `setActiveSpin` updater functions. StrictMode runs updaters twice in development, so the haptic may fire twice there. Native code should keep these effects outside the updaters.
- **Win detection uses in-memory sets.** `announcedWinKeysRef` and `sharedWinKeysRef` are `useRef` Sets, so they reset on remount. Whether the chime and confetti re-fire after a remount when the latest win is still in state needs a browser check.
- **Win key includes the stake and payout.** The key is `round_id:bet_type:bet_value:stake:payout`. A dismissed banner stays dismissed for the same key only.
- **Win banner count-up restarts** every time `amount` changes while the banner is open.
- **Auto-dismiss** after 6500ms also calls `onDismiss`, which marks the key as dismissed.
- **Layout shift from `space-y-5`.** The centre and grid use `space-y-5` with a fixed WinBanner as the first child. While the banner is mounted, the next sibling gets a 1.25rem top margin even though the banner is out of flow. When the banner returns `null`, the margin is gone.
- **Empty right rail.** Below `xl:` the right rail is still a grid item and still adds `gap-5` at the bottom of the grid on phones, even with no content (`RouletteGame.tsx:489–494`).
- **First-render width is false.** `useIsMobile()` starts as `undefined`, so on phones the first render takes the desktop branch. BettingPanel and StakeDrawer then move to the mobile branch after the effect runs. Native code should read the width synchronously.
- **Mobile sound button position.** `top-20` (80px) on phones sits over the upper-right of the centre stage, close to the wheel frame. The overlap needs a browser check.
- **Stake presets differ by width.** Desktop presets are never disabled by balance (`StakeDrawer.tsx:101–115`). Mobile presets are disabled when `preset > balance` or loading (line 239). Desktop input is not disabled while loading, but the mobile input is (line 254).
- **Status copy differs by width.** Desktop shows `—` (pill) or no value when the stake is empty. Mobile shows `Zakład` and `0.00` in place of missing values.
- **Cold numbers can show ×0.** `RouletteStatsCard.tsx:62–64` has no count filter for the cold list, so numbers that never came up show `×0`.
- **Recent wins amount has no currency.** `RecentWinsFeed.tsx:73` shows `+X.XX` without `zł`. The win toast and MyBetsStrip do show `zł`.
- **Repeat-bet errors.** Repeat stops at the first failure, and the toast shows only the generic error (`RouletteGame.tsx:280`).
- **Bets during spin.** Betting stays open while the wheel spins. A bet placed then goes to the next shared round. The toast copy changes to `Zakład czeka na następną rundę!` when the accepted round id differs from the round at submit time.
- **Submit disabled hint.** `submitHint` never mentions the spin phase, so the button stays enabled while spinning.
- **Strip returns null.** `MyBetsStrip` renders nothing when there are no live or settled bets, so the centre stage has no placeholder.
- **Stats need 5 settled spins.** `RouletteStatsCard` returns `null` below 5 settled spins. `RecentSpinsCarousel` returns `null` when empty. Neither shows a placeholder.
- **Reduced motion is not handled in JS.** No file in the 12 components reads `useReducedMotion` or `prefers-reduced-motion`. The global CSS block (`src/index.css:1763–1774`) sets CSS animations and transitions to 0.01ms. It does not affect framer-motion springs or the inline orbit transition.
- **Perf-lite is not handled.** No component calls `usePerfLite`. Only `.pulse-live` is disabled under `.perf-lite` (`index.css` around 1777–1788), and `.pulse-live` is used only by dead `GameStatusBar.tsx`. The `blur-3xl` glows, the dark disc and `backdrop-blur-sm` cards have no plain fallback.
- **Mobile stake bar stacking.** The bar's bottom uses `--roulette-mobile-stake-nav-anchor`, which reads `--mobile-floating-stack-offset`. That variable is 4.75rem in `:root` (`index.css:120`) and 0rem in `body.mobile-bottom-nav-hidden` (`index.css:238–239`). `Navbar.tsx:99` and `:104` toggle that body class.
- **`--roulette-mobile-stake-top-anchor` is unused.** It is set at `StakeDrawer.tsx:28` and never read.
- **Sheet height on iOS standalone.** `max-h-[85dvh]` (`StakeDrawer.tsx:230`) may be about 59pt short in iOS standalone PWAs, where `svh` and `dvh` are shorter than the real viewport. The user's notes say only `100vh` is correct there.
- **Round phase type.** `RouletteRoundPhase` is `'waiting' | 'spinning' | 'settled'` (`src/types/database.ts:17`). The wheel reads only these three.
- **Bet type memory.** The chosen bet type is stored with `storeRouletteBetType` and read back on mount, so the panel reopens on the last used type.

## Open questions

1. **Pocket order and offsets in this spec.** The brief asked for roulette data to be referenced by name only. This spec also lists `ROULETTE_WHEEL_NUMBERS` and the per-number offsets, because the native wheel needs them to match the artwork. Confirm the native port should copy these tables rather than import them from the web source.
2. **12a line 5 uses `lg:`.** The sibling `12a-casino-lobby-roulette-logic.md` (line 5) calls `lg:` and up desktop. These files do not use `lg:`, and the orchestrator brief asked for `md:` and `xl:`. Correct 12a line 5 to match the code.
3. **`sm:` is used.** The brief said md and xl only. These files use `sm:` (640px) 15 times, mostly in BettingPanel, WinBanner and the wheel's max width. Decide whether native should copy the 640px step.
4. **Orbit after waiting.** Should the ball clear after a round goes back to `waiting`, or keep its last pocket as it does now?
5. **Late-joiner animation.** Should a late joiner see the settle animation, or accept the instant placement?
6. **Reduced motion.** Native needs a decision on the OS reduce-motion setting for the wheel spin, the settle, the win toast count-up, and the framer-motion springs.
7. **Perf-lite fallback.** The web app has no plain fallback for the blur glows and backdrop blur on these components. Confirm whether native should use a plain fallback under low power mode.
8. **Dead components.** `ActiveBetsList.tsx` and `GameStatusBar.tsx` are not mounted. Drop them from the native port, or keep them?
9. **Dead style variable.** `--roulette-mobile-stake-top-anchor` is set but never read. Drop it in native.
10. **Sheet height on iOS.** Confirm the mobile stake sheet height in an iOS standalone context before copying `max-h-[85dvh]`.
11. **Stake preset rule.** Should presets be disabled above the balance on both platforms, or only on mobile?
12. **Win sound and haptic re-fire.** Confirm in a browser whether the win chime, haptic and confetti re-fire after a remount while the latest win is still in state.
13. **Mobile sound button overlap.** Confirm in a browser that the `top-20` sound button does not cover the wheel frame on phones.
14. **Haptic mapping.** Map `vibrateCasino(35)` and the win pattern `[60, 40, 90]` to native haptics, and decide whether mute should also silence haptics.
15. **Share payload.** Confirm the Social share copy and payload fields for native, including the winning-number variant of the content.
