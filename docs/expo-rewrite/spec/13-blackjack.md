# 13. Blackjack (`/casino/blackjack`)

Behavioural spec of the web Blackjack surface, written so the Expo native rewrite can be built without reading the web source. Server rules are authoritative; the client mirrors them only for display. Polish copy is verbatim from source. `{name}` marks an interpolated value. Line numbers refer to the web repo at this commit.

## Files covered

Client (web, Vite + React):

| File | Lines | Role |
|---|---|---|
| `src/pages/CasinoBlackjackPage.tsx` | 34 | Route shell, background artwork, `usePageTitle("Blackjack")` |
| `src/features/casino/components/games/BlackjackGame.tsx` | 806 | Whole game UI: shoe info, dealer, hands rail, controls, result, insurance |
| `src/features/casino/components/games/PlayingCard.tsx` | 119 | Single card with deal-in and flip animation |
| `src/features/casino/hooks/useBlackjack.ts` | 625 | State machine, RPC orchestration, reveal finale, cache, resume |
| `src/features/casino/api/blackjack.ts` | 381 | RPC wrappers, raw-to-camel normalization, types, error copy |
| `src/features/casino/api/casinoQueries.ts` | 1-27 | `blackjackSnapshotQuery(userId)` |
| `src/features/casino/lib/blackjackReveal.ts` | 103 | `calculateHandValue`, finale step builder, result masking, `wait` |
| `src/features/casino/lib/blackjackSfx.ts` | 172 | WebAudio SFX (no assets), mute flag, vibration |
| `src/features/casino/blackjack-mobile.css` | 30 | Short-phone overrides (max-width 767px and max-height 700px) |
| `src/App.tsx` | 46, 181 | Lazy import and `blackjack` route under casino |
| `src/lib/boot/route-modules.ts` | 18-19, 33 | Route chunk loader `loadCasinoBlackjackPage` |
| `src/lib/boot/preload.ts` | 66, 71, 72 | Artwork warm-up: `blackjack-cover.webp`, `blackjack-table.webp`, `blackjack-card-reverse.webp` |
| `src/pages/CasinoHub.tsx` | 101 | Hub tile that links to the game |

Server (Supabase, latest definition per function):

| Migration | Defines or changes |
|---|---|
| `20260503010000_blackjack_persistent_tables.sql` | `_blackjack_new_shoe` (line 7), `_blackjack_ensure_table` (108), `get_blackjack_table_info` (472), `blackjack_stand` (829) |
| `20260503011000_fix_blackjack_shoe_column_ambiguity.sql` | `_blackjack_play_dealer_from_shoe` (4), `blackjack_hit` (355), `blackjack_double_down` (458) |
| `20260503013000_blackjack_insurance.sql` | `_blackjack_state` (65), `_blackjack_settle_all_hands` (128), `get_current_blackjack_game` (262), `place_blackjack_bet` (292), `_blackjack_resolve_insurance` (498), `blackjack_take_insurance` (646), `blackjack_decline_insurance` (660) |
| `20260611170000_blackjack_split_aces_playable.sql` | `blackjack_split` (6) |

Superseded (do not port): `20260424000000_casino_blackjack.sql`, `20260503000000_blackjack_split.sql`, `20260503012000_fix_blackjack_state_volatility.sql`, and the older definitions of `place_blackjack_bet`, `get_current_blackjack_game`, `blackjack_hit`, `blackjack_double_down`, `blackjack_split`. Later migrations (`20260425010000`, `20260524170000`, `20260626111524`, `20260629132603`, `20260922190000`) touch `casino_blackjack_games` only for history, rankings and season reset.

Tests (behaviour reference, titles checked against source):
- `src/features/casino/api/blackjack.test.ts` (6): resume RPC and table metadata normalization; insurance offer without hole card; null resume; private shoe info; persistent shoe metadata after a new hand; take and decline insurance RPCs.
- `src/features/casino/blackjackMigration.test.ts` (3): volatile state redefinition; insurance as a decision state; split aces stay playable.
- `src/features/casino/components/games/BlackjackGame.test.tsx` (16): loading, shoe metadata, dealing message, resolving message with actions disabled, split and double-down eligibility, insurance-only choices, single-hand view without split labels, split hand markers and stakes, mixed split summary, win title, stake chips and mute toggle, split-aces markers, payout count-up, stable dealer hole-card slot.
- `src/features/casino/hooks/useBlackjack.test.ts`: `calculateHandValue` (10 cases), cached table (2), resume flow (5, including insurance and deferred resume).
- `src/features/casino/lib/blackjackReveal.test.ts`: `buildFinaleSteps` (4), `maskHandsForReveal` (2).
- `src/pages/CasinoBlackjackPage.test.tsx` (1): renders blackjack without the top marketing header.

## Surfaces

### Phone (390px wide reference, below 768px)

Route shell `data-testid="casino-blackjack-shell"`:
- Full-bleed background `/casino/blackjack-table.webp` (`--casino-bg-mobile` and `--casino-bg-desktop` are the same image), with a dark overlay gradient on top.
- Content column `data-testid="casino-blackjack-content"`: `px-3 pt-3 gap-3`, flex column, `pb` reserves `--mobile-bottom-nav-scroll-padding` so the last row clears the bottom nav.
- Page title: "Blackjack".

Shoe info row `data-testid="blackjack-shoe-info"` (top of the game):
- "{deckCount} talie" (for example "2 talie")
- "Pozostało {cardsRemaining}/{shoeTotalCards} kart" (`shoeTotalCards = (deckCount ?? 2) * 52`)
- "Shoe #{shoeNumber}"
- Mute toggle, 44 x 44 px (`h-11 w-11`), aria-label "Włącz dźwięki" when muted, "Wycisz dźwięki" when sound is on.
- Short phones (max-height 700px): `.blackjack-table-info` becomes absolute, top-right, and its direct `span` children are hidden.

Dealer area `data-testid="blackjack-dealer-area"`:
- Label "Krupier: {dealerValue}". While the hole card is still hidden in a decision state, it reads "Krupier: {dealerValue} + ?".
- Cards in `data-testid="dealer-hand"`. The hole card slot is `dealer-hidden-card`; its slot stays stable when it flips.
- Card size: `h-28 w-20` (112 x 80 px). Short phones: 88 x 64 px (`[data-card-animation]` override).

Player hands rail:
- One hand: centred. Two or more hands (split): horizontal snap carousel (`snap-x`), each hand card `w-[17rem] max-w-[calc(100vw-2rem)] shrink-0 snap-center rounded-2xl border bg-black/35 p-3 backdrop-blur-md`.
- The active hand carries `data-testid="player-hand"`. The rail scrolls the active hand into view on decision states.
- Each hand header: "Ręka {handIndex+1}", "ASY" badge (split aces), "Aktywna" badge (active hand), settled badge.
- Value badge "Ty: {value}" (red above 21, green at 21).
- Stake line "Stawka: {hand.stake.toFixed(2)} zł". With splits, the total line "Łączna stawka: {stake.toFixed(2)} zł" follows.

Controls `data-testid="blackjack-controls"`:
- Decision states (`playing`, `insurance`): fixed to the bottom, above the floating stack. Classes: `fixed inset-x-0 bottom-[calc(var(--mobile-floating-stack-offset,4.75rem)+env(safe-area-inset-bottom))] z-40 border-t border-white/15 bg-[#211014] px-3 py-3`.
- Betting and result states: in normal flow.

Betting panel:
- Heading "Rozpocznij rozdanie".
- Quick stake chips: 10, 25, 50, 100, 250, 1000 (default stake is the stored last stake, else 10).
- Disclosure "Więcej opcji stawki" holds MIN, 1/4, 1/2, MAX (balance-based) and a number input (aria-label "Stawka blackjacka", `inputMode` decimal, min 1, step 1).
- Button "Graj" (shows "Rozdawanie..." while dealing). Disabled while syncing or dealing, or when the stake is invalid.
- Balance line "Saldo: {balance.toFixed(2)} zł".

Playing panel:
- Message slot `data-testid="blackjack-action-message-slot"`: shows the action message if any, else "Twoja decyzja · {value} pkt".
- Buttons: "Dobierz" (hit), "Pas" (stand), "Podziel" (split, only when eligible; disabled if the active stake exceeds balance), "Podwój" (double down, only when eligible).

Insurance panel:
- Title "Ubezpieczenie", cost line "Koszt: {insuranceStake.toFixed(2)} zł", buttons "Ubezpiecz" and "Pomiń".

Result panel (settled states):
- Title: "Wynik splitu" (split), "Wygrana!" (won), "Porażka" (lost), "Remis" (push).
- "Zwrot: " plus count-up amount, when total payout is above 0.
- Net count-up "+{netResult}" when `netResult > 0` (`data-testid="blackjack-payout-countup"`).
- Split summary: "Wygrane: {splitWins} • Przegrane: {splitLosses} • Remisy: {splitPushes}".
- "Wypłata z ubezpieczenia: {insurancePayout.toFixed(2)} zł." when insurance paid.
- Buttons: "Graj ponownie (N zł)" with `lastStake.toFixed(0)` (or "Graj ponownie" if there is no valid last stake), and "Zmień stawkę" (resets to betting).

Motion: cards deal in from the dealer or player side (see Game rules), with a 0.18 s tween. The hole card flips with a 0.45 s tween. Reduced motion skips the staged finale (see Game rules).

### Lg and desktop (1024px and up)

From 768px (`md`) the controls panel goes into normal flow (`md:static md:border-0 md:bg-transparent md:p-0`) and its order class changes from `order-3` to `md:order-2`. The page is capped at `max-w-7xl` with `md:px-5 md:pt-5`. Cards grow to `h-32 w-24` from 640px (`sm`) and `h-40 w-28` from 1536px (`2xl`). Split hands are `lg:w-[18rem]` from 1024px. The exact desktop arrangement of the dealer, hands and controls is not fully traced; see Open questions.

## Data contract

### RPCs

All functions are SECURITY DEFINER and guard on `auth.uid()`. The client passes the signed-in user id as `p_user_id`.

| RPC | Parameters | Returns | Client wrapper |
|---|---|---|---|
| `get_blackjack_table_info` | `p_user_id` | table info row (`deck_count`, `cards_remaining`, `shoe_number`, `hands_played`, `needs_shuffle`) | `getBlackjackTableInfo` |
| `get_current_blackjack_game` | `p_user_id` | `blackjack_game_state` or null | `getCurrentBlackjackGame` |
| `place_blackjack_bet` | `p_user_id`, `p_stake` | `blackjack_game_state` | start game |
| `blackjack_hit` | `p_game_id`, `p_user_id` | `blackjack_game_state` | hit |
| `blackjack_stand` | `p_game_id`, `p_user_id` | `blackjack_game_state` | stand |
| `blackjack_double_down` | `p_game_id`, `p_user_id` | `blackjack_game_state` | double down |
| `blackjack_split` | `p_game_id`, `p_user_id` | `blackjack_game_state` | split |
| `blackjack_take_insurance` | `p_game_id`, `p_user_id` | `blackjack_game_state` | take insurance |
| `blackjack_decline_insurance` | `p_game_id`, `p_user_id` | `blackjack_game_state` | decline insurance |

Server errors surface as the raw message from the function (for example "Brak dostępu do stołu" for table access). Each wrapper also has a Polish fallback used when the RPC error carries no usable message:

- Table info: "Brak danych stołu blackjacka" (empty response), "Nie udało się pobrać stołu blackjacka".
- Resume: "Nie udało się wznowić gry blackjacka".
- Bet: "Nie udało się rozpocząć gry".
- Hit: "Nie udało się dobrać karty". Stand: "Nie udało się zakończyć gry". Split: "Nie udało się rozdzielić kart". Double: "Nie udało się podwoić stawki".
- Insurance: "Nie udało się ubezpieczyć zakładu". Decline: "Nie udało się odrzucić ubezpieczenia".

### Raw to client normalization

The RPCs return snake_case JSON. `blackjack.ts` maps it to camelCase. `normalizeState` throws "Brak danych gry" on an empty row. `normalizeTableInfo` maps fields and does not throw. `normalizeHand` falls back to id `hand-${index+1}`; a legacy single-hand response falls back to id `hand-1`. If insurance is `offered` and the stored insurance stake is 0, the client derives `Math.round((initial_stake / 2) * 100) / 100`.

### Types

- `Card`: `{ id?: string; suit: 'hearts' | 'diamonds' | 'clubs' | 'spades'; rank: '2'..'10' | 'J' | 'Q' | 'K' | 'A'; value: number }`.
- `BlackjackTableInfo`: `{ deckCount; cardsRemaining; shoeNumber; handsPlayed; needsShuffle }`.
- `BlackjackGameStatus`: `'betting' | 'insurance' | 'playing' | 'won' | 'lost' | 'push'`. Note that `'betting'` is client-only; the server never returns it.
- `BlackjackInsuranceStatus`: `'unavailable' | 'offered' | 'declined' | 'lost' | 'won'`.
- `BlackjackHandStatus`: `'playing' | 'stand' | 'busted' | 'won' | 'lost' | 'push'`.
- `BlackjackHandState`: `{ id; cards: Card[]; stake; payout; status; doubleDownUsed; isSplitAces }`.
- `BlackjackGameState`: `{ id; stake; initialStake; status; playerHand; playerHands; activeHandIndex; dealerHand; payout; doubleDownUsed; deckCount; cardsRemaining; shoeNumber; dealerHiddenCount; createdAt; insuranceStatus; insuranceStake; insurancePayout }`.

`dealerHiddenCount > 0` means the hole card is still face down. When it is hidden, the server does not return its rank or suit.

### Server-side card and shoe data

- Shoe: 2 decks, 104 cards, shuffled (`_blackjack_new_shoe`). The shoe is persistent per table in `casino_blackjack_tables`.
- `needs_shuffle` is true when `cards_remaining < 26`. The client also computes `cardsRemaining < 26` (`useBlackjack.ts` around line 110).

### React Query

- Key `['casino','blackjack',userId]`, from `blackjackSnapshotQuery(userId)` in `casinoQueries.ts`. It runs table info and current game in parallel and returns `{ tableInfo, currentGame }`. It spreads `PAGE_DATA_QUERY_OPTIONS` (cached data shows at once and refreshes in the background).
- On mount: seeds local state from the cache if `currentGame` is null.
- On unmount: removes the query if a call is in flight, or there is no table info, or the status is `playing` or `insurance`. Otherwise it writes `{ tableInfo, currentGame: null }`. A live game is never cached.

### Profile

After every settled round and after a failed resume, the hook calls `refreshProfile` to refresh the balance. The balance comes from the profile (`Number(profile.balance)`). Failure toast: "Nie udało się odświeżyć salda."

### Local storage

- `bsplic.blackjack.lastStake`: string number, default "10". Drives the "Graj ponownie (N zł)" button and the stake input default.
- `bsplic.blackjack.muted`: `'true'` when SFX are muted.

## Game rules and state machine

### Rules (server is authoritative)

- Shoe: 2 decks, reshuffled when fewer than 26 cards remain.
- Stake: must be greater than 0 and equal to `ROUND(stake, 2)`. Must not exceed the balance (client max is `floor(balance)` for the MAX button, but any value up to balance is accepted by the client check).
- Dealer natural handling at bet time:
  - Dealer upcard is an Ace: the game goes to `insurance` with insurance `offered` and returns before the blackjack check (`place_blackjack_bet`, around lines 440-450).
  - Otherwise: peek at bet time (around lines 453-469). If both have blackjack, both hands push (1x). If only the player has blackjack, the hand pays 2.5x (`ROUND(stake * 2.5, 2)`). If only the dealer has blackjack, the player loses.
- Insurance: offered only when the dealer shows an Ace. Cost `ROUND(initial_stake / 2, 2)`. If the dealer has blackjack, insurance pays 3x the insurance stake (2:1 plus stake back). Otherwise insurance is lost. Taking or declining insurance continues to `playing` unless the dealer has blackjack, in which case the game settles.
- Hit: draws one card. Busting (over 21) ends that hand as `busted`.
- Stand: ends the active hand, moves `activeHandIndex` to the next playing hand, and settles when none remain.
- Double down: allowed on exactly two cards, once per hand (`doubleDownUsed`). Doubles the hand stake, draws one card, then stands. Requires balance to cover the extra stake ("Saldo jest za małe na podwojenie stawki").
- Split: allowed on exactly two cards of equal `value` (so any two 10-value cards can pair, including J, Q and K). Maximum 4 hands ("Osiągnięto limit 4 rąk po splicie"). Requires balance to cover the new stake ("Saldo jest za małe na split"). Split aces stay playable (no automatic stand); they are flagged `isSplitAces`.
- Dealer: draws while its value is below 17. Soft 17 is hit (the dealer draws on soft 17).
- Settlement per hand: win pays 2x stake, push pays 1x, loss pays 0.
- Game status is derived from totals: total payout above total stake is `won`, below is `lost`, equal is `push`. Insurance is included in the totals.
- Hand value: ace counts as 11 and drops by 10 while the total is over 21 (`calculateHandValue`, mirrors the server, display only).

### Client status (`useBlackjack`)

Status values: `betting`, `insurance`, `playing`, `won`, `lost`, `push`. The hand status for each hand is `playing`, `stand`, `busted`, `won`, `lost` or `push`.

Flags:
- `isDealing`: bet request in flight (button shows "Rozdawanie...").
- `isResolving`: action request in flight. Blocks action buttons.
- `isRevealing`: dealer finale running. Blocks action buttons.
- `isSyncing`: loading or resume in flight. Disables betting.
- `actionMessage`: transient text, see the message list below.

Derived permissions:
- `canActOnActiveHand` = status `playing` AND active hand `playing` AND not `isResolving` AND not `isRevealing`.
- `canSplit` = `canActOnActiveHand` AND hand has 2 cards AND `playerHands.length < 4` AND both cards have the same `value`.
- `canDoubleDown` = `canActOnActiveHand` AND hand has 2 cards AND `!doubleDownUsed`.
- `canTakeInsurance` = status `insurance` AND insurance `offered` AND not `isResolving`.

### Transitions

1. `betting` to bet response:
   - Dealer Ace upcard: to `insurance` (insurance `offered`).
   - Naturals settled at bet: to `won`, `lost` or `push`.
   - Otherwise: to `playing`.
2. `insurance` to take or decline:
   - Dealer blackjack: settles the game (insurance pays or is lost, main bet resolves).
   - No dealer blackjack: to `playing` (insurance `lost` or `declined`).
3. `playing` to hit: adds a card. Bust ends that hand. If no hand is left playing, the finale runs.
4. `playing` to stand: advances `activeHandIndex`. If none is left playing, the finale runs.
5. `playing` to double down: one card, hand stands. Finale if no hand is left playing.
6. `playing` to split: adds a hand, keeps the active index, and the new hand receives a card.
7. Finale (any settling action): client sets `status = 'playing'`, masks hands (`maskHandsForReveal`: payout 0, status `busted` if over 21, else `stand`), then runs the reveal steps. Final step applies the server's settled state.
8. `won` / `lost` / `push` to `betting` via "Zmień stawkę" (`resetGame`), or to a new bet via "Graj ponownie (N zł)".

Resume: on focus and on `visibilitychange` to visible, the hook waits until all loading flags are false, then reloads the snapshot and refreshes the profile. A `playing` or `insurance` game is restored. A settled game is not returned by `get_current_blackjack_game`, so after a reload the screen shows `betting` with no result panel.

### Dealer finale (`buildFinaleSteps`)

Constants:
- `REVEAL_FLIP_DELAY_MS = 450`
- `REVEAL_FRESH_DEAL_FLIP_DELAY_MS = 900` (used when the round was just dealt, so the deal-in finishes before the flip)
- `REVEAL_DRAW_DELAY_MS = 650`
- `REVEAL_SETTLE_DELAY_MS = 550`

Steps:
- Reduced motion, or dealer hand of one card or fewer: a single immediate settle step.
- Otherwise: flip step after 450 ms (900 ms when fresh deal) showing 2 dealer cards; then one step per extra dealer card, 650 ms apart; then a settle step after 550 ms that applies results and payouts.

Cancellation: a run token (`revealRunRef`) is checked before each step so a newer run or unmount cancels the old one.

### Feedback

Action messages (`actionMessage`):
- "Rozdawanie kart..." (deal)
- "Dobieranie karty..." (hit)
- "Krupier dobiera..." (dealer draws)
- "Rozdzielanie ręki..." (split)
- "Double Down..." (double; English text as in source)
- "Sprawdzanie blackjacka..." (insurance take or decline, and peek)
- "Krupier odkrywa karty..." (finale)

Toasts: "Blackjack: wygrana!" on `won`. Error toast fallback "Nie udało się wczytać stołu blackjacka".

Win celebration: canvas-confetti, 110 particles, spread 64, origin y 0.62, colours `#22c55e`, `#fbbf24`, `#ffffff`. Skipped under reduced motion.

Count-up: `CountUpAmount`, 900 ms cubic ease-out. Used for "Zwrot" and the net "+{netResult}" line.

Haptics: `navigator.vibrate` patterns, Android only: won `[20, 40, 30]`; lost and push `15`; each card draw `8`. Wrapped in try/catch.

Sound (WebAudio, synthesized, no files):
- `playCardSound`: noise 0.05 s, bandpass 2600 Hz, gain 0.16.
- `playFlipSound`: noise 0.12 s at 1400 Hz, plus a 0.05 s burst at 2800 Hz starting 0.07 s later.
- `playChipSound`: two triangle clicks at 1900 Hz and 2300 Hz.
- `playResultSound('won')`: sine C5, E5, G5 (523.25, 659.25, 783.99 Hz).
- `playResultSound('lost')`: 190 to 110 Hz sweep, 0.28 s.
- `playResultSound('push')`: 440 Hz, 0.14 s.
- All sounds are skipped when muted. The AudioContext is created lazily on first use (webkit fallback supported). Missing audio support is a silent no-op.

Card animation (`PlayingCard`): entry tween 0.18 s easeOut from an offset (dealer `{x:28, y:14}`, player `{x:34, y:-18}`), scale 0.82 to 1, opacity 0 to 1. Delay is 0.12 s for the dealer hole card, else `min(index * 0.025, 0.075)`. Flip is `rotateY` 0 to 180 over 0.45 s easeInOut when `hidden`. The back image is `/casino/blackjack-card-reverse.webp` with alt "Rewers karty". Hidden cards have z-index 0. Suits: hearts and diamonds red (`text-red-500`), clubs and spades `text-zinc-800`. Symbols: ♥ ♦ ♣ ♠.

### Copy (verbatim)

Loading and states:
- "Wczytywanie stołu..."
- "Brak danych gry"

Betting:
- "Rozpocznij rozdanie"
- "Więcej opcji stawki"
- "Stawka blackjacka"
- "Graj" / "Rozdawanie..."
- "Saldo: {balance.toFixed(2)} zł"

Table:
- "{deckCount} talie"
- "Pozostało {cardsRemaining}/{shoeTotalCards} kart"
- "Shoe #{shoeNumber}"
- "Włącz dźwięki" / "Wycisz dźwięki"
- "Krupier: {dealerValue}" (plus " + ?" while hidden)

Playing:
- "Twoja decyzja · {value} pkt"
- "Dobierz", "Pas", "Podziel", "Podwój"
- "Ręka {handIndex+1}", "ASY", "Aktywna"
- "Ty: {value}"
- "Stawka: {hand.stake.toFixed(2)} zł", "Łączna stawka: {stake.toFixed(2)} zł"
- Settled badges: "✓ +{payout} zł" (won), "= {payout} zł" (push), "✗ przegrana" (lost)

Insurance:
- "Ubezpieczenie"
- "Koszt: {insuranceStake.toFixed(2)} zł"
- "Ubezpiecz", "Pomiń"
- "Wypłata z ubezpieczenia: {insurancePayout.toFixed(2)} zł."

Result:
- "Wynik splitu", "Wygrana!", "Porażka", "Remis"
- "Zwrot: "
- "Wygrane: {splitWins} • Przegrane: {splitLosses} • Remisy: {splitPushes}"
- "Graj ponownie (N zł)", "Graj ponownie", "Zmień stawkę"

Errors and toasts: listed under Data contract and Feedback.

## Edge cases and gotchas

1. Decimal stakes: the client check accepts any positive number up to the balance (for example 10.555), but the server requires `ROUND(stake, 2)` to equal the stake, and rejects others with "Nieprawidłowa stawka". The input's `step=1` does not block decimals. The native port must round or reject to 2 decimals before calling the RPC.
2. Insurance blocks actions: hit, stand, double and split are rejected by the server while the game is in `insurance` (hit returns "Gra została już zakończona"). The UI avoids this through `canActOnActiveHand`, which requires status `playing`.
3. Finale masking: during the reveal the status is `playing`, payouts are 0 and hand statuses are masked to `stand` or `busted`. Result badges and the result panel appear only at the settle step, so the outcome is not spoiled while dealer cards turn.
4. Hole card privacy: while `dealerHiddenCount > 0` the server does not send the hole card's rank or suit. Do not compute or display it on the client.
5. Totals-based status: a split round where one hand wins and one loses can still settle as `push` if total payout equals total stake. The split summary ("Wygrane / Przegrane / Remisy") is the only per-hand view, so keep it.
6. Net result: `netResult = totalPayout - stake`, where `totalPayout` is the sum of hand payouts plus insurance payout and `stake` is the game's `stake` field. Whether `stake` includes split hand stakes and insurance stake is not confirmed (see Open questions).
7. Cache on unmount: a live (`playing`, `insurance`) or busy game is removed from the cache, not written, so returning to the page always reloads it from the server. Only the table info is kept.
8. Settled games are not restored: after a reload, a finished round is gone from the screen. Only the balance and shoe info are refreshed.
9. Resume waits for loading to finish: focus and visibility events queue behind any in-flight action, so a resume does not overwrite a fresh server response.
10. "Graj ponownie (N zł)" uses the stored last stake, not the last bet actually placed. It is disabled when the stored stake is 0 or above the balance (`canRepeatStake`).
11. `'betting'` is client-only. Do not send it to the server or expect it from the RPCs.
12. Table info reload: `needs_shuffle` is reported, but no shuffle message or state exists in the UI copy. The reshuffle itself is server-side.
13. Splits with `value` equality: pairing uses `.value`, not `.rank`, so 10 with K is a valid split pair (both value 10).
14. Hit at 21 and other edge actions: the client permission (`canActOnActiveHand`) does not check hand value. The server behaviour at 21 needs confirmation (see Open questions).
15. Bottom stack offset: the fixed controls sit at `--mobile-floating-stack-offset` (default 4.75rem) plus safe-area inset. The native port must put the action stack above the bottom tab bar, not under it, and must keep the shell's bottom padding equal to the stack height.
16. Mute state: stored as the string `'true'` in localStorage. Storage errors fall back to unmuted for the session.
17. Vibration: Android only, and some browsers throw without a user gesture. The native port should use haptics only for the same events, and only where the platform supports them.
18. Mobile short screens: below 700px height, the table info is moved to top-right and card size shrinks to 88 x 64 px. The native layout needs an equivalent compact mode.
19. Reduced motion: no staged reveal (single step), no confetti, no count-up animation. Native should respect the OS reduce-motion setting in the same way.
20. Decision-state scroll: when a decision state starts, the hands rail scrolls the active hand into view. Keep this on split, because the active hand may be off-screen.
21. Insurance cost rounding: the server rounds the insurance cost to 2 decimals (`ROUND(initial_stake / 2, 2)`); the client fallback rounds the same way. Display uses `toFixed(2)`.
22. Double Down label: the action message text "Double Down..." is English in the source. Keep it verbatim, or flag it for copy review.

## Open questions

1. RPC error precedence: does each wrapper in `blackjack.ts` show the server message or the Polish fallback first? The spec assumes the server message when present; confirm in the wrapper code before porting the error path.
2. Guards on `insurance`: the latest hit, double and split definitions raise "Gra została już zakończona" when the game is not `playing` (`20260503011000` lines 391 and 497, `20260611170000` line 51). Confirm that `blackjack_stand` (`20260503010000` line 860) and the insurance actions raise the same message for an `insurance` game.
3. Peek condition: confirm the exact condition for the bet-time blackjack peek (`20260503013000`, around lines 440-470), in particular whether it runs for every non-Ace upcard, and whether the Ace-upcard path peeks inside `_blackjack_resolve_insurance` (around line 498).
4. Game stake totals: does `stake` on the game (used by `netResult` and "Łączna stawka") include split hand stakes and insurance stake? Confirm in `_blackjack_state` (line 65) and `_blackjack_settle_all_hands` (line 128).
5. Hit at 21: does the server allow a hit on a 21 hand? The client allows it (no value check). Confirm in `blackjack_hit` (line 355).
6. Table limits: no table minimum or maximum was found in the client. The only limits are stake greater than 0 and the balance. Confirm there is no server-side table limit.
7. Shuffle timing: confirm whether the server reshuffles at the start of the next bet (inside `place_blackjack_bet`) or during `get_blackjack_table_info`, and whether `needs_shuffle` is only informational.
8. Prefetch: confirm whether `blackjackSnapshotQuery` is in the post-boot prefetch list in `src/lib/boot/preload.ts`. Only the artwork at lines 66, 71 and 72 was confirmed.
9. SFX trigger points: the mapping from each game event to each sound call (deal, hit, flip, chip, result) lives in `useBlackjack.ts` and `BlackjackGame.tsx`. Confirm the exact trigger for the chip sound and for card deal sounds before porting.
10. Button layout: the exact grid or wrapping for "Dobierz", "Pas", "Podziel" and "Podwój" on phones is not confirmed from the component excerpts. Read the action container in `BlackjackGame.tsx` (around lines 620-670) before building the native layout.
11. Dealer one-card case: `buildFinaleSteps` treats a dealer hand of one card as a single settle step. Confirm whether this can happen in practice (for example, after a split-stand sequence) or is defensive only.
