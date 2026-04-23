# Kasyno + ruletka PRO — context

## Request summary
- Upgrade the existing casino feature so the first mini-game roulette feels like a real casino roulette rather than an MVP placeholder.
- Keep it shippable: improve presentation, feedback, and reliability without turning the scope into a full casino platform rebuild.
- Ensure the Supabase-backed settlement flow is runnable end to end.

## Normalized goal
- Deliver a polished **European roulette** experience with a visibly spinning wheel, stronger casino-style visual treatment, and clearer interaction feedback.
- Preserve the existing secure backend model: settlement and balance updates must remain Supabase-backed and not client-trusted.
- Replace the user's request to “copy from the internet” with: build an **original implementation inspired by standard casino roulette patterns**, without copying copyrighted code or assets verbatim.

## Relevant prior context
- Earlier artifact set defined casino/roulette as MVP with route `/casino`, navbar entry, authenticated access, and secure Supabase settlement.
- Prior plan assumed simplified betting support and backend RPC settlement.
- Prior browser verification reached `/casino`, but authenticated roulette flow could not be verified because the session was blocked by login.
- Prior review indicates earlier blockers in `CasinoPage` and `RouletteGame` were already fixed.

## Upgraded scope direction
- Replace bare/placeholder roulette presentation with a more premium casino feel.
- Wheel must visibly spin and land in sync with the returned round result.
- Improve interaction feedback: clearer loading/spin states, stronger win/loss reveal, better disabled states, better perceived responsiveness.
- Make the Supabase-backed round settlement actually runnable in the app flow, including balance refresh and result display after settlement.
- Keep the feature practical for current project constraints: 2D polished UI, not 3D physics simulation.

## Links / screenshots mentioned in text form
- Existing prior-run artifacts referenced:
  - `.ai/2026-04-17/kasyno-ruletka/context.md`
  - `.ai/2026-04-17/kasyno-ruletka/plan.md`
  - `.ai/2026-04-17/kasyno-ruletka/review.md`
  - `.ai/2026-04-17/kasyno-ruletka/browser.md`
- Browser result summary from prior run:
  - `/casino` route opened successfully.
  - Live browser flow stopped on login screen, so authenticated roulette interaction was not verified.

## Explicit user constraints
- Wants a **“prawdziwa ruletka”** feel, not a plain/basic placeholder UI.
- Wheel must visibly spin.
- Visual presentation should be materially stronger than the current bare version.
- Supabase-backed settlement flow must be runnable in practice.
- Do not save raw credentials into artifacts.
- Authenticated browser verification may be performed later using user-provided credentials kept outside saved artifacts.
- Do not copy copyrighted code/assets verbatim.

## Open questions
- Final visual direction is not explicitly chosen yet: realistic casino-luxe vs. modern polished app-casino hybrid.
- Exact bet coverage for the upgraded shippable version is still a product choice: keep MVP bet set with premium presentation, or expand to fuller board coverage.
