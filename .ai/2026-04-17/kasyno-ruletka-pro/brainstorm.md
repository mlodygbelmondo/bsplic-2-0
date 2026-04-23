# Kasyno + ruletka PRO — brainstorm

## goal
- Upgrade roulette from MVP/basic to a polished, shippable casino experience with a visibly spinning wheel, stronger visual identity, better round feedback, and reliable Supabase-backed settlement.

## constraints
- Keep existing React + Tailwind + shadcn/ui patterns.
- Keep backend settlement server-side via Supabase/RPC.
- No copyrighted code or asset copying.
- Keep it shippable: polished 2D experience, not full 3D physics.
- Do not store credentials in artifacts.

## success criteria
- User can enter `/casino`, open roulette, place a supported bet, trigger a visible spin, and see a convincing stop/reveal tied to the backend result.
- UI clearly communicates idle, betting, spinning, win/loss, and error states.
- Balance/result settlement works through Supabase-backed flow and refreshes correctly after the round.
- Presentation feels intentionally casino-like: richer wheel/table visuals, stronger hierarchy, clearer call-to-action, and satisfying result reveal.
- Scope stays controlled by reusing current bet model unless expansion is necessary for the visual design.

## unresolved questions
- Visual target: realistic luxury casino vs. modern game-like polished UI.
- Bet scope: keep current simplified bet set with better presentation, or add fuller roulette board interactions.
- Animation style: deterministic CSS/JS wheel animation synced to backend result vs. more elaborate multi-phase reveal with ball highlight.
