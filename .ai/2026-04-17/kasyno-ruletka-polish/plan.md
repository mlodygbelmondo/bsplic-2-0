# Roulette UI Polish — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Polish the existing realtime roulette UI with hidden spin result, colored wheel segments, celebration animations, high-contrast buttons, production Polish copy, and mobile responsiveness.

**Architecture:** CSS-first approach — new keyframes and segment coloring in `index.css`, minimal React state additions (a `revealed` boolean in RouletteWheel). No new dependencies. All animations respect `prefers-reduced-motion`.

**Tech Stack:** React 18 + TypeScript + Tailwind CSS + shadcn/ui + CSS keyframes

---

## Constraints

- No backend/RPC/migration changes.
- Must pass: `npm run build`, `npm run lint`, `npm run test -- src/features/casino/lib/roulette.test.ts`, `npm run test -- src/features/casino/components/RouletteGame.test.tsx`
- No new npm dependencies.
- All user-facing text in Polish.
- Keep auth-only boundaries; no secrets in code.

---

### Task 1: Colored wheel segments (CSS)

**Files:**
- Modify: `src/index.css` (lines 318–334, the `.roulette-wheel-segment` and `::before` rules)

**What to change:**

Replace the thin-line `::before` pseudo-element with a filled conic wedge. Each segment spans `360deg / 37 ≈ 9.73deg`. Use CSS custom property `--seg-color` set inline from React.

Add these rules:

```css
.roulette-wheel-segment {
  position: absolute;
  inset: 0;
  /* clip to a single wedge: polygon from center to arc edges */
  clip-path: polygon(
    50% 50%,
    50% 0%,
    /* ~tan(4.865deg) offset ≈ 8.5% */
    58.5% 0%
  );
  background: var(--seg-color, rgba(17,17,17,0.96));
  border-right: 1px solid rgba(255,255,255,0.07);
  transform-origin: center;
}
```

Remove the old `::before` rule entirely (the thin white line).

**Why:** Currently segments have no fill — only text colors and a faint line divider. The clip-path wedge gives each segment a visible red/black/green background.

**Step 1:** Update `.roulette-wheel-segment` in `src/index.css` as described above. Remove the `::before` block.

**Step 2:** In `src/features/casino/components/RouletteWheel.tsx`, add the inline `--seg-color` custom property to each segment div. Map colors:
- `red` → `rgba(185, 28, 28, 0.85)` (deep red)
- `black` → `rgba(23, 23, 23, 0.92)` (near-black)
- `green` → `rgba(5, 120, 60, 0.88)` (emerald)

Change the segment div (line 57-58):
```tsx
<div
  key={value}
  className="roulette-wheel-segment"
  style={{
    transform: `rotate(${angle}deg)`,
    '--seg-color': color === 'red' ? 'rgba(185,28,28,0.85)'
      : color === 'green' ? 'rgba(5,120,60,0.88)'
      : 'rgba(23,23,23,0.92)',
  } as React.CSSProperties}
>
```

**Step 3:** Verify visually — `npm run dev`, check wheel shows colored wedges. Run `npm run build` to confirm no TS errors with the CSS custom property cast.

---

### Task 2: Hidden winning number during spin

**Files:**
- Modify: `src/features/casino/components/RouletteWheel.tsx`
- Modify: `src/index.css` (add `.roulette-wheel-center-hidden` styles)

**What to change:**

The center label currently shows `winningNumber` immediately (line 74). During `spinning` phase, show `?` instead, then reveal the actual number near the end of the spin.

**Step 1:** Add a `revealed` state + timer to `RouletteWheel.tsx`:

```tsx
import { useEffect, useState } from 'react';

// Inside the component, before the return:
const [revealed, setRevealed] = useState(phase !== 'spinning');

useEffect(() => {
  if (phase !== 'spinning' || remainingSpinMs <= 0) {
    setRevealed(true);
    return;
  }
  setRevealed(false);
  // Reveal 800ms before spin ends
  const revealDelay = Math.max(0, remainingSpinMs - 800);
  const timer = setTimeout(() => setRevealed(true), revealDelay);
  return () => clearTimeout(timer);
}, [phase, remainingSpinMs]);
```

**Step 2:** Update center label (line 74):
```tsx
<span className={cn('roulette-wheel-center-label', !revealed && 'roulette-wheel-center-hidden')}>
  {revealed ? (winningNumber ?? '—') : '?'}
</span>
```

**Step 3:** Add CSS for the hidden/reveal transition in `src/index.css` after `.roulette-wheel-center-label`:

```css
.roulette-wheel-center-hidden {
  filter: blur(6px);
  opacity: 0.5;
  transition: filter 0.3s ease, opacity 0.3s ease;
}
.roulette-wheel-center-label {
  /* add to existing rule: */
  transition: filter 0.4s ease, opacity 0.4s ease;
}
```

**Step 4:** Run `npm run test -- src/features/casino/components/RouletteGame.test.tsx`. The test on line 201 checks for `'Koło się kręci'` text and disabled button — it does NOT assert the center label text, so it should still pass. The test on line 245 checks `transition-duration` on the disc, not the label — also unaffected. Verify all 4 tests pass.

---

### Task 3: Button visibility & CTA styling

**Files:**
- Modify: `src/features/casino/components/RouletteBetForm.tsx`
- Modify: `src/index.css` (add `.roulette-btn-type`, `.roulette-btn-type-active`, `.roulette-btn-cta` classes)

**What to change:**

Bet type buttons use `variant="outline"` which is nearly invisible on dark bg. Replace with explicit high-contrast classes.

**Step 1:** Add CSS classes in `src/index.css`:

```css
.roulette-btn-type {
  border: 1px solid rgba(255,255,255,0.20);
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.85);
}
.roulette-btn-type:hover:not(:disabled) {
  background: rgba(255,255,255,0.12);
  border-color: rgba(255,255,255,0.30);
}
.roulette-btn-type-active {
  background: rgba(245,158,11,0.25);
  border-color: rgba(245,158,11,0.55);
  color: #fcd34d;
}
.roulette-btn-type-active:hover:not(:disabled) {
  background: rgba(245,158,11,0.32);
}
.roulette-btn-cta {
  background: linear-gradient(135deg, #f59e0b, #dc2626);
  color: white;
  font-weight: 700;
  letter-spacing: 0.04em;
  box-shadow: 0 4px 20px rgba(245,158,11,0.35);
  border: none;
}
.roulette-btn-cta:hover:not(:disabled) {
  filter: brightness(1.1);
  box-shadow: 0 6px 28px rgba(245,158,11,0.45);
}
.roulette-btn-cta:disabled {
  opacity: 0.45;
  filter: saturate(0.5);
}
```

**Step 2:** In `RouletteBetForm.tsx`, update bet type buttons (line 52):
```tsx
variant="ghost"
className={cn(
  'justify-center roulette-btn-type',
  betType === option && 'roulette-btn-type-active',
)}
```

Do the same for bet value buttons (line 78):
```tsx
variant="ghost"
className={cn(
  'justify-center roulette-btn-type',
  betValue === option.value && 'roulette-btn-type-active',
)}
```

**Step 3:** Update submit button (line 115):
```tsx
<Button type="button" onClick={onSubmit} disabled={loading || disabled} className="sm:min-w-32 roulette-btn-cta">
```

**Step 4:** Run `npm run test -- src/features/casino/components/RouletteGame.test.tsx`. Tests find buttons by accessible name (`'Postaw zakład'`, `'Kolor'`, `'Czerwone'`), not by CSS class — they should pass unchanged. Verify.

---

### Task 4: Win/loss celebration animations

**Files:**
- Modify: `src/features/casino/components/RouletteGame.tsx`
- Modify: `src/index.css`

**What to change:**

Add visual feedback when a round settles. Detect win/loss from `table.activeBets` having `is_win` set after settlement. Show a glow/shimmer overlay for wins, a subtle red flash for losses.

**Step 1:** Add result detection state in `RouletteGame.tsx`:

```tsx
const [roundResult, setRoundResult] = useState<'win' | 'loss' | null>(null);

// After table.phase changes to settled, check bets:
useEffect(() => {
  if (table.phase !== 'settled') {
    setRoundResult(null);
    return;
  }
  const hasWin = table.activeBets.some((b) => b.is_win === true);
  const hasLoss = table.activeBets.some((b) => b.is_win === false);
  if (hasWin) setRoundResult('win');
  else if (hasLoss) setRoundResult('loss');
  else setRoundResult(null);
}, [table.phase, table.activeBets]);
```

**Step 2:** Wrap the wheel Card with a conditional class:
```tsx
<Card className={cn(
  'casino-card border-white/10 bg-black/30 text-white',
  roundResult === 'win' && 'roulette-result-win',
  roundResult === 'loss' && 'roulette-result-loss',
)}>
```

**Step 3:** Add CSS animations in `src/index.css`:

```css
@keyframes roulette-win-glow {
  0% { box-shadow: 0 0 0 0 rgba(245,158,11,0); }
  30% { box-shadow: 0 0 40px 8px rgba(245,158,11,0.35), 0 0 80px 20px rgba(34,197,94,0.15); }
  100% { box-shadow: 0 22px 70px rgba(0,0,0,0.36); }
}
@keyframes roulette-loss-flash {
  0% { border-color: rgba(255,255,255,0.1); }
  25% { border-color: rgba(220,38,38,0.4); }
  100% { border-color: rgba(255,255,255,0.1); }
}
.roulette-result-win {
  animation: roulette-win-glow 1.8s ease-out;
}
.roulette-result-loss {
  animation: roulette-loss-flash 1s ease-out;
}
```

**Step 4:** Add reduced-motion override in the existing `@media (prefers-reduced-motion: reduce)` block:
```css
.roulette-result-win,
.roulette-result-loss {
  animation: none;
}
```

**Step 5:** Verify tests still pass — the test mock never sets `phase` to `'settled'` with `is_win` values simultaneously, so no DOM change expected. Run `npm run test -- src/features/casino/components/RouletteGame.test.tsx`.

---

### Task 5: Production Polish-language copy

**Files:**
- Modify: `src/features/casino/components/CasinoLobby.tsx`
- Modify: `src/features/casino/components/RouletteGame.tsx`
- Modify: `src/features/casino/components/RouletteRoundStatus.tsx`
- Modify: `src/features/casino/components/RouletteRecentSpins.tsx`
- Modify: `src/features/casino/components/RouletteRecentWinsFeed.tsx`

**What to change — exact replacements:**

**CasinoLobby.tsx:**
- Line 22-24: Replace the developer-facing description:
  - OLD: `'Jeden stół, jedna faza oczekiwania i jeden wynik dla wszystkich graczy. Supabase trzyma pełną kontrolę nad rundą, zakładami i rozliczeniem salda.'`
  - NEW: `'Dołącz do wspólnego stołu — jeden spin, jeden wynik, emocje dzielone z innymi graczami w czasie rzeczywistym.'`
- Line 34: Replace backend-facing text:
  - OLD: `'Każda runda jest rozliczana po stronie backendu i od razu odświeża saldo profilu.'`
  - NEW: `'Twoje wygrane trafiają na konto natychmiast po każdym spinie.'`

**RouletteGame.tsx:**
- Line 79-81: Replace description:
  - OLD: `'Jeden stół dla wszystkich graczy. Serwer zamyka przyjmowanie zakładów po 15 sekundach, rozkręca koło i rozlicza wygrane.'`
  - NEW: `'Wspólny stół dla wszystkich graczy — postawisz zakład, a koło ruszy automatycznie.'`

**RouletteRoundStatus.tsx:**
- Line 39: Replace `'Synchronizacja'` with `'Do następnego spinu'` (more user-friendly).

**RouletteRecentSpins.tsx — no text changes needed** (already clean Polish).

**RouletteRecentWinsFeed.tsx — no text changes needed** (already clean Polish).

**Step 1:** Make all copy replacements listed above.

**Step 2:** Run `npm run test -- src/features/casino/components/RouletteGame.test.tsx`. The tests check for `'Postaw zakład'`, `'Koło się kręci'`, `'Twoje aktywne zakłady'`, `'Zakład przyjęty do wspólnej rundy.'` — none of these strings are being changed, so tests pass. Verify.

**Step 3:** Run `npm run build` to confirm no issues.

---

### Task 6: Mobile responsiveness

**Files:**
- Modify: `src/features/casino/components/RouletteGame.tsx`
- Modify: `src/index.css`

**What to change:**

**Step 1:** Make the wheel smaller on mobile. Add to `src/index.css`:

```css
@media (max-width: 480px) {
  .roulette-wheel-shell {
    max-width: 280px;
  }
  .roulette-wheel-label {
    font-size: 0.58rem;
  }
  .roulette-wheel-center {
    inset: 28%;
  }
  .roulette-wheel-center-label {
    font-size: 1.6rem;
  }
}
```

**Step 2:** In `RouletteGame.tsx`, ensure the two-column grid stacks on smaller screens. The current class `xl:grid-cols-[...]` (line 72) already stacks below `xl`. Verify this is sufficient — it is, since bet form goes below wheel on mobile.

**Step 3:** In `RouletteRoundStatus.tsx`, the flex layout already uses `md:flex-row` with column fallback — already responsive.

**Step 4:** Visual test: `npm run dev`, use browser devtools to check 375px and 414px viewports. Confirm wheel, bet form, and status panel render without overflow.

---

### Task 7: Final verification

**Step 1:** Run `npm run lint`
**Step 2:** Run `npm run build`
**Step 3:** Run `npm run test -- src/features/casino/lib/roulette.test.ts`
**Step 4:** Run `npm run test -- src/features/casino/components/RouletteGame.test.tsx`
**Step 5:** Run `npm run test` (full suite)

All must pass. If any test fails because of text content assertions, check the exact strings in the test file against the changes made.

---

## Out of Scope

- Backend RPC or Supabase migration changes
- New npm dependencies
- Auth flow changes
- Roulette game logic changes (payouts, bet types, etc.)
- Sound effects
- i18n framework (all strings remain hardcoded Polish)
