---
date: 2026-06-12T02:18:39+02:00
topic: "Which Supabase tables can have Realtime disabled to reduce resource usage?"
tags: [research, codebase, supabase, realtime, performance]
status: complete
last_updated: 2026-06-12
---

# Research: Supabase Realtime Tables

**Date**: 2026-06-12T02:18:39+02:00

## Research Question

Which public tables can be removed from the `supabase_realtime` publication without breaking the current browser subscriptions?

## Summary

The current frontend subscribes directly to five realtime tables: `bets`, `categories`, `casino_roulette_rounds`, `social_realtime_events`, and `user_notifications`.

The disk IO optimization migration already encodes the intended publication membership: remove direct realtime from `placed_bets`, `bet_proposals`, `casino_roulette_bets`, `social_posts`, `social_comments`, `social_reactions`, and `casino_social_shares`, while keeping the five browser-subscribed tables.

## Detailed Findings

### Browser Subscriptions

- `src/features/home/api/bets.ts:66` subscribes to `public.bets` for active bet list refreshes.
- `src/features/home/api/categories.ts:14` subscribes to `public.categories` for category list refreshes.
- `src/features/casino/api/roulette.ts:240` subscribes to `public.casino_roulette_rounds` with a `table_key` filter.
- `src/features/social/hooks/useSocialRealtimeFeed.ts:115` subscribes only to inserts on `public.social_realtime_events` for social feed invalidation.
- `src/features/notifications/components/NotificationsBell.tsx:135` subscribes to `public.user_notifications` filtered by `user_id`.

### Tables Removed From Direct Realtime

- `supabase/migrations/20260610231207_supabase_disk_io_optimization.sql:18` through `:114` drops these tables from `supabase_realtime` when present:
  `placed_bets`, `bet_proposals`, `casino_roulette_bets`, `social_posts`, `social_comments`, `social_reactions`, and `casino_social_shares`.
- `src/features/performance/supabaseDiskIoOptimizationMigration.test.ts:22` through `:37` tests that those tables are removed from the publication.

### Tables Kept In Direct Realtime

- `supabase/migrations/20260610231207_supabase_disk_io_optimization.sql:116` through `:184` adds or keeps:
  `bets`, `categories`, `casino_roulette_rounds`, `social_realtime_events`, and `user_notifications`.
- `src/features/performance/supabaseDiskIoOptimizationMigration.test.ts:39` through `:52` tests that those tables remain in the publication.

### Social Feed Pattern

- `supabase/migrations/20260527020753_enable_social_notifications_realtime.sql:235` through `:263` creates triggers on social/coupon/bet activity tables.
- Those triggers emit compact invalidation rows into `social_realtime_events`, so the browser does not need direct realtime on each source table.
- `supabase/migrations/20260610231207_supabase_disk_io_optimization.sql:455` through `:473` adds cleanup for old `social_realtime_events` rows.

## Code References

- `src/features/home/api/bets.ts:66` - direct subscription to `bets`.
- `src/features/home/api/categories.ts:14` - direct subscription to `categories`.
- `src/features/casino/api/roulette.ts:240` - direct subscription to `casino_roulette_rounds`.
- `src/features/social/hooks/useSocialRealtimeFeed.ts:115` - direct subscription to `social_realtime_events`.
- `src/features/notifications/components/NotificationsBell.tsx:135` - direct subscription to `user_notifications`.
- `supabase/migrations/20260610231207_supabase_disk_io_optimization.sql:18` - removed publication tables.
- `supabase/migrations/20260610231207_supabase_disk_io_optimization.sql:116` - kept publication tables.

## Architecture Insights

Realtime is intentionally narrowed to browser-visible invalidation channels. High-write or detail tables can stay out of `supabase_realtime` as long as they still feed aggregate/state tables or event tables used by the browser.

## Open Questions

- Check production publication membership before applying any manual changes, especially if external consumers subscribe to removed tables.
