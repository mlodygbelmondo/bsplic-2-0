# Kasyno + ruletka PRO — Luxury MVP implementation plan

## goal
- Upgrade the existing roulette into a polished Luxury MVP: premium casino atmosphere, visibly spinning wheel, clearer bet/spin/result feedback, and preserved Supabase-authoritative settlement.

## architecture
- Keep the current secure boundary unchanged: `play_roulette_round` remains the source of truth for `winning_number`, `winning_color`, `payout`, and `balance_after`.
- Build the upgrade mostly inside `src/features/casino`: add a dedicated wheel/presentation layer, keep bet entry in the existing form, and make `RouletteGame` explicitly orchestrate submit → spin reveal → settled result.
- Preserve the current auth-aware page behavior: `/casino` still requires login, waits for `profile`, and only then renders the upgraded casino UI.

## scope
- luxury visual upgrade for casino shell and roulette table,
- visible wheel spin synced to backend result,
- stronger interaction feedback and disabled/loading/result states,
- auth-aware browser-verifiable flow after login,
- targeted tests for orchestration and regressions,
- no backend rewrite unless verification later proves a real defect.

## assumptions
- European wheel stays `0-36` only.
- Current supported bet set stays as the MVP set unless implementation reveals a small extension is required for the wheel/table UX.
- Existing Supabase RPC and migration are already present and should be reused, not replaced.
- Browser verification will use a live authenticated session entered during testing only; no raw credentials are stored in artifacts.
- Premium feel means polished 2D/SVG + motion, not 3D physics.

## exact likely files to modify
- `src/pages/CasinoPage.tsx`
- `src/pages/CasinoPage.test.tsx`
- `src/features/casino/components/CasinoLobby.tsx`
- `src/features/casino/components/RouletteGame.tsx`
- `src/features/casino/components/RouletteGame.test.tsx`
- `src/features/casino/components/RouletteBetForm.tsx`
- `src/features/casino/lib/roulette.ts`
- `src/features/casino/lib/roulette.test.ts`
- `src/features/casino/api/roulette.ts`
- `src/index.css`

## exact likely files to create
- `src/features/casino/components/RouletteWheel.tsx`
- `src/features/casino/lib/roulette-wheel.ts`
- optional: `src/features/casino/components/RouletteResultPanel.tsx`

## ordered implementation steps
1. **Lock the upgrade contract**
   - Reuse the existing RPC result contract as-is.
   - Define a small wheel helper contract in `roulette-wheel.ts`: European pocket order, pocket index lookup, final angle calculation, reduced-motion variant.

2. **Upgrade wheel rendering**
   - Add `RouletteWheel.tsx` as an SVG-based European wheel with fixed pointer, center cap, luxury ring/shadow/highlight layers, and deterministic rotation to the returned winning pocket.
   - Ensure the wheel can render idle, spinning, and settled-highlight states without owning settlement logic.

3. **Refactor animation state flow in `RouletteGame.tsx`**
   - Replace the current simple submit state with explicit phases: `idle`, `submitting`, `spinning`, `settled`.
   - Keep settlement authoritative: call RPC first, store returned result, then drive visual spin/reveal from that result.
   - Preserve current behavior that a successful round still renders even if `refreshProfile()` later fails.

4. **Upgrade interaction feedback and table UI**
   - Restyle `RouletteBetForm.tsx` to feel like a premium table/chip panel while keeping supported bets deterministic.
   - Show clearer selected bet state, potential payout label, disabled state during submit/spin, and more explicit success/loss/error feedback.
   - Add a result panel or equivalent inline reveal showing winning number/color, payout, and updated balance.

5. **Upgrade page/lobby atmosphere**
   - Enhance `CasinoLobby.tsx` and, if needed, `CasinoPage.tsx` with a stronger casino shell: richer gradients, felt/panel treatment, hierarchy around balance, rules, and the roulette feature.
   - Keep layout mobile-safe and avoid widening scope into navbar/app-wide redesign.

6. **Add shared styling and reduced-motion support**
   - Extend `src/index.css` with casino-specific utility classes/keyframes for wheel glow, metallic ring, result flash, felt texture treatment, and reduced-motion fallbacks.
   - Make reduced-motion users get a shorter/softer reveal while still seeing the exact settled result.

7. **Keep auth-aware page flow intact**
   - Confirm `CasinoPage.tsx` still blocks unauthenticated users and still waits for `profile` before rendering the lobby.
   - Avoid adding any credential persistence or artifact logging; browser verification should rely on a temporary live session only.

8. **Add/adjust tests**
   - Extend `RouletteGame.test.tsx` to cover: controls disabled during spin, result render after spin, preserved secondary handling of `refreshProfile()` failures, and no duplicate API invocation.
   - Extend `CasinoPage.test.tsx` to keep the auth/profile gate regression covered.
   - Add unit tests in `roulette.test.ts` and/or `roulette-wheel.ts` tests for wheel angle mapping, pocket order assumptions, and reduced-motion-safe helper behavior.

## verification approach
- Unit: `npm run test -- src/features/casino/lib/roulette.test.ts`
- Component: `npm run test -- src/features/casino/components/RouletteGame.test.tsx`
- Auth/page regression: `npm run test -- src/pages/CasinoPage.test.tsx`
- Lint touched files: `npm run lint`
- Confidence check: `npm run build`
- Browser verification after login:
  1. Start the app and open `/casino`.
  2. Log in with a valid existing account or a user-provided live session.
  3. Wait for profile/balance load; confirm the casino lobby renders instead of the login form.
  4. Place a supported bet and trigger a spin.
  5. Verify the wheel visibly spins and lands on the server-returned result.
  6. Verify win/loss feedback, result panel, and refreshed balance are visible.
  7. Verify no raw credentials are saved into artifacts.

## fix-only guidance if browser/auth verification reveals issues later
- If verification fails at login/session level only, fix only the minimal auth/session gating issue needed to reach the casino flow; do not redesign auth.
- If verification shows wheel/result mismatch, fix only the deterministic angle/pocket mapping and related reveal timing; do not rewrite settlement.
- If verification shows balance/result mismatch, inspect the API normalization and profile refresh path first; touch Supabase SQL only if there is direct evidence of an RPC defect.
- If verification shows visual jank only, prefer CSS/animation-state fixes over structural rewrites.

## explicit out-of-scope
- full 3D roulette or physics simulation,
- expanding into a full casino platform or new games,
- broad navbar/app-shell redesign outside casino polish,
- rewriting existing Supabase settlement RPC without evidence of a bug,
- storing credentials, tokens, or raw auth secrets in repo artifacts,
- copied third-party roulette code or copyrighted assets.
