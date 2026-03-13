# Workspace Knowledge (Lovable)

## Coding Style and Naming

- Use **TypeScript-first** React code with functional components and hooks.
- Prefer explicit, readable naming:
  - Components: `PascalCase`
  - Hooks: `useSomething`
  - Variables/functions: `camelCase`
  - Constants: `UPPER_SNAKE_CASE` only for true constants
- Keep files focused; split large logic into helpers/hooks/api modules.
- Avoid introducing new `any`; if needed, use `unknown` + narrowing.

## Preferred Libraries and Patterns

- UI: Tailwind CSS + shadcn/ui primitives.
- Routing: React Router.
- Backend/data: Supabase client.
- Notifications: Sonner toast.
- Pattern preference:
  - `features/<feature>/api` for data operations
  - `features/<feature>/hooks` for view-model/business logic
  - `components` for reusable presentation

## Clean Code Rules for AI-Generated Output

- Prefer composition over monolithic components.
- Keep side effects inside `useEffect` with proper cleanup.
- Keep async operations in `try/catch/finally` when loading state exists.
- Handle failures with user-friendly toasts; do not swallow errors.
- Do not add comments unless logic is genuinely non-obvious.
- Avoid cosmetic churn in unrelated files.

## UI/UX and Responsiveness Rules

- Preserve existing design system and spacing rhythm.
- Do not break mobile layouts; ensure stable behavior on desktop and mobile.
- Respect fixed-height layout constraints where implemented.
- Use subtle animations only when they improve clarity; avoid noisy transform effects.

## Formatting and Imports

- Use `@/` alias for `src` imports.
- Keep imports minimal and grouped:
  1. external packages
  2. internal alias imports
  3. relative imports
- Keep quote style consistent with edited file.

## Testing and Verification Preferences

- Run targeted lint/tests for touched files first.
- Prefer quick verification before broad checks.
- Suggested commands:
  - `npx eslint <touched-files>`
  - `npm run test -- <single-test-file>`
  - `npm run build`

## Behavioral Rules for Assistant Output

- Default language for user communication: **English**.
- Tone: concise, direct, teammate-like.
- Focus on actionable edits, not long theory.
- When reporting results, include:
  - what changed
  - where (file paths)
  - verification status
