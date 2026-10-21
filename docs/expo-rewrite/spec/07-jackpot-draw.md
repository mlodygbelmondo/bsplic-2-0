# 07. Jackpot draw page: `/jackpot/draw/:roundId`

Target: a 1:1 native Expo rebuild, phone layout at 390px width. This spec describes the web implementation as it exists in `expo-native-rewrite`. Literal Polish copy is quoted verbatim. Data API wrappers are summarized here and documented in `19-data-contract.md`.

Phases in one line: loading, empty, intro, drawing, revealed, plus a separate rolled_over branch.

---

## 1. Files covered

| File | Lines | Role |
|---|---|---|
| `src/features/jackpot/pages/JackpotDrawPage.tsx` | 791 | Page component (`JackpotDrawExperience`, default export wires it to the router and data API) |
| `src/features/jackpot/styles/jackpotDrawPage.css` | 1325 | All page styles, keyframes, media queries (max-width 1180px at line 1111, 820px at 1125, 560px at 1168) |
| `src/features/jackpot/types.ts` | 80 | `DailyJackpotDraw`, `DailyJackpotParticipant`, `DailyJackpotClaimResult`, `DailyJackpotStatus`, `DailyJackpotRewardCreditStatus` |
| `src/features/jackpot/lib/jackpotFormat.ts` | 45 | `formatJackpotAmount` (used only in the claim toast). `getDrawTimeLabel` and `getParticipantProgressLabel` are not used by this page |
| `src/features/jackpot/api/jackpot.ts` | 280 | RPC wrappers at lines 240-280 (`getDailyJackpotDraw`, `revealDailyJackpotDraw`, `claimDailyJackpotReward`) |
| `src/features/jackpot/pages/JackpotDrawPage.test.tsx` | 469 | 15 `it` cases in one describe block (line 119; cases at 137-451) |
| `src/features/jackpot/pages/JackpotDevFlowPage.tsx` | 400-407 used | Second consumer, dev-only. Passes `initialDraw`, which skips the load path |
| `src/components/ui/button.tsx` | 47 | `Button` (cva + Radix Slot). Used for three buttons on this page |
| `src/App.tsx` | 186 | Route `/jackpot/draw/:roundId` inside `AuthenticatedRoute` |
| `src/lib/boot/route-modules.ts` | 21-22, 36 | `loadJackpotDrawPage` lazy loader and registration |
| `src/lib/boot/preload.ts` | 76-81 | Background artwork warm-up list |
| `src/features/jackpot/components/DailyJackpotCard.tsx` | 179 | Entry point (see 2.1) |

Static assets:

| Path | Size | Used by |
|---|---|---|
| `public/jackpot/jackpot-draw-stage.webp` (1530x634) | 88292 B | Stage background artwork |
| `public/jackpot/jackpot-ticket.webp` (1256x812) | 70754 B | Flying ticket |
| `public/jackpot/jackpot-winning-ticket.webp` (1213x647) | 40936 B | Revealed winner card |
| `public/casino/roulette-background.webp` | n/a | Page background (CSS, `center / cover fixed`) |

---

## 2. Surfaces

### 2.1 Route and entry

- Route: `/jackpot/draw/:roundId`, behind `AuthenticatedRoute` (`App.tsx:186`). Logged-out users never reach it.
- Entry: `DailyJackpotCard.tsx:179` calls `window.location.assign(\`/jackpot/draw/${snapshot.poolId}\`)`. This is a full-page navigation, not a router push.
- The route param is named `roundId` but is passed as the pool id to every RPC. The page's `roundId` prop maps to `poolId`.
- Route chunk is lazy (`route-modules.ts:21-22`). Boot preload warms it after sign-in (`route-modules.ts:36`).

### 2.2 Phase and branch selection

| Branch | Condition | Root element |
|---|---|---|
| Loading | `loading` true (initial when no `initialDraw`) | `main.jackpot-draw-page > .jackpot-draw-shell` |
| Empty | not loading and `draw` is null (load failed, missing roundId, or empty result) | `main.jackpot-draw-page > .jackpot-draw-shell` |
| Rolled over | `draw.status === 'rolled_over'` | `main.jackpot-draw-page.jackpot-draw-page--replay > .jackpot-replay-shell` |
| Main | otherwise; sub-phase `phase` is `intro`, `drawing`, or `revealed` | `main.jackpot-draw-page.jackpot-draw-page--replay > .jackpot-replay-shell` |

The `phase` value is written to the stage class: `jackpot-draw-stage--intro`, `--drawing`, `--revealed`.

### 2.3 Shared back button

- Element: `button.jackpot-draw-icon-back`, `aria-label="Wróć do poprzedniego widoku"` (TSX lines 164-165).
- Icon: lucide `ArrowLeft`, `className="h-4 w-4"`.
- Action: `onBack`, which the default export sets to `navigate('/')`.
- Top bar: `div.jackpot-draw-topbar`, `min-height: 2.2rem` at 390px, set only in the 560px block (CSS 1174-1175); the base rule has no min-height. Back button width `2.1rem` at 390px (CSS 1177-1178, same block).

### 2.4 Loading

- Markup: `div.jackpot-draw-loading` inside the shell.
- Icon: lucide `Loader2`, `className="h-5 w-5 animate-spin"`.
- Copy: **"Ładowanie losowania"**.
- The page does not call `useBootHold`. No `useBootHold` use exists in `src/features/jackpot/`.

### 2.5 Empty

- Top bar with the back button (2.3).
- `section.jackpot-draw-empty`, copy: **"Nie znaleziono tego losowania."**

### 2.6 Rolled over (status `rolled_over`)

Rendered inside `main.jackpot-draw-page.jackpot-draw-page--replay > .jackpot-replay-shell`.

- Top bar title: **"Losowanie z {numericDrawDate}"** (`numericDrawDate` = `dd.MM.yyyy`, Intl `pl-PL`, `Europe/Warsaw`).
- Hero: `section.jackpot-draw-hero`, `aria-labelledby="jackpot-draw-title"`.
  - h1 (`id="jackpot-draw-title"`): **"Pula przeszła na kolejny dzień"**
  - p: `{formatDrawDate(poolDate)}, pula <strong>{prizeAmountLabel}</strong>`
- Meta: `div.jackpot-draw-hero__meta`, `aria-label="Dane rundy"`. Three cells labelled **"Graczy"** (`participantCount`), **"Ticketów"** (`ticketCount`), **"Finał"** (value **"20:00"**).
- Stage: `section.jackpot-draw-stage`, `aria-live="polite"`.
  - `div.jackpot-draw-result`
  - `div.jackpot-draw-result__icon` with lucide `Ticket`, `className="h-7 w-7"`
  - `p.jackpot-draw-result__label`: **"Brak losowania"**
  - `h2`: **"Pula została przeniesiona"**
  - `p.jackpot-draw-result__ticket`: **"Tickety z tej rundy zostały rozliczone bez reveal i claim."**
- No actions, no roster, no reveal, no claim.

### 2.7 Main branch: summary header

Top bar: back button (2.3) and title **"Losowanie z {numericDrawDate}"**.

Summary hero: `section.jackpot-draw-hero.jackpot-draw-hero--summary`, `aria-label="Dane losowania"`.

`div.jackpot-draw-hero__meta`, `aria-label="Dane rundy"`, four cells. Each cell is a label `span` plus a value `strong`:

| Label | Value | Notes |
|---|---|---|
| Pula | `prizeAmountLabel` | `formatJackpotHeroAmount` (section 5) |
| Data losowania | `formatDrawDate(poolDate)` plus `<small>20:00</small>` | Time is hard-coded text |
| Graczy | `draw.participantCount` | Plus `sr-only` label `participantCountLabel` |
| Ticketów | `draw.ticketCount` | Plus `sr-only` label `ticketCountLabel` |

User ticket pill: `div.jackpot-draw-user-tickets`, `aria-label="Twoje numery ticketów"`. Rendered only when the current user has tickets.

- `span`: **"Twoje tickety"**
- `strong`: labels joined with a space, each `#NN` (zero-padded to 2 digits).

### 2.8 Stage (intro, drawing, revealed)

Wrapper: `div.jackpot-replay-layout` containing `section.jackpot-draw-stage.jackpot-draw-stage--{phase}`, `aria-live="polite"`.

- Title: `div.jackpot-stage-title`, `aria-hidden`. Markup: `<span>◆</span> Tickety w puli <span>◆</span>`. Visible in intro and drawing; hidden (`opacity: 0`) when revealed.
- Background image: `img.jackpot-stage-asset`, `src="/jackpot/jackpot-draw-stage.webp"`, `alt=""`, `aria-hidden="true"`. Positioned absolutely at `left: 50%; top: 48%; width: min(90%, 52rem); max-height: 72%`, with `transform: translate(-50%, -50%)` and `filter: drop-shadow(0 34px 35px hsl(0 0% 0% / 0.62))`.
  - Intro and default: float animation `jackpot-stage-float 6s ease-in-out infinite`.
  - Drawing: `jackpot-stage-float 1.8s ease-in-out infinite, jackpot-stage-shake 220ms linear infinite`.
  - Revealed: `opacity: 0.28; animation: none; filter: blur(0.6px) saturate(0.84) drop-shadow(0 34px 35px hsl(0 0% 0% / 0.58)); transform: translate(-50%, -50%) scale(0.94)`.
- Stage box: `min-height: clamp(23rem, 47vh, 29rem)` (desktop), `min-height: 18rem` at 560px and below. Radius `0.82rem`, border `1px solid hsl(34 70% 42% / 0.16)`.

### 2.9 Intro

- Stage shows the artwork and title. No overlay, no reveal card.
- Actions: `div.jackpot-draw-actions`, with one button:
  - `Button` (`variant={null} size={null}`), `type="button"`, `className="jackpot-draw-primary"`, `onClick={startReplay}`.
  - Icon: lucide `Play`, `className="h-5 w-5"`.
  - Label: **"Obejrzyj losowanie"** when `draw.resultViewedAt` is set, otherwise **"Rozpocznij losowanie"**.

### 2.10 Drawing overlay

Rendered while `phase === 'drawing'`. Element: `motion.div.jackpot-ticket-flight` (framer-motion element with no animate props; motion is CSS).

- Header: `div.jackpot-ticket-flight__header`
  - `span`: **"Losowanie ticketów"**
  - `strong`: `formatPolishCount(drawTickets.length, 'ticket', 'tickety', 'ticketów')`. Note: this counts all tickets, not the sampled 18.
- Track: `ul.jackpot-ticket-flight__track`, `aria-label="Animowane tickety w puli"`.
- Each `li.jackpot-flight-ticket` (key `ticket.key` = `${userId}-${ticketNumber}`), with inline custom properties:
  - `--ticket-index`: index in the visible list
  - `--ticket-count`: `visibleDrawTickets.length` (set in TSX, not referenced by any CSS rule)
  - `--ticket-lane-offset`: `${lane}rem`
  - `--ticket-lane-tight`: `${lane * 0.45}rem`
  - `--ticket-lane-invert`: `${lane * -0.35}rem`
  - `lane = (index % 5) - 2`, so values run -2 to 2 rem
  - `--ticket-delay`: winner: `-1.683s`. Others: `calc(${index} * -0.22s)`
- Child image: `img.jackpot-flight-ticket__asset`, `src="/jackpot/jackpot-ticket.webp"`, `alt=""`, `aria-hidden="true"`.
- Number: `span.jackpot-flight-ticket__number`, text `#{ticket.ticketLabel}` (zero-padded, e.g. `#05`).
- Flight ticket width: `clamp(7.6rem, 10.4vw, 9.4rem)` (desktop), `6rem` at 560px and below. Aspect ratio `1.54`.

Visible sample: `getVisibleDrawTickets` (section 5) reduces the list to at most 18 tickets.

Actions area while drawing: `div.jackpot-draw-progress` with lucide `Loader2` (`className="h-4 w-4 animate-spin"`) and text **"Losowanie trwa"**. No button.

### 2.11 Revealed

- Reveal card: `motion.div.jackpot-stage-reveal`, positioned `top: 50%`, z-index 9. Width `min(34rem, calc(100% - 1.3rem))` (desktop), `calc(100% - 1.4rem)` at 560px and below. Gap `0.42rem` (desktop), `0.36rem` at 560px.
  - Motion props: `initial={reducedMotion ? false : { opacity: 0 }}`, `animate={reducedMotion ? undefined : { opacity: 1 }}`, `transition={{ duration: 0.28, ease: 'easeOut' }}`.
- Status row: `div.jackpot-stage-reveal__status` with lucide `Trophy` (`className="h-4 w-4"`) and text **"Wynik losowania"**. This row is `display: none` in CSS, so it is not visible.
- Heading (h2): **"Wygrywa {draw.winnerUsername ?? 'zwycięzca'}"**. Size 1rem at 560px and below.
- Winner card: `div.jackpot-stage-reveal__ticket-wrap`
  - Image: `img.jackpot-stage-reveal__ticket-art`, `src="/jackpot/jackpot-winning-ticket.webp"`, `alt=""`, `aria-hidden="true"`.
  - Copy block `div.jackpot-stage-reveal__ticket-copy`:
    - `span.jackpot-stage-reveal__label`: **"Zwycięski ticket"**
    - `strong.jackpot-stage-reveal__ticket`: `winnerTicketLabel`. Font 1.42rem at 560px and below.
- Prize line: `p` with **"Wygrana "** followed by `<strong>{prizeAmountLabel}</strong>`.
- Winner card animation: `jackpot-winning-ticket-pop 700ms cubic-bezier(0.18, 0.85, 0.2, 1.18) both`. One-shot. Width `min(25.5rem, 90%)` (desktop), `min(18.5rem, 94%)` at 560px and below. Aspect ratio `1.88`.
- Claim button (only when `canClaim`):
  - `Button` (`variant={null} size={null}`), `className="jackpot-stage-claim"`, `disabled={claiming}`.
  - Icon: `Loader2` (`className="h-4 w-4 animate-spin"`) while `claiming`, otherwise `Gift` (`className="h-4 w-4"`).
  - Label: **"Odbierz nagrodę"**.
  - Height `min-height: 2.5rem`, width `min(13rem, 100%)` (desktop), `width: 100%`, `min-height: 2.35rem` at 560px and below.
- Reward badge: `div.jackpot-draw-claimed`, rendered when `rewardStateLabel` is non-null. Icon `CheckCircle2` (`className="h-4 w-4"`). Text is one of:
  - **"Nagroda odebrana"** when `rewardCreditStatus === 'claimed'`
  - **"Nagroda została dodana automatycznie"** when `rewardCreditStatus === 'auto_credited'`

Revealed layout: the stage artwork drops to `opacity: 0.28` with no animation (2.8).

Actions when revealed: no primary button. The claim button and badge are the only controls in the stage.

### 2.12 Roster

Container: `aside.jackpot-draw-roster`, `aria-label="Uczestnicy i ich tickety"`. Adds class `jackpot-draw-roster--expanded` when expanded.

- Header: lucide `Users` (`className="h-5 w-5"`) and `h2` **"Uczestnicy i ich tickety"**.
- Column labels: **"Uczestnik"** and **"Tickety"**.
- List: `div.jackpot-draw-roster__list` of `article.jackpot-roster-row` (one per participant, first 10 unless expanded).
  - Index: `span`, `index + 1`.
  - Avatar: `div.jackpot-result-avatar`. Shows `img` when `avatarUrl` is set, otherwise initials (`getInitials`).
  - Name: `strong`, `username`.
  - Tickets: `div.jackpot-ticket-list`, first 3 ticket numbers as `span` chips, `formatTicketNumber` (zero-padded).
  - `sr-only` span with the Polish plural count for that participant (los/losy/losów).
- No visible overflow indicator for tickets beyond 3. Only the sr-only count reflects the total.
- Toggle: `button.jackpot-roster-more`, rendered when `participants.length > 10`.
  - `aria-expanded={rosterExpanded}`
  - Label: **"Pokaż wszystkich ({draw.participantCount})"** collapsed, **"Pokaż mniej"** expanded.
  - Icon: lucide `ChevronDown` (`className="h-4 w-4"`), with `rotate-180` and `transition-transform` when expanded.

### 2.13 390px layout values

Base values are the desktop rules. The 560px block (CSS 1168-1250) applies at 390px. Root size is assumed 16px, so 1rem = 16px.

Page and shell:

- Background: radial gradients, `linear-gradient(180deg, hsl(0 0% 0% / 0.58), hsl(0 0% 0% / 0.78))`, and `url("/casino/roulette-background.webp") center / cover fixed`. Note: `background-attachment: fixed` is not honored by iOS WebKit.
- Page min-height: `var(--app-viewport-height)`. Text color `hsl(0 0% 96%)`.
- Replay shell: base `width: min(86rem, calc(100% - 1.5rem))`. At 560px and below: `width: min(100% - 0.75rem, 111rem)` (378px at 390px), `padding-inline: 0.8rem`. Radius 1rem. Border `1px solid hsl(0 0% 100% / 0.14)`. Background `hsl(0 0% 8% / 0.78)` to `hsl(0 0% 2% / 0.86)`. `backdrop-filter: blur(12px)`.

Header and meta:

- Back button width `2.1rem`. Top bar min-height `2.2rem`.
- Hero h1 `1.35rem`. Hero p `0.78rem` with `line-height: 1.3`.
- Meta grid: 2 columns, `gap: 0.36rem`. Each cell `min-height: 3.15rem`, `padding: 0.44rem`.

Stage:

- Stage min-height `18rem` (288px).
- Stage title: `top: 0.9rem`, `font-size: 0.68rem`, `letter-spacing: 0.12em`, color `hsl(39 100% 66%)`, weight 780, uppercase. Span color `hsl(39 100% 58%)`, size `0.75rem`.
- Stage radius `0.82rem`. Border `1px solid hsl(34 70% 42% / 0.16)`.

Actions:

- Primary button and progress and claimed badge: `width: 100%`, `min-width: 0`, `min-height: 2.7rem`.
- Primary button base: radius `0.6rem`, gradient `hsl(354 100% 57%)` to `hsl(353 91% 45%)`, font `clamp(0.78rem, 0.98vw, 0.88rem)` weight 800. Desktop min-width `min(14.5rem, 100%)`. Actions are absolutely positioned at `bottom: 1rem`, centered, `gap: 0.65rem`.

Flight overlay:

- Inset `2.55rem 0.65rem 4.35rem` (desktop: `2.85rem 1rem 4.6rem`). Gap `0.45rem`. z-index 5. `pointer-events: none`.
- Track min-height `7.7rem` (desktop `12.5rem`). Overflow hidden.
- Header `font-size: 0.68rem`.
- Ticket width `6rem`. Number `font-size: 0.96rem` (desktop `clamp(1rem, 1.35vw, 1.2rem)`, weight 900, color `hsl(25 52% 15%)`).
- Keyframe x positions at 560px and below: start `-64vw`, entry `-12vw`, center `0vw`, exit `12vw`, end `64vw`. Desktop: entry `-12vw`, center `2vw`, exit `18vw`.

Reveal card:

- `top: 50%`, width `calc(100% - 1.4rem)`, gap `0.36rem`.
- Heading `1rem`. Body `0.72rem`. Winner ticket label `1.42rem`.
- Winner card width `min(18.5rem, 94%)`.
- Claim button: `width: 100%`, `min-height: 2.35rem`.

Roster:

- Max-height `16.25rem` (desktop `clamp(23rem, 49vh, 30rem)`). Padding `0.85rem`.
- Expanded: `min(22rem, 42vh)` (desktop `clamp(25rem, 58vh, 34rem)`).
- Toggle: `min-height: 2.2rem`, `margin-top: 0.45rem`.
- Row grid: `1.15rem 1.85rem minmax(0, 1fr) auto`, `gap: 0.38rem`. Desktop row min-height `2.65rem`.
- Chip: `min-width: 1.62rem`, `min-height: 1.36rem`, `font-size: 0.64rem`. Ticket list (`.jackpot-ticket-list`, CSS 624) uses `justify-content: flex-end`. The 560px block sets it again for `.jackpot-roster-row .jackpot-ticket-list` (CSS 1276).
- Avatar: `.jackpot-result-avatar` width `2rem` (CSS 602-604). The avatar rule is not listed in the 560px block; that block changes only the roster grid column (1.85rem).

Border, radius, and shadow for the roster: border `1px solid hsl(0 0% 100% / 0.1)`, radius `0.9rem`, shadow `0 22px 54px hsl(0 0% 0% / 0.42)`, backdrop blur 14px.

### 2.14 Icons, images, and copy inventory

Lucide icons used on this page: `ArrowLeft` (h-4 w-4, back), `Play` (h-5 w-5, primary button), `Loader2` (h-5 w-5 loading, h-4 w-4 spin in progress and claiming), `Ticket` (h-7 w-7, rolled over), `Trophy` (h-4 w-4, hidden status row), `Gift` (h-4 w-4, claim), `CheckCircle2` (h-4 w-4, reward badge), `Users` (h-5 w-5, roster header), `ChevronDown` (h-4 w-4, roster toggle).

Images: the four files listed in section 1, plus remote `avatarUrl` values in the roster.

Polish plural helper `formatPolishCount(count, singular, few, many)`: absolute value 1 gives singular. Last digit 2-4 and not 12-14 gives `few`. Anything else gives `many`.

- Participants: "gracz", "gracze", "graczy" (`participantCountLabel`).
- Tickets for a draw: "los", "losy", "losów" (`ticketCountLabel`).
- Flight header: "ticket", "tickety", "ticketów".

Toasts (sonner):

- "Nie udało się wczytać losowania" (load failure fallback)
- "Nie udało się odsłonić pełnego wyniku" (reveal response lacks winner details; thrown by the page)
- "Nie udało się odsłonić wyniku" (fallback when reveal error has no message)
- "Odebrano {formatJackpotAmount(amount)}" (claim success, `position: 'bottom-center'`)
- "Nagroda była już dodana" (claim success when `alreadyCredited`, `position: 'bottom-center'`)
- "Nie udało się odebrać nagrody" (claim failure fallback)

Errors thrown by the API wrappers (shown through `error.message`): "Nie znaleziono losowania Jackpotu" (missing `pool_id` on draw), "Nie udało się odebrać nagrody Jackpot" (missing `pool_id` on claim result).

---

## 3. Choreography

### 3.1 Drawing timeline (per ticket)

Total cycle: 3300 ms (`DRAWING_FLIGHT_MS`). Timeline starts when `phase` becomes `drawing`. Each ticket is an independent infinite CSS animation with a negative delay, so tickets are already mid-cycle at mount.

Keyframe values (CSS 1019-1053):

| Elapsed (ms) | Keyframe | x (desktop) | x (560px and below) | Other transform | Opacity | Event |
|---|---|---|---|---|---|---|
| 0 | 0% | `-64vw` (start) | `-64vw` | `rotate(-18deg) scale(0.76)` | 0 | Overlay mounts |
| 330 | 10% | | | | 0.88 | |
| 1122 | 34% | `-12vw` (entry) | `-12vw` | `rotate(8deg) scale(1.05)`, Y uses `--ticket-lane-tight` | 1 | |
| 1683 | 51% | `2vw` (center) | `0vw` | `rotate(-5deg) scale(1.14)`, Y uses `--ticket-lane-invert` | 1 | Winner sits here at mount |
| 2244 | 68% | `18vw` (exit) | `12vw` | `rotate(5deg) scale(0.98)`, Y uses `--ticket-lane-tight` | 0.98 | |
| 3300 | 100% | `64vw` (end) | `64vw` | `rotate(18deg) scale(0.78)` | 0 | Timer fires (see 3.3) |

The keyframes set opacity at 0%, 10%, 34%, 51%, 68%, and 100%. Values between stops are interpolated. The Y offset at 0% and 100% is `calc(-50% + var(--ticket-lane-offset, 0rem))`.

### 3.2 Winner pinning

- Winner delay: `WINNING_TICKET_ANIMATION_DELAY_SECONDS = -((3300 / 1000) * 0.51) = -1.683s`.
- At mount, the winner is 1.683 s into its cycle, which is 51% (center keyframe).
- The finish timer fires 3300 ms later. The winner is at `1.683 + 3.300 = 4.983 s`, modulo 3.3 s, which is `1.683 s` again. So the winner is at center exactly when the reveal card replaces the overlay.
- Winner identity is known only after reveal (`winningTicketNumber` non-null). Before that, no ticket gets the winner delay, so all tickets use index-based delays. See the mid-flight reorder in section 6.

### 3.3 Timer and reveal ordering

- On `startReplay`, the reveal RPC starts at click time (not after the timer), unless the draw is already viewed and has winner details (see 4.2).
- A 3300 ms timeout is set. When it fires, the page waits for the reveal promise, then sets the revealed draw and `phase = 'revealed'`.
- If the reveal resolves before the timer, `setDraw` runs early (inside the reveal `.then`), so the flight list can change while the flight is running.
- If the reveal is slower than 3300 ms, the drawing phase stays on screen until it resolves.

### 3.4 Reduced motion

- JS: flight timer is `REDUCED_MOTION_FLIGHT_MS = 160` ms instead of 3300 ms.
- CSS (block at 1295-1325): `animation: none` on `.jackpot-stage-asset`, `.jackpot-draw-stage--drawing .jackpot-stage-asset`, `.jackpot-flight-ticket`, `.jackpot-claim-icon`, `.jackpot-result-hero__confetti`.
- The flight track becomes a centered wrapping flex grid (`display: flex; flex-wrap: wrap; justify-content: center; gap: 0.5rem; overflow: visible`). Tickets become `position: relative; transform: none; opacity: 1`.
- Reveal card: no fade (`initial={false}`, no animate).
- Primary button: only background-color and filter transitions, no hover lift.
- Not disabled: the winning-ticket pop (`jackpot-winning-ticket-pop`, 700 ms) is not in the reduced-motion list. See section 6.

### 3.5 State machine

```
            loadDraw ok (not cancelled)
loading ───────────────────────────────► intro ◄──────────────────────┐
  │                                       │                           │
  │ load error / no roundId                │ click primary button      │ timer fired AND reveal failed
  ▼                                       ▼                           │ (toast, back to intro)
 empty (draw null)                     drawing ──────────────────────┘
                                          │
                                          │ timer fired AND reveal resolved
                                          ▼
                                       revealed ──click claim──► claiming ──► revealed (rewardCreditStatus updated)

rolled_over: separate branch chosen by draw.status. No phase transitions.
initialDraw present: skip load; loading false; phase intro.
```

Transition table:

| From | Event | Guard | Effect | To |
|---|---|---|---|---|
| loading | `loadDraw` resolves | not cancelled | `setDraw`, `setPhase('intro')` | intro |
| loading | `loadDraw` rejects | not cancelled | `toast.error(msg or fallback)`; loading false | empty (draw still null) |
| loading | `roundId` missing | | `setLoading(false)` | empty |
| intro | primary click | `draw && phase === 'intro'` | `setPhase('drawing')`; clear previous timer; start reveal (or reuse cached); set 3300/160 ms timer | drawing |
| drawing | timer fires and reveal resolves | | `setDraw(revealed)`; `setPhase('revealed')` | revealed |
| drawing | timer fires and reveal rejects | | `toast.error(msg \|\| 'Nie udało się odsłonić wyniku')`; `setPhase('intro')` | intro |
| drawing | unmount | | clear timer (reveal promise is not cancelled) | gone |
| revealed | claim click | `canClaim && !claiming` | `setClaiming(true)`, call claim RPC | revealed |
| revealed | claim resolves | | merge reward fields into `draw`; `await refreshProfile`; success toast | revealed |
| revealed | claim rejects | | `toast.error(msg \|\| 'Nie udało się odebrać nagrody')` | revealed |
| any | claim or load settles | | `claiming` or `loading` reset in `finally` | |

---

## 4. Data contract

### 4.1 API functions

| Function (`api/jackpot.ts`) | Lines | RPC | Args | Called when | Result |
|---|---|---|---|---|---|
| `getDailyJackpotDraw(poolId)` | 240-252 | `get_daily_jackpot_draw` | `{ p_pool_id: poolId }` | Mount, when `initialDraw` is absent and `roundId` is set. Also the `loadDraw` prop | `DailyJackpotDraw` (normalized) |
| `revealDailyJackpotDraw(poolId)` | 254-266 | `reveal_daily_jackpot_draw` | `{ p_pool_id: poolId }` | Primary click, unless the cached draw is already viewed with winner details | `DailyJackpotDraw` (normalized) |
| `claimDailyJackpotReward(poolId)` | 268-280 | `claim_daily_jackpot_reward` | `{ p_pool_id: poolId }` | Claim button click | `DailyJackpotClaimResult` (first element when the response is an array) |

Error handling in every wrapper: `if (error) throw new Error(error.message)`.

Normalization (from the wrapper file): `normalizeDailyJackpotDraw` throws "Nie znaleziono losowania Jackpotu" if `pool_id` is missing. `minUniqueUsers` defaults to 3. `serverNow` defaults to the current time. `normalizeClaimResult` throws "Nie udało się odebrać nagrody Jackpot" if `pool_id` is missing.

### 4.2 Call timing

- Load: once per `roundId` (effect deps `[initialDraw, loadDraw, roundId]`). The effect has a `cancelled` flag, so a route change during load is ignored.
- Reveal: only on primary click. Skipped when `draw.resultViewedAt` is set and `hasVisibleWinnerDetails(draw)` is true. In that case the cached draw is reused and no RPC call happens.
- Claim: only on claim click. Guarded by `claiming`.
- No polling. No realtime channel. No `serverNow` use. No `visibilitychange` handler. No localStorage. No sound.

### 4.3 Draw fields read

Read as `draw.<field>` in `JackpotDrawPage.tsx`: `poolId`, `poolDate`, `status`, `prizeAmount`, `participantCount`, `ticketCount`, `participants`, `winnerUserId`, `winnerUsername`, `winningTicketNumber`, `resultViewedAt`, `rewardCreditStatus`, `currentUserIsWinner`.

Used through the same object without the `draw.` prefix: the winner details check reads winner fields, and the roster reads `participants[].{userId, username, avatarUrl, ticketNumbers, ticketCount}`.

Not read by this page: `drawScheduledAt`, `drawnAt`, `ticketPrice`, `minUniqueUsers`, `currentUserHasTicket`, `currentUserTicketCount`, `rewardCreditEventId`, `winnerAvatarUrl`, `serverNow`.

Claim result fields read by the page: `amount` and `alreadyCredited` feed the toast (`alreadyCredited` picks the message; otherwise `formatJackpotAmount(amount)`). `rewardCreditStatus`, `rewardClaimedAt`, and `rewardAutoCreditedAt` are merged into `draw` (TSX lines 366-368). `poolId` and `balanceAfter` are not read.

Auth context: `useAuth()` supplies `user?.id` (passed as `currentUserId`) and `refreshProfile` (passed as `refreshAfterClaim`, so balance refreshes after a claim).

### 4.4 Query keys, storage keys, realtime, preload

- React Query: none. The page keeps `draw` in local state. It does not use a query factory and does not use `PAGE_DATA_QUERY_OPTIONS`.
- Storage keys: none.
- Realtime channels: none.
- Boot preload: the route chunk is warmed (`route-modules.ts:21-22, 36`). No first-screen data is prefetched for this page. Background images are warmed (`preload.ts:76-81`): `/jackpot/jackpot-draw-stage.webp`, `/jackpot/jackpot-ticket.webp`, `/jackpot/jackpot-winning-ticket.webp`, `/casino/roulette-background.webp`.

---

## 5. Business rules

### 5.1 Timing constants

| Name | Value | Meaning |
|---|---|---|
| `DRAWING_FLIGHT_MS` | 3300 | Duration of the full draw animation |
| `REDUCED_MOTION_FLIGHT_MS` | 160 | Duration when reduced motion is on |
| `WINNING_TICKET_CENTER_PROGRESS` | 0.51 | Keyframe fraction where the winner is centered |
| `WINNING_TICKET_ANIMATION_DELAY_SECONDS` | -1.683 | Negative delay that pins the winner at 51% at mount |
| Flight keyframe delay step | 0.22 s per index | Non-winner stagger |
| Ticket pop | 700 ms | Winner card entrance |
| Reveal fade | 280 ms, `easeOut` | Reveal wrapper |
| Stage shake | 220 ms linear | Drawing state only |

### 5.2 Visible ticket sample

`getVisibleDrawTickets(drawTickets, winningTicketNumber)`:

- If the list has 18 or fewer tickets, all are shown and the winner (if known) is moved last.
- Otherwise: stride `ceil(length / 18)`, keep indices where `index % stride === 0`, slice to 18, keep 17 non-winners, and append the winner.
- Result is capped at 18 animated tickets. The header count still shows the full count.

### 5.3 Winner display

- Heading: `Wygrywa {winnerUsername}`, or `zwycięzca` when the name is null.
- Ticket label: `Ticket #${winningTicketNumber}` (unpadded). Falls back to `Ticket zwycięzcy` when the number is falsy.
- Winner details are visible only when `winnerUserId`, `winnerUsername`, and `winningTicketNumber !== null` are all set (`hasVisibleWinnerDetails`).
- Winner avatar is not shown on this page (`winnerAvatarUrl` is unused).

### 5.4 Claim rules

- Eligible when: `revealed && draw.currentUserIsWinner && draw.rewardCreditStatus === 'pending'`.
- Once claimed, `rewardCreditStatus` becomes `'claimed'`, the button disappears, and the badge reads "Nagroda odebrana".
- `auto_credited` shows the badge "Nagroda została dodana automatycznie" and no button.
- `alreadyCredited` from the RPC gives the toast "Nagroda była już dodana" instead of the amount toast.
- The claim toast runs after `await refreshAfterClaim()`.

### 5.5 Roster rules

- Shows the first 10 participants until expanded. The expand toggle appears when `participants.length > 10`.
- Each row shows up to 3 ticket chips. The full count is only in an sr-only label.
- Initials: `username.trim().slice(0, 2).toUpperCase()`, or `??` when empty.
- Ticket chips: `formatTicketNumber`, `String(n).padStart(2, '0')`.
- Participant order is the order from the API.

### 5.6 Current user ticket pill

- Lists all the current user's ticket numbers, sorted, each formatted `#NN`, joined with a space.
- Rendered only when the list is non-empty.

### 5.7 Formatting

- Draw date (`formatDrawDate`): Intl `pl-PL`, `day: '2-digit'`, `month: 'long'`, `timeZone: 'Europe/Warsaw'`, applied to `${poolDate}T12:00:00.000Z`. The noon UTC anchor keeps the calendar day stable in Warsaw.
- Numeric date (`formatDrawDateNumeric`): Intl `pl-PL`, day and month `2-digit`, year `numeric`, same zone and anchor.
- Hero amount (`formatJackpotHeroAmount`): non-finite becomes 0. Fraction digits are 2 when the value is not an integer, otherwise 0. Grouping is on (default pl-PL). Suffix ` zł`.
- Toast amount (`formatJackpotAmount`, `jackpotFormat.ts:7-18`): always 2 fraction digits, grouping off, whitespace normalized to a plain space, suffix ` zł`.
- Hero and toast therefore format the same amount differently (grouped versus ungrouped).
- Draw time: the text `20:00` is hard-coded in two places (meta "Finał" cell and the "Data losowania" cell). `drawScheduledAt` is not displayed.

---

## 6. Edge cases and gotchas

### 6.1 Resume

- `phase` is not persisted. Every load starts at `intro`. Reloading during `drawing` returns to `intro`.
- After a viewed draw, the button label is "Obejrzyj losowanie". The next click reuses the cached draw only if `resultViewedAt` is set and winner details are visible. Otherwise `revealDraw` is called again.
- A draw that was already revealed but not claimed returns to the `intro` phase with the claim button hidden. The claim button appears only after the reveal sequence runs again (`phase` becomes `revealed` via the click path). Confirm this is intended: `phase` starts at `intro` even when `draw.resultViewedAt` is set and the claim is pending.

### 6.2 Backgrounding

- Web: JS timers may be throttled while the tab is hidden. CSS animations keep wall-clock time, so the flight can finish while the timer is late. There is no `visibilitychange` handler, so a late timer simply delays the reveal.
- Native: the port must choose one clock. Options are a JS timer (may pause in background) or animation-driven completion. The reveal must not be shown while the flight is still on screen.

### 6.3 Reduced motion

- Reads `prefers-reduced-motion` through `matchMedia('(prefers-reduced-motion: reduce)')` in `usePrefersReducedMotion`. On native, use the platform reduce-motion setting.
- The winning-ticket pop is not disabled by the reduced-motion block (see 3.4).
- Under reduced motion the drawing phase still lasts 160 ms, so the user sees a static grid for a short moment before the reveal.

### 6.4 Perf-lite

- No `html.perf-lite` check and no `usePerfLite` use on this page.
- Infinite animations that are not gated: stage float 6 s (CSS 230), drawing stage float 1.8 s and shake 220 ms (CSS 233-235), flight 3.3 s per ticket (CSS 356).
- Project rule (AGENTS.md) requires decorative infinite animations to stop under `html.perf-lite`. This page does not follow that rule. The native port should stop these loops in low-power mode.
- Heavy effects without a plain fallback: `backdrop-filter: blur(12px)` on the replay shell, `blur(14px)` on the roster, and `drop-shadow` filters on the stage artwork.

### 6.5 Races

- Unmount during drawing: the cleanup clears the timer. The reveal promise is not cancelled, so its `setDraw` still runs on an unmounted component. Under React 18 this is a no-op, but the RPC still completes and the native port should guard it with a mounted ref or abort flag.
- Mid-flight reveal: `setDraw(revealed)` can run before the timer fires. `winningTicketNumber` changes from null to a value, which changes `getVisibleDrawTickets` output (winner moved last, sample may change) and the winner's `--ticket-delay`. This can reorder DOM nodes and restart or jump running CSS animations. Decide whether to freeze the flight list at drawing start.
- Reveal error before the timer: the rejection is caught silently (`revealPromise.catch(() => undefined)`) and surfaced only when the timer fires. The toast then appears at the end of the flight.
- Double tap on the primary button: the guard reads `phase`, which is async state. `startReplay` clears any existing timer, but both reveal promises would still run. Use a ref, not state, for the guard in the port.
- Claim double submit: guarded by `claiming` (button `disabled` and early return). Reset in `finally`.
- Claim success followed by refresh failure: the draw is updated, then `await refreshAfterClaim()` runs. If refresh rejects, the catch block shows "Nie udało się odebrać nagrody" even though the claim succeeded. Consider separating refresh from the claim error path.
- Route change during load: the `cancelled` flag ignores the late result.

### 6.6 Labels and formatting

- Winner label `Ticket #5` is unpadded. Flight labels and roster chips use `#05`. The winner label uses a falsy check, so ticket number `0` shows "Ticket zwycięzcy" while the winner visibility check accepts `0`.
- The roster toggle label uses `draw.participantCount` (server count). The list uses `participants.length`. These can disagree.
- Hero amount grouping differs from the toast amount format (see 5.7).
- The `Trophy` status row and `--ticket-count` are dead in the web build (`display: none` and no CSS reference). Drop them in the port.
- The `20:00` value is hard-coded. A draw scheduled at another time would display the wrong time.

### 6.7 Styling

- Replay shell and roster use `backdrop-filter`. Check frame rate on mid-range Android.
- The stage artwork uses `filter: drop-shadow(...)` with a large radius (`34px`). Check cost on native.
- Background uses `background-attachment: fixed`. iOS WebKit does not honor it, so the port should use a fixed image layer.
- `.jackpot-draw-primary` hover and focus lift (`translateY(-1px)`) do not apply to touch. Use press feedback instead.
- Button base classes: `Button` is shadcn-style with cva. Passing `variant={null}` and `size={null}` may or may not drop the base classes. See open questions.

### 6.8 Dev flow

- `JackpotDevFlowPage.tsx:400-407` renders the same component with `initialDraw`, so loading is skipped. `draw` is seeded once from `initialDraw` via `useState`, and with `initialDraw` set the load effect only sets loading false. A changed `initialDraw` does not update `draw`. This is dev-only.

---

## 7. Open questions

1. cva null handling: `button.tsx` defines `defaultVariants` (`variant: "default"`, `size: "default"`). If cva 0.7.x falls back to defaults for `null`, draw-page buttons inherit default-button classes. If it drops the variant, only base classes remain. Unverified because `node_modules` is absent in this worktree and installs were not allowed. Decide whether the native port needs a neutral button style at all.
2. Mid-flight reveal: should the flight list be frozen at drawing start, with the reveal applied only at the end? Current behavior can reorder or resample tickets during the animation.
3. Reveal timing: the reveal RPC starts at click, not at the end of the flight. Keep this (faster result) or move it to the timer end (no mid-flight state change)?
4. Winner ticket number `0`: confirm whether ticket numbers start at 1. If they can be 0, fix the falsy check in the winner label.
5. Reduced-motion pop: should the winning-ticket pop be disabled under reduced motion? The current CSS does not disable it.
6. Perf-lite: which replacement applies on native for low-power mode? Options: static artwork, no flight loop, or shorter cycle.
7. Claim refresh failure: should a balance refresh error be a separate toast so a successful claim is not reported as failed?
8. Data loading convention: should this page use a query factory with `PAGE_DATA_QUERY_OPTIONS` (AGENTS.md convention) for the initial load? Reveal and claim must bypass the cache either way.
9. Rolled over: the branch shows no action. Confirm the copy and layout with product, since the page cannot reveal or claim in that state.
10. Roster overflow: only 3 ticket chips are shown per participant and no "+N" indicator exists. Confirm the desired behavior.
11. Draw time: the page hard-codes `20:00`. Should the port read `drawScheduledAt` and format it in `Europe/Warsaw`?
12. Hero and toast number formatting: pick one rule for native (grouped or ungrouped) and apply it everywhere.
13. Native Intl: verify `pl-PL` grouping, the `month: 'long'` genitive form, and `Europe/Warsaw` zone support in Hermes on the target Expo runtime.
14. Dev flow page: port it or drop it? It is the only consumer that passes `initialDraw`.
