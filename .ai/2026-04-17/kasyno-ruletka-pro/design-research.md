# Design research — kasyno ruletka PRO

## Relevant files

### Current roulette feature
- `src/pages/CasinoPage.tsx`
  - Auth-gates the page, waits for `profile`, then renders `Navbar` + `CasinoLobby`.
  - Current page shell is intentionally minimal and is the clean route-level place to upgrade overall casino atmosphere.
- `src/features/casino/components/CasinoLobby.tsx`
  - Current lobby is a simple heading + balance card + `RouletteGame`.
  - Best place to introduce premium casino framing, balance summary, rules copy, and layout hierarchy around the game.
- `src/features/casino/components/RouletteGame.tsx`
  - Owns round input state, submit flow, loading state, toasts, and last result rendering.
  - This is the primary integration point for a real wheel animation because it already knows when a round starts and when a settled result arrives.
- `src/features/casino/components/RouletteBetForm.tsx`
  - Current UX is button-grid based and stable.
  - Best place to keep betting controls deterministic while the wheel/visual reveal becomes richer.
- `src/features/casino/lib/roulette.ts`
  - Contains European wheel color mapping, payout helpers, option builders, and input validation.
  - This should remain the source of truth for client-side display helpers and validation.
- `src/features/casino/api/roulette.ts`
  - Wraps Supabase RPC `play_roulette_round` and normalizes the result.
  - The wheel animation should consume the returned `winning_number`; payout logic should not move into UI.
- `src/features/casino/components/RouletteGame.test.tsx`
  - Covers validation, API invocation, result rendering, and `refreshProfile()` failure handling.
  - Existing test expectations make it clear the current contract is: settle first, then refresh profile, and do not convert refresh failure into spin failure.

### Auth / app shell / navigation
- `src/contexts/AuthContext.tsx`
  - Auth session is persisted in `localStorage` via Supabase client.
  - `refreshProfile()` re-queries `profiles`; `CasinoPage` already waits for `profile`, which is important after login.
- `src/components/LoginPage.tsx`
  - Browser verification currently stops here when unauthenticated.
  - No credential persistence should be added to artifacts; live verification should use manual entry or a temporary session only.
- `src/components/Navbar.tsx`
  - Already exposes `/casino` and shows current wallet balance.
  - Avoid widening scope here beyond minor polish consistency.
- `src/App.tsx`
  - Route is already wired.

### Styling / motion primitives already available
- `src/index.css`
  - Existing tokens/utilities: `gradient-primary`, `gradient-navbar`, `card-shadow`, `card-shadow-hover`, reduced-motion patterns.
  - Best shared place for casino-specific utility classes, wheel glow, chip shine, spin keyframes, and reduced-motion fallbacks.
- `package.json`
  - `framer-motion` is already installed.
  - No new dependency is needed for a polished 2D roulette upgrade.

### Supabase / data flow
- `supabase/migrations/20260417011000_casino_roulette.sql`
  - Already creates `casino_rounds`, RLS select policy, and `play_roulette_round(...)` security-definer RPC.
  - RPC does auth check (`auth.uid() IS DISTINCT FROM p_user_id`), stake validation, server-side random result, payout calculation, balance update, and round insert.
- `src/integrations/supabase/types.ts`
  - Already includes `casino_rounds` and `play_roulette_round` return shape.
- `supabase/migrations/20260313132000_22d7a7b6-3328-4845-a764-8c69af8f08f5.sql`
  - `handle_new_user()` auto-creates `profiles` rows on signup and assigns `user_roles`.
  - This matters for end-to-end verification because a confirmed/authenticated account should already receive a profile automatically.

## Patterns to follow

### 1. Keep backend settlement authoritative
- Existing repo pattern is secure RPC for balance-changing actions (`secure_daily_topup`, `place_bet_secure`, `play_roulette_round`).
- The upgraded wheel should animate **after or around** the settled response, but must still render the exact server-returned `winning_number`, `winning_color`, `payout`, and `balance_after`.
- Do not introduce client-side payout calculation beyond display helpers already used for labels/multipliers.

### 2. Prefer a componentized feature-local upgrade
- Existing structure is feature-based (`src/features/casino/...`).
- Minimal high-quality path is to keep changes mostly inside the casino feature and shared CSS:
  - add a dedicated wheel/presentation component under `src/features/casino/components/`
  - keep betting controls in `RouletteBetForm`
  - keep orchestration in `RouletteGame`
  - keep page/lobby composition in `CasinoLobby` and possibly `CasinoPage`

### 3. Match current app visual system, then push it further
- The app already uses Tailwind + shadcn `Card` + custom gradients/shadows.
- Stronger visuals should build from that system instead of replacing it:
  - layered dark/luxe panel backgrounds
  - richer shadows/highlights
  - status chips for bet / spin / result
  - elegant typography emphasis inside existing design tokens

### 4. Use the repo’s async UX pattern
- Existing UI convention: `try/catch/finally`, loading flag, success/error toast, then `refreshProfile()`.
- `RouletteGame.tsx` already correctly separates:
  - round settlement success/failure
  - profile refresh failure after settlement
- Preserve that contract when adding animation states.

### 5. Respect reduced motion
- The codebase already includes `prefers-reduced-motion` handling in `src/index.css`.
- MDN confirms `prefers-reduced-motion` is the right way to tone down transform-heavy animation.
- The wheel should have:
  - full spin path for no-preference
  - shortened / gentler reveal for reduced-motion users
  - no logic coupling between animation completion and settlement integrity

## Preferred rendering approach

### Recommendation: SVG wheel + CSS/Framer rotation, not canvas

Best fit for this codebase: **an SVG-rendered European wheel component rotated with CSS transforms or Framer Motion, driven by the RPC result**.

Why this is the best fit here:
- The wheel is deterministic, geometric, and segment-based; SVG maps naturally to 37 pockets.
- React + Tailwind + existing shadcn layout already fits SVG-in-component composition better than imperative canvas drawing.
- SVG keeps text/markers crisp, supports gradients/highlights, and is easier to test and maintain than a canvas scene.
- `framer-motion` is already installed, so no dependency cost for smooth eased rotation.
- A realistic-enough 2D illusion can be achieved with:
  - segmented SVG wheel,
  - fixed pointer,
  - center cap,
  - layered radial shadows/highlights,
  - deterministic final angle from `winning_number`,
  - slight pre/post easing and result flash.

Why not canvas as the default path:
- The current feature does not need per-frame physics or particle simulation.
- Canvas would increase implementation complexity, reduce inspectability, and make styling/testability worse for limited product gain.
- Existing repo patterns are declarative React UI, not imperative draw loops.

Why not pure CSS-only wheel without SVG:
- Possible, but less maintainable for 37 realistic pockets, labels, separators, and polished highlights.
- SVG gives the best balance of realism, control, and implementation speed.

## Minimal-but-high-quality upgrade path

1. Add a dedicated presentational wheel component, e.g. `RouletteWheel.tsx`.
   - Receives `winningNumber`, `isSpinning`, maybe `spinNonce` / `resultId`.
   - Computes a final rotation angle that lands the returned winning pocket under a fixed pointer.
   - Keeps the pointer static and rotates only the wheel.

2. Refactor `RouletteGame.tsx` into explicit phases.
   - Current states are only `isSubmitting` + `lastResult`.
   - A realistic flow wants at least: `idle` → `submitting` → `revealing/spinning` → `settled`.
   - Important: the RPC should still settle first; animation is presentation of that settled result, not a second source of truth.

3. Upgrade `CasinoLobby.tsx` and/or `CasinoPage.tsx` atmosphere.
   - Current lobby is functionally correct but visually sparse.
   - Best low-risk improvement is a premium page shell around the game rather than broad navbar/app changes.

4. Keep `RouletteBetForm.tsx` as the main input surface, but style it like a table/chip panel.
   - Preserve existing supported bet set unless product scope explicitly expands.
   - Improve clarity with selected state, possible payout, and disabled state while spinning.

5. Add casino-specific CSS utilities in `src/index.css`.
   - Wheel shadows, metallic ring, felt background, result glow, pointer styles, and reduced-motion override.

6. Extend tests around the upgraded orchestration, not animation internals.
   - Assert: form disables during spin, RPC still called once, winning result still displayed, refresh behavior unchanged.

## Supabase/auth findings for end-to-end browser verification

### What already works in code
- `play_roulette_round` already supports an end-to-end secure flow:
  - authenticated user required,
  - profile balance locked/validated in SQL,
  - result generated server-side,
  - profile balance updated server-side,
  - round stored in `casino_rounds`,
  - normalized result returned to UI.
- `AuthContext` persists session in `localStorage`, so a successful login should keep the browser session alive.
- `CasinoPage` already avoids rendering the casino for `user && profile === null`; it waits until the profile arrives.
- Signup path should auto-create a `profiles` row via `handle_new_user()` trigger.

### What blocked prior browser verification
- The last browser run failed only because the session was unauthenticated and no safe credentials/session were provided.
- There is no evidence in current code that roulette-specific auth plumbing is missing.

### What the planner should assume for browser verification
- Verification should use an existing confirmed account or a live user-provided login entered during the session only.
- Do not store raw credentials in artifacts.
- If email confirmation is enabled for new signup, sign-in verification is simpler with an already confirmed account.
- After login, allow a short wait for `AuthContext` profile fetch before judging casino-page render state.

## Risks

1. **Wheel/result desynchronization risk**
   - If animation math or timing is wrong, the UI can visually land on a different pocket than the server result.
   - The planner should ensure a single deterministic mapping from returned `winning_number` to final wheel angle.

2. **State explosion in `RouletteGame`**
   - The current component is simple; adding realistic spin/reveal states can easily tangle submission, animation, toast timing, and `refreshProfile()` handling.
   - The planner should keep orchestration explicit and avoid mixing visual state with settlement truth.

3. **Visual overreach destabilizing a working flow**
   - The current Supabase path appears already correct; the biggest danger is replacing too much structure at once.
   - The planner should prefer an additive upgrade around the existing RPC/result contract rather than rewriting API/auth behavior.

## Assumptions

- European wheel remains `0-36` only.
- Supported bets can stay as current MVP set unless scope explicitly expands.
- The desired realism is polished 2D casino presentation, not physics-accurate 3D simulation.
- Reusing existing dependencies (`framer-motion`, Tailwind, shadcn, sonner) is preferred over adding new packages.
- Browser E2E success depends on having a valid authenticated session, not on storing credentials in repo artifacts.

## What the planner must preserve

- Preserve the current secure settlement boundary: Supabase RPC remains authoritative for outcome and balance.
- Preserve the current post-spin behavior contract:
  - result can render even if `refreshProfile()` fails,
  - refresh failure must remain a secondary error,
  - raw refresh errors should not replace the round result.
- Preserve current route/auth behavior for `/casino`.
- Preserve current domain types and existing RPC normalization flow unless an extension is strictly necessary.
- Preserve mobile usability; wheel visuals cannot force desktop-only layout.
- Preserve accessibility by providing reduced-motion handling and not making the spin the only way to understand the result.

## Likely files to modify

- `src/features/casino/components/RouletteGame.tsx`
- `src/features/casino/components/RouletteBetForm.tsx`
- `src/features/casino/components/CasinoLobby.tsx`
- `src/pages/CasinoPage.tsx`
- `src/features/casino/lib/roulette.ts`
- `src/features/casino/components/RouletteGame.test.tsx`
- `src/index.css`

## Likely files to add

- `src/features/casino/components/RouletteWheel.tsx`
- optionally `src/features/casino/components/RouletteResultPanel.tsx`
- optionally `src/features/casino/lib/roulette-wheel.ts` for pocket order / angle mapping helpers
