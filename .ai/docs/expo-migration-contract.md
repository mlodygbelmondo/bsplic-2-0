# BSPLIC Expo Migration Contract

Status: approved by Piotr on 2026-07-21.

This document is the authoritative reference for the Expo migration. Agents must read it before changing the mobile application. If implementation pressure conflicts with this contract, preserve the contract and report the blocker instead of silently reducing scope.

## Outcome

- Build the most complete Expo migration achievable during an autonomous overnight run.
- Process the entire production feature inventory; do not stop at a foundation, prototype, or MVP.
- Preserve product behavior, business rules, roles, data, and the established mobile design with high 1:1 fidelity.
- Native components may replace web components when they improve correctness or performance without redesigning the product.
- Never claim full parity unless every inventory item is verified. Report every item as `complete`, `partial`, `blocked`, or `not started`.

## Platforms and repository layout

- Target iOS and Android.
- Perform interactive QA only on iOS during this run to avoid exhausting the host machine. Keep Android code and configuration cross-platform and statically valid.
- Keep the existing Vite/PWA application working from the repository root with no user-visible changes.
- Create the Expo application under `mobile/`.
- Put genuinely reusable platform-neutral code under `packages/shared/` only when extracting it does not regress the web application.
- Use Expo managed workflow. Generate native directories temporarily for verification and do not commit them unless a dependency makes persistent native changes necessary.

## Git and safety

- Work on `codex/expo-migration`.
- Make small logical checkpoint commits. Do not push.
- Never commit credentials, secrets, local environment files, signing material, or test-account details.
- The production Supabase project remains the backend.
- New SQL migrations are allowed only when strictly required: create a new migration with tests, but do not apply it to production.
- Operator CLI tools, season-reset scripts, and agent scripts remain non-mobile repository tools.

## App identity and links

- Display name: `BSPLIC 2.0`.
- Scheme: `bsplic`.
- iOS bundle identifier and Android package: `pl.bsplic.app`.
- Production web fallback: `https://bsplic.vercel.app`.
- Configure Expo Router deep links, iOS Universal Links, and Android App Links so supported web paths open the installed app and otherwise remain on the PWA.
- Keep `bsplic://` as a development and password-recovery fallback.
- Prepare configuration and clearly document external activation steps that require Apple Team ID, signing, Vercel association files, Supabase redirect allow-list changes, or store credentials.

## Authentication and storage

- Include email/password login, persistent session, logout, and password recovery.
- Do not include registration or magic-link login.
- Store sensitive session material through SecureStore.
- Store preferences, theme, coupon, cached read models, and local drafts in non-sensitive persistent storage.
- Do not share sessions with the browser.

## Visual scope

- The running PWA at a mobile viewport is the visual reference.
- Preserve both light and dark themes, Inter typography, BSPLIC colors, assets, spacing character, cards, casino art direction, and motion character.
- Prefer NativeWind where it is stable and suitable, but use React Native styles or native components when they provide better fidelity or performance.
- Preserve the existing primary bottom navigation exactly:
  - Zaklady
  - Social
  - Ruletka
  - Blackjack
  - Rankingi
- Keep profile, balance, top-up, transfers, theme, notifications, and logout in the native equivalent of the current header/menu.
- Preserve the liquid-glass appearance, selected colors, rounding, blur, and scroll-hiding behavior. Use native glass where available and a faithful blur/solid fallback elsewhere.
- Account for safe areas, keyboard avoidance, touch targets, reduced motion, accessibility labels, loading, error, empty, active, and offline states.
- Do not add placeholder screens that pretend an unfinished feature works.

## Production feature inventory

Migrate every production UI capability:

1. App shell, maintenance state, connectivity state, themes, providers, and role gates.
2. Email/password login, password recovery, session refresh, and logout.
3. Sportsbook home: categories, active/in-progress bets, sorting, filtering, pagination, realtime updates, and option selection.
4. Coupon: persistence, single/AKO, exclusions, stake inputs, validation, secure placement, balance refresh, and copied social coupons.
5. Wallet: balance, daily top-up, money transfer, and transfer history.
6. Profile: own/public profile, avatar camera/gallery upload and compression, badges, statistics, histories, and sharing.
7. Rankings: sportsbook/casino modes, sorting, metrics, and responsive presentation.
8. Social: feed, posts, image uploads, stories, mentions, Eniu, comments, threads, reactions, reactor lists, filters, deep links, coupon copying, sharing, and realtime updates.
9. YouTube and Spotify content through a safe inline WebView with an external-open fallback.
10. Casino lobby.
11. Roulette: server-authoritative table snapshot, realtime, countdown, placement, participants, history, spin presentation, audio, haptics, and social sharing.
12. Blackjack: server-authoritative game actions, hit/stand/double/split/insurance, staged reveal, cards, audio, haptics, and celebration effects.
13. Jackpot: home card, ticket purchase, polling, deep link, draw presentation, background/resume correctness, and reward claim.
14. Bonus campaigns and feature polls.
15. In-app realtime notifications, unread state, navigation, and sound preference. Do not add background push in this migration.
16. Full native administrator and moderator UI: dashboard, bet management/creation, proposals, categories, Eniu, bonus campaigns, and feature polls.

Do not migrate development-only roulette/jackpot routes. Do not add biometrics, Apple/Google login, push notifications, or other new product features.

## Offline and lifecycle behavior

- Cache previously loaded bets, profiles, rankings, social content, and histories for read-only offline viewing.
- Persist the coupon and social drafts locally.
- Do not queue wagering, casino, financial, reaction, or admin writes while offline. Clearly disable them and explain why.
- On reconnect or foreground resume, refresh auth and resynchronize server-authoritative snapshots and realtime subscriptions.
- Never assume roulette/jackpot timers or animations continued while the app was suspended. Resume from server state.

## Media and motion

- Support camera and photo library for profile/social images.
- Crop/manipulate/compress natively while preserving the current upload limits and storage expectations.
- Preserve casino and jackpot ordering, timing, result semantics, visual character, audio, and haptics. Frame-identical animation is not required.
- Respect reduced-motion preferences.

## Implementation order

1. Expo scaffold, configuration, and shared foundations.
2. Auth, providers, secure storage, persistence, networking, and deep links.
3. Shell, themes, navigation, maintenance, connectivity, and common primitives.
4. Sportsbook and coupon.
5. Profile, rankings, wallet, and transfers.
6. Social.
7. Roulette.
8. Blackjack.
9. Jackpot, bonuses, and feature polls.
10. Admin/moderator.
11. Complete inventory audit, review fixes, and final QA.

## Definition of done for a module

A module is complete only when it:

- uses the real Supabase contract;
- handles loading, error, empty, offline, authentication, and applicable role states;
- has complete navigation and no deceptive stubs;
- preserves the established PWA design at mobile size;
- has been manually exercised or covered by a credible test.

## Verification

Run as the environment permits:

- dependency installation;
- Expo Doctor;
- TypeScript checking;
- lint;
- iOS export/bundle;
- focused unit tests for migrated logic;
- existing web lint/test/build after shared-code extraction;
- manual iOS simulator walkthrough when a runtime is available;
- side-by-side PWA mobile screenshots and iOS screenshots for completed visual surfaces.

Do not run an Android emulator during this migration. Missing iOS runtime does not block implementation; report what was verified instead.

After implementation, use an independent reviewer to inspect the full diff, feature inventory, correctness, secrets, web regressions, and reporting accuracy. Fix actionable findings before final delivery when possible.

## QA data rules

- Use the existing ignored test credentials without printing or committing them.
- Normal low-value user actions are allowed on the reusable test account.
- Reversible admin QA is allowed: record prior state, mark test data, and clean it up afterward.
- Do not reset a season, settle production bets, make irreversible balance changes, or alter other users' data without a certain rollback path.

## Autonomous execution and final report

- The main agent may use at most two parallel subagents with disjoint file ownership and remains responsible for integration.
- At a blocker, diagnose for a bounded period, checkpoint safe work, record the exact blocker, continue with independent inventory items, and return later if useful.
- Do not stop until every inventory item is classified.
- Existing unrelated defects should be documented, not broadened into refactors, unless the smallest tested fix is necessary to continue.
- The final report must include changed files, logical commits, commands and results, manual QA evidence, reviewer findings, the complete status inventory, known risks, and every external/manual input still needed from Piotr.
