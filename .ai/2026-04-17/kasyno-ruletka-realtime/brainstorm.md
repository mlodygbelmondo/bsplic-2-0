# Kasyno + ruletka realtime — brainstorm

## goal
- Turn roulette into a synchronized shared-table experience with a premium dark-luxury casino feel, realtime round state, and Supabase-authoritative settlement.

## constraints
- Must fit the existing app and current casino feature path.
- Supabase remains source of truth for round lifecycle, outcomes, and balances.
- Use realtime so all players see the same round state.
- Betting/waiting phase lasts 15 seconds before spin.
- Must show recent spins and recent wins.
- Must stay original in design; no 1:1 copying from screenshot/assets.
- Must fix the ambiguous SQL `id` reference.

## success criteria
- All players on the roulette page see the same countdown, round phase, spin result, and recent history.
- A player can place a bet during the 15-second betting window and receive authoritative settlement after the shared round resolves.
- The UI feels materially more immersive: dark felt/luxury paneling, glowing red accents, dramatic result reveal, and lively history/winner surfaces.
- Recent spins and recent wins update quickly enough to feel live.
- SQL/runtime flow is stable and the ambiguous `id` bug is removed.

## unresolved questions
- Launch shape should likely be one global table, but multi-room support is an explicit future fork.
- Need product choice on whether premium presentation can ship with current simplified bet types or needs a fuller betting board.
- Need implementation decision on exact authoritative round orchestration: scheduled DB-driven rounds vs. app-assisted round creation with DB-enforced ownership/locking.
