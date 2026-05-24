---
title: Betclic home prototype redesign handoff
created: 2026-05-24
repo: /Users/piotr/Documents/JS/bsplic-2-0
branch: codex/betclic-home-prototypes
---

## Context

The work is a prototype-only redesign route for the first/home page, inspired by the Betclic mobile app reference screenshots in `betclic-reference/`. It is not integrated into the real `/` home page yet.

Current route:

`/betclic-home-prototypes?variant=8&role=admin&splash=2`

Useful params:

- `variant=1..8`: switches between eight home layout/nav prototypes.
- `role=user|admin`: switches between normal-user and admin chrome.
- `splash=1..5`: switches splash prototypes.
- `splash=0`: skips the splash overlay for faster nav/layout review.

## Main Files

- `src/features/home/prototypes/BetclicHomePrototypes.tsx`
- `src/features/home/prototypes/betclic-home-prototypes.css`
- `src/App.tsx`
- `src/index.css`
- `src/main.tsx`
- `eslint.config.js`
- `.ai/docs/redesign/betclic-home-prototypes.md` contains the local design notes but is ignored by git.

## Implemented

- Added route `/betclic-home-prototypes`.
- Added 8 prototype variants using real app/Supabase data shape for bets/categories/profile/coupon/admin metrics.
- Added distinct top and bottom bars for each variant and role combination.
- Added scroll-down behavior that hides both top and bottom chrome and restores on scroll-up/top.
- Added iOS viewport height fix using stable `100svh` plus JS fallback only where needed.
- Added 5 splash variants.
- Latest splash decision: S2 keeps the preferred neon `Oficjalny Sponsor` + `Big Yahu` text, while using the same red background and pattern treatment as S1.
- Added `splash=0` for reviewing page variants without waiting for splash.

## Verification Already Run

- `npx tsc --noEmit --pretty false`
- `npm run lint`
  - Passed with existing `react-refresh/only-export-components` warnings in pre-existing shadcn/context files.
- `npm run build`
  - Passed with the existing Vite large chunk warning.
- Browser audit in the Codex in-app browser:
  - 16/16 `variant x role` views passed: no horizontal overflow, real data present, switchers visible, scroll-hide works.
  - 5/5 splash variants passed: sponsor text present, `Big Yahu` present, no old sponsor boxes, no horizontal overflow.

## Data/Env Notes

- User added prod env values to `.env`.
- `.env.local` may still override `.env` in normal Vite startup. During prototype review, the dev server was run using values from `.env` so prod Supabase data appeared.
- If the next session needs the same prod data and Vite picks `.env.local`, start Vite with `.env` values injected into the process env.

## What To Do Next

- Let the user test/annotate the prototype in browser.
- Once they pick a direction, fold only the chosen variant into the real app and remove throwaway variants.
- Re-check iOS device behavior after integrating into the real page.

## Suggested Skills

- `frontend-design`: for polishing the chosen UI direction.
- `webapp-testing` or `browser:browser`: for Playwright/in-app browser verification.
- `next-best-practices` is not relevant here because this is Vite React, not Next.js.
