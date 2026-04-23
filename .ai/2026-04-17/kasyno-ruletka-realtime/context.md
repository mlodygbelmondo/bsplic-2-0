# Kasyno + ruletka realtime — context

## Request summary
- Build a more ambitious roulette experience inside the existing app, not a greenfield project.
- Keep Supabase as the backend authority.
- Move roulette from a mostly single-player/polished MVP direction toward a synchronized multiplayer-style shared round experience.

## Normalized goal
- Deliver an original, premium-feeling roulette experience inspired by a dark luxury casino aesthetic: deep dark surfaces, glowing red accents, immersive presentation, and stronger visual drama.
- Make roulette synchronized for all players through shared realtime round state rather than isolated per-user spins.
- Support a clear round loop: waiting room / betting window, round start, spin/reveal, settlement, then next round.
- Preserve backend trust boundaries so results, balance updates, and round state remain Supabase-authoritative.
- Fix the reported SQL/runtime issue: `column reference "id" is ambiguous`.

## Relevant prior context
- Earlier artifact line established a casino MVP with `/casino`, auth-aware access, and secure Supabase-backed settlement.
- Later artifact line upgraded the feature toward a luxury/polished roulette with a visible wheel and better feedback.
- Current request supersedes those by adding shared realtime synchronization across players.

## Existing artifact references mentioned
- `.ai/2026-04-17/kasyno-ruletka/context.md`
- `.ai/2026-04-17/kasyno-ruletka/plan.md`
- `.ai/2026-04-17/kasyno-ruletka/review.md`
- `.ai/2026-04-17/kasyno-ruletka/browser.md`
- `.ai/2026-04-17/kasyno-ruletka-pro/context.md`
- `.ai/2026-04-17/kasyno-ruletka-pro/brainstorm.md`
- `.ai/2026-04-17/kasyno-ruletka-pro/design-research.md`
- `.ai/2026-04-17/kasyno-ruletka-pro/plan.md`

## Pasted links and screenshots mentioned in text form
- A provided screenshot was referenced as visual inspiration only.
- Desired vibe: dark luxury casino, glowing red accents, immersive/high-drama presentation.
- Explicit instruction: do not copy copyrighted UI/assets 1:1; create an original design inspired by that feel.

## Explicit user constraints
- Existing project only; fit the current app.
- Supabase must remain the backend authority.
- Roulette must be synchronized for all players using realtime.
- Waiting-for-players phase lasts 15 seconds before the round starts.
- Show recent spins / last rolls.
- Show recent wins / last wins.
- Be creative with presentation.
- Fix `column reference "id" is ambiguous`.
- Do not save raw user credentials into artifacts.

## Likely product shape for this app
- A single shared roulette table/room is the most likely fit: everyone sees the same countdown, same current round, same winning number, and same recent history.
- Players place bets during the 15-second betting window; when the timer ends, betting closes, the wheel reveals the precomputed/authoritative round result, winnings are settled, and a new waiting phase begins.
- The page should combine premium presentation with practical app constraints: 2D/SVG luxury wheel/table, realtime status rail, recent spins strip, recent wins feed, and clear balance/bet controls.
- Supabase Realtime should broadcast round-state transitions and recent-history updates; SQL/RPC should remain authoritative for creating rounds, closing betting, resolving winners, and updating balances.

## Open questions
- Shared-table scope: one global table for all users vs. future support for multiple rooms. For this app, one global table is the safest assumption.
- Bet coverage: keep current simplified bet set for launch vs. expand board interactions to better match the premium shared-table fantasy.
- Result timing model: whether winning number is generated at round-close or generated server-side slightly earlier and only revealed at spin time.
