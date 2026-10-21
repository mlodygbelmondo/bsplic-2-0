# 19. Data contract: Supabase backend surface

Backend contract of the BSPLIC PWA that the native Expo rewrite must keep working against the same production Supabase project. All paths are relative to the repo root. Call counts come from a multi-line-aware grep sweep over non-test `src/` (tests under `*.test.*` and `src/test/db/` are excluded) and from the generated schema in `src/integrations/supabase/types.ts`.

## Files covered

- `src/integrations/supabase/client.ts` (24 lines): single `createClient<Database>` with publishable key. Auth options: `storage: localStorage`, `persistSession: true`, `autoRefreshToken: true`, `lock: bypassAuthWebLock` (no-op lock, `fn()` directly). Generated/bootstrap file.
- `src/integrations/supabase/types.ts` (2240 lines): generated schema. PostgrestVersion `14.4`. Tables at lines 15–1349, Views at 1350–1352 (empty), Functions at 1353–2094, Enums at 2095–2103, CompositeTypes at 2104–2106 (empty).
- `src/integrations/supabase/rpc.ts` (143 lines): `RpcContracts` map and `callRpc` wrapper for RPCs missing from generated types.
- `src/types/database.ts` (309 lines): hand-written domain types and `BADGE_DEFINITIONS`. Partly diverges from generated types.
- Data-access modules: `src/features/home/api/bets.ts`, `src/features/home/api/categories.ts`, `src/features/home/api/betProposals.ts`, `src/features/coupons/akoExclusionApi.ts`, `src/features/admin/api/akoExclusions.ts`, `src/features/feature-polls/feature-poll-api.ts`, `src/features/bonus-campaigns/bonus-campaign-api.ts`, `src/features/transfers/api.ts`, `src/features/jackpot/api/jackpot.ts`, `src/features/rankings/queries.ts`, `src/features/social/api/social.ts`, `src/features/social/api/eniuBot.ts`, `src/features/social/images.ts`, `src/features/social/hooks/useSocialRealtimeFeed.ts`, `src/features/casino/api/roulette.ts`, `src/features/slots/useSlotGame.ts`, `src/features/notifications/components/NotificationsBell.tsx`, `src/features/notifications/sound.ts`.
- Admin, auth and page call sites: `src/features/admin/components/{AgentRunsTab,CategoriesTab,CreateBetTab,ManageBetsTab,ProposalsTab}.tsx`, `src/contexts/AuthContext.tsx`, `src/pages/ProfilePage.tsx`.
- Local storage sites: `src/contexts/ThemeContext.tsx`, `src/contexts/CouponContext.tsx`, `src/components/{BetList,CouponDrawer,LoginPage}.tsx`, `src/features/home/components/AuthenticatedHome.tsx`, `src/features/casino/lib/{preferences,casinoAudio,blackjackSfx}.ts`, `src/features/casino/components/games/BlackjackGame.tsx`, `src/lib/pwa-update.ts`.
- Edge functions: `supabase/functions/` (`respond-as-eniu`, `command-eniu`, `bsplic-agent-mcp`, `_shared`).
- Storage migrations: `supabase/migrations/20260317150000_social_pasted_images.sql`, `20260317190000_profile_avatar.sql`, `20260317194500_comment_avatars_and_limits.sql`.
- Method: grep over non-test `src/` for `.from(`, `.rpc(`, `callRpc(`, `.storage`, `functions.invoke`, `.channel(`, `postgres_changes`, `localStorage`, `sessionStorage`, and `bsplic` key strings. No `sessionStorage` use exists in `src/`.

## Tables

Generated `Tables` (30, `types.ts:15–1349`). Ten tables have direct `.from()` calls in non-test src. The other 20 are reached only through RPCs or realtime.

| Table | Direct `.from()` in src | Notes |
|---|---|---|
| `bets` | select: `home/api/bets.ts:19,57`, `admin/CreateBetTab.tsx:43`, `admin/ManageBetsTab.tsx:127`; count: `admin/CategoriesTab.tsx:69`; delete: `admin/ManageBetsTab.tsx:314` | Realtime `*` (see Realtime) |
| `categories` | select: `home/api/categories.ts:5`, `admin/CategoriesTab.tsx:37`, `admin/CreateBetTab.tsx:41`, `admin/ProposalsTab.tsx:89`, `admin/ManageBetsTab.tsx:128`; insert: `admin/CategoriesTab.tsx:56`; update: `admin/CategoriesTab.tsx:103–104`; delete: `admin/CategoriesTab.tsx:75` | Realtime `*` |
| `bet_proposals` | insert: `home/api/betProposals.ts:26`; select: `admin/ProposalsTab.tsx:85` | Review through RPC `review_bet_proposal` |
| `bet_ako_exclusions` | select: `coupons/akoExclusionApi.ts:22` | Writes go through admin RPCs |
| `agent_runs` | select: `admin/AgentRunsTab.tsx:105` | Written by agent RPCs |
| `bonus_campaigns` | select with embed `bonus_campaign_claims(count)`: `bonus-campaigns/bonus-campaign-api.ts:44`; insert: `:61–62`; update `is_active=false`: `:73–74` | |
| `feature_polls` | insert: `feature-polls/feature-poll-api.ts:121`; hard delete: `:146`; update `is_active=false`: `:155` | |
| `feature_poll_options` | insert: `feature-polls/feature-poll-api.ts:136` | |
| `profiles` | select: `pages/ProfilePage.tsx:79–83` (`.ilike("username")` at `:81`); select by id at sign-in: `contexts/AuthContext.tsx:65`; select `id, username`: `admin/ProposalsTab.tsx:114`; update `avatar_url`: `pages/ProfilePage.tsx:215–216` | Other users' rows depend on RLS (see Open questions) |
| `user_roles` | select `role` by `user_id` at sign-in: `contexts/AuthContext.tsx:66` | Read by `AuthContext` only |
| `casino_roulette_rounds` | none direct | Read via realtime `casino-roulette-rounds-*` |
| `badges`, `bonus_campaign_claims`, `feature_poll_votes`, `placed_bets`, `coupons` | none direct | Used by RPCs |
| `daily_jackpot_pools`, `daily_jackpot_tickets`, `daily_jackpot_funding_entries`, `daily_jackpot_events` | none direct | Used by jackpot RPCs |
| `casino_rounds`, `casino_slot_accounts`, `casino_slot_activity`, `casino_slot_bonus`, `casino_slot_spins` | none direct | Slot RPCs are live; `casino_rounds` has no src reference |
| `casino_blackjack_games`, `casino_blackjack_tables`, `casino_roulette_bets` | none direct | Used by blackjack/roulette RPCs |
| `casino_social_shares`, `money_transfers` | none direct | Written through `create_casino_social_share`, `create_money_transfer` |

Tables used by the social and notification code that are not in generated types (contract exists only in `rpc.ts` and feature modules):

- `user_notifications`: realtime `notifications-${userId}` (`NotificationsBell.tsx:142–168`) plus RPCs.
- `social_realtime_events`: realtime INSERT feed (`useSocialRealtimeFeed.ts:182–186`). Its `source_table` values seen in code: `social_posts`, `social_comments`, `social_reactions`, `casino_social_shares`, `coupons`.
- `social_posts`, `social_comments`, `social_reactions`: named as `source_table` values only. Social stories table name was not confirmed.

Domain types in `src/types/database.ts` (hand-written): `Profile` (:1), `RouletteTableRound` (:33), `RouletteBetRecord` (:47), `RouletteRoundParticipant` (:60), `RouletteRecentWin` (:75), `CasinoHistoryEntry` (:81), `Category` (:92), `Bet` (:108), `PlacedBet` (:124), `Coupon` (:138), `BetProposal` (:148), `Badge` (:163), `CouponLeg` (:176), `CouponHistoryEntry` (:187), `SocialCouponEntry` (:197), `SocialFeedItem` (:216), `SocialStory` (:242), `SocialComment` (:252), `UserNotification` (:264), `PublicProfile` (:279).

## Views

- None. Generated `Views` block is empty (`types.ts:1350–1352`). No src read targets a view. Social and notification data come from RPCs.

## RPC functions

Total distinct RPC names called from non-test `src/`: 67.
- 52 generated RPCs (`types.ts:1353–2094`), including 4 chosen by ternary: `get_user_rankings` and `get_casino_rankings` (`rankings/queries.ts:34–37`), `casino_slot_spin` and `casino_slot_bonus_spin` (`slots/useSlotGame.ts:85–87`). `create_casino_social_share` is generated and is also in `RpcContracts`; it is counted here once.
- 15 non-generated RPCs called only through `callRpc` (listed under rpc.ts helpers).

Generated RPCs (`types.ts:1353–2094`, 74 total) grouped by domain. Args and Returns are defined in `types.ts`; many Returns are `Json`.

Called from src (52):

- Sportsbook and coupons: `place_bet_secure`, `get_user_coupon_history`, `get_user_stats`, `review_bet_proposal`.
- Admin sportsbook: `admin_settle_bet`, `admin_get_dashboard_summary`, `admin_get_bet_ako_exclusions`, `admin_replace_bet_ako_exclusions`, `admin_create_bet_with_ako_exclusions` (`admin/api/akoExclusions.ts:110`), `admin_update_bet_with_ako_exclusions` (`:138`).
- Feature polls: `get_available_feature_poll`, `submit_feature_poll_vote`, `admin_get_feature_polls`.
- Public profile: `get_public_profile`, `get_public_badges`.
- Money transfers: `create_money_transfer` (`transfers/api.ts:103`), `get_money_transfer_history`, `get_money_transfer_rules`, `search_money_transfer_recipients`.
- Daily top-up: `secure_daily_topup`.
- Daily jackpot: `get_daily_jackpot_state` (`jackpot/api/jackpot.ts:156`), `buy_daily_jackpot_ticket` (`:168`), `get_daily_jackpot_draw` (`:243`), `reveal_daily_jackpot_draw` (`:257`), `claim_daily_jackpot_reward` (`:271`).
- Bonus campaigns: `get_available_bonus_campaigns`, `claim_bonus_campaign`.
- Casino history: `get_user_casino_history`.
- Roulette: `play_roulette_round`, `advance_roulette_round_if_due`, `get_current_roulette_round`, `get_my_current_roulette_bets`, `get_roulette_table_snapshot`, `get_recent_roulette_spins`, `get_recent_roulette_wins`, `place_roulette_table_bet`, `get_roulette_round_participants` (`casino/api/roulette.ts:153–158`).
- Blackjack: `place_blackjack_bet`, `get_blackjack_table_info`, `get_current_blackjack_game`, `blackjack_hit`, `blackjack_stand`, `blackjack_double_down`, `blackjack_split`, `blackjack_take_insurance`, `blackjack_decline_insurance`.
- Slots: `casino_slot_state` (direct), `casino_slot_spin` and `casino_slot_bonus_spin` (ternary at `useSlotGame.ts:85–87`, args `{ p_game, p_stake, p_request_id }`).
- Rankings: `get_user_rankings`, `get_casino_rankings` (ternary at `rankings/queries.ts:34–37`).
- Social (generated, via `callRpc`): `create_casino_social_share` (`social/api/social.ts:76`).

Generated RPCs not called from non-test src (22):

- Agent (11): `agent_accept_bet_proposals`, `agent_create_bets`, `agent_create_bet_proposals`, `agent_get_bet_context`, `agent_get_pending_settlement_context`, `agent_settle_bet`, `agent_flag_settlement_hold`, `agent_set_bet_ako_exclusions`, `agent_start_run`, `agent_finish_run`, `agent_get_recent_runs`.
- Admin (1): `admin_credit_balance`.
- Jackpot (4): `finalize_daily_jackpot_if_due`, `maintain_daily_jackpot`, `admin_finalize_daily_jackpot`, `mark_daily_jackpot_result_viewed`.
- Other (6): `award_badge`, `backfill_streaks_and_badges` (Args `never`), `get_social_coupon_feed`, `get_warsaw_draw_at`, `has_role`, `place_roulette_bet`.

These may be called by an external agent or bot, or not at all. Verify against the live schema before treating them as dead.

Count check: 52 called + 22 not called = 74 generated.

Note on `get_social_coupon_feed`: generated but not called. The live social feed is `get_social_feed` (rpc.ts).

Note on season reset: `preview_global_season_reset` and `execute_global_season_reset` are not in generated types and have no non-test src caller. They are defined in `supabase/migrations/20260626111524_global_season_reset.sql` and `supabase/migrations/20260629132603_fix_global_season_reset_safe_update.sql`, and referenced only by tests (`src/test/db/seasonReset.contract.test.ts`, `src/features/season-reset/*.test.ts`). They are not counted in the 67.

## Enums

Database enums (generated, `types.ts:2095–2103`):

- `app_role`: `admin`, `moderator`, `user`.
- `notification_type`: `mention_post`, `mention_comment`, `coupon_won`, `comment_post`, `money_transfer` (5 values).

TypeScript-only literal unions (not DB enums, `src/types/database.ts`):

- `RouletteBetType`: `straight`, `color`, `parity`, `range` (:13).
- `RouletteColor`: `red`, `black`, `green` (:15).
- `RouletteRoundPhase`: `waiting`, `spinning`, `settled` (:17).
- `ReactionEmoji`: `like`, `heart`, `laugh`, `wow`, `sad`, `angry`, `fire` (:204).
- `FeedItemType`: `post`, `coupon`, `casino` (:206).
- `NotificationType` (:208): the 5 DB values plus `jackpot_draw_ready`. `jackpot_draw_ready` is not in the DB enum.
- `Bet.bet_type` and `BetProposal.bet_type`: `1x2`, `12`, `multi`, `single` (:112, :153).
- `PlacedBet.result` and `CouponLeg.result`: `pending`, `won`, `lost`, `refund` (:131, :183).
- `CasinoHistoryEntry.status`: `pending`, `won`, `lost`, `push` (:87).
- `BetProposal.status`: `pending`, `accepted`, `rejected` (:158). `BetProposalSource`: `human`, `agent` (:106).

## rpc.ts helpers

`src/integrations/supabase/rpc.ts` (143 lines):

- `RpcContracts`: explicit map from RPC name to `{ args, returns }` for RPCs called through `callRpc`. Keys (16, of which 15 are absent from generated types; `create_casino_social_share` is generated):
  - Feed and posts: `get_social_feed`, `get_social_feed_item`, `create_social_post`, `create_casino_social_share`.
  - Stories: `get_active_social_stories` (no args), `create_social_story`.
  - Comments and reactions: `get_comments_for_target`, `add_social_comment`, `toggle_reaction`, `get_reactors_for_target`.
  - Mentions: `search_mention_users`.
  - Bot admin: `admin_get_social_bot_runs`.
  - Notifications: `get_user_notifications`, `get_unread_notifications_count`, `mark_notification_read`, `mark_all_notifications_read`.
- `RpcName = keyof RpcContracts`.
- `callRpc<N extends RpcName>(name, args): Promise<RpcContracts[N]['returns']>`. Calls `supabase.rpc` bound as `rawRpc`. Calls with no args when `args === undefined`. Throws `new Error(error.message)` on error.

## Storage buckets

Two public buckets, created in migrations with RLS policies on `storage.objects`.

- `profile-avatars`
  - Created: `supabase/migrations/20260317190000_profile_avatar.sql:6` (`INSERT INTO storage.buckets`), id at `:14–15`. Policies at `:27` (public read), `:32` (upload own), `:41` (delete own); each uses `bucket_id = 'profile-avatars'`.
  - Updated: `supabase/migrations/20260317194500_comment_avatars_and_limits.sql:60`.
  - Upload: `src/pages/ProfilePage.tsx:194–216`. Path `${user.id}/${Date.now()}-…jpg` at `:194`, `.upload(path, compressed.blob, {` at `:198`, `contentType: 'image/jpeg'` at `:199`, `cacheControl: '31536000'` at `:200`, `upsert: false` at `:201`. Public URL at `:210`, then `profiles.update({ avatar_url })` at `:215–216`.
- `social-images`
  - Constant: `src/features/social/images.ts:3` (`SOCIAL_IMAGES_BUCKET`).
  - Created: `supabase/migrations/20260317150000_social_pasted_images.sql:164` (insert), id at `:172–173`. Policies at `:185` (public read), `:190` (upload own), `:199` (delete own); each uses `bucket_id = 'social-images'` (`:187`, `:194`, `:203`).
  - Updated: `supabase/migrations/20260317194500_comment_avatars_and_limits.sql:56`.
  - Upload: `src/features/social/images.ts:159–175` (`uploadSocialImage`). Path `${userId}/${Date.now()}-….jpg` at `:160`, `.upload` at `:164`, `contentType: 'image/jpeg'` at `:165`, `upsert: false` at `:166`, `cacheControl: '31536000'` at `:167`, public URL at `:175`.

## Edge functions

Invoked from src with `supabase.functions.invoke` (3 call sites, all in `src/features/social/api/eniuBot.ts`):

- `respond-as-eniu` (`eniuBot.ts:40`, `:52`). Body `{ sourceType, sourceId }`, or `{ sourceType, sourceId, retry: true }`. Source: `supabase/functions/respond-as-eniu/index.ts`.
- `command-eniu` (`eniuBot.ts:61`). Body `{ command, preview }`. Source: `supabase/functions/command-eniu/index.ts`.

Not invoked from src:

- `bsplic-agent-mcp`: `supabase/functions/bsplic-agent-mcp/index.ts`, `validation.ts`. Presumed external agent endpoint; its caller contract is not documented here.
- `_shared/`: `eniu.ts`, `eniuPersona.ts`, `eniuRetryAuthorization.ts`, `eniuTextGuard.ts`, `openCodeGoRequest.ts`, `openCodeGoResponse.ts`.

## Realtime channels

Five `postgres_changes` channels. Each is opened in a hook or effect and removed with `supabase.removeChannel` on cleanup.

| Channel name | Subscribed in | Table, event | Filter | Cleanup |
|---|---|---|---|---|
| `casino-roulette-rounds-${tableKey}` | `src/features/casino/api/roulette.ts:245–260` | `casino_roulette_rounds`, `*` (`:251`) | `table_key=eq.${tableKey}` (`:252`; default `main`, `:23`) | `removeChannel` at `:260` |
| `notifications-${userId}` | `src/features/notifications/components/NotificationsBell.tsx:142–168` | `user_notifications`, `*` (`:146–148`) | `user_id=eq.${userId}` (`:149`) | `removeChannel` at `:168` |
| `social-feed-realtime` | `src/features/social/hooks/useSocialRealtimeFeed.ts:179–190` | `social_realtime_events`, INSERT | none | `removeChannel` at `:196` |
| `bets-realtime` | `src/features/home/api/bets.ts:69–76` | `bets`, `*` | none | `removeChannel` at `:79` |
| `categories-changes` | `src/features/home/api/categories.ts:15–18` | `categories`, `*` | none | `removeChannel` at `:21` |

Notes:
- The `notifications-*` INSERT event plays a sound unless the sound is muted (`soundMutedRef` at `NotificationsBell.tsx:152`; mute preference is `notifications_sound_muted`).
- The social realtime payload carries `target_type` (`post`, `coupon`, `casino`), `target_id`, `source_table`, and `operation`. The feed refreshes on these rows.

## Local storage keys

Supabase session is stored in `localStorage` through `auth.storage` in `client.ts`. Key name is Supabase's default and was not re-verified here.

Application keys (14 literal or templated keys):

| Key | Owner (file:line) | Purpose |
|---|---|---|
| `bsplic.theme` | `src/contexts/ThemeContext.tsx:12` | Theme choice. `readStoredTheme` (`:21–29`) reads only this key |
| `bsplic.darkPalette` | `src/contexts/ThemeContext.tsx:13` | Legacy palette. Removed by `localStorage.removeItem` on every theme write (`:53`) |
| `bsplic.home.category` | `src/features/home/components/AuthenticatedHome.tsx:8` | Selected category |
| `bsplic.home.sort` | `src/components/BetList.tsx:51` | Sort mode |
| `bsplic.home.activeOnly` | `src/components/BetList.tsx:52` | Active-only filter |
| `bsplic.coupon.items.v1` | `src/contexts/CouponContext.tsx:5` | Coupon items |
| `bsplic.coupon.last-stake` | `src/components/CouponDrawer.tsx:22` | Last coupon stake |
| `bsplic.auth.last-email` | `src/components/LoginPage.tsx:8` | Last login email |
| `bsplic.blackjack.lastStake` | `src/features/casino/components/games/BlackjackGame.tsx:19` | Last blackjack stake |
| `bsplic.blackjack.muted` | `src/features/casino/lib/blackjackSfx.ts:5` | Blackjack sound mute |
| `bsplic.casino.sound` | `src/features/casino/lib/casinoAudio.ts:1` | Casino sound setting |
| `bsplic_roulette_bet_type_v1` | `src/features/casino/lib/preferences.ts:3` | Last roulette bet type |
| `notifications_sound_muted` | `src/features/notifications/sound.ts:1` | Notification sound mute (unprefixed) |
| `bsplic:slot-pending:v1:${userId}:${game}` | `src/features/slots/useSlotGame.ts:16–17` | Pending slot spin request for idempotent retry (`get`, `set`, `remove` at `:19`, `:80`, `:92`, `:102`) |

Window event, not a storage key: `bsplic:pwa-update-available` (`src/lib/pwa-update.ts:1`).

## Open questions

1. Social tables (`social_posts`, `social_comments`, `social_reactions`, stories, `user_notifications`, `social_realtime_events`) are absent from `types.ts`. Their contract exists only in `rpc.ts` and feature modules. The stories table name is unconfirmed.
2. `jackpot_draw_ready` is in TS `NotificationType` but not in DB `notification_type`. If the app writes or filters on it, inserts would fail.
3. Overlapping feed RPCs: `get_social_feed` (called) vs `get_social_coupon_feed` (generated, not called).
4. `casino_rounds` has no src reference. `casino_slot_*` tables have no direct `.from()`. Confirm whether these are live or legacy. The slot RPCs are live.
5. The 11 `agent_*` RPCs and `bsplic-agent-mcp` are not called from src. `AgentRunsTab` reads `agent_runs` directly. Confirm they are only used by the external bot, and document its auth (`p_token` referenced in types).
6. 22 generated RPCs show no non-test src reference (listed above), including `has_role`, `award_badge`, `admin_credit_balance`, and the jackpot finalize functions. Confirm whether an external caller uses them.
7. `get_user_rankings` and `get_casino_rankings` are called via ternary (`rankings/queries.ts:34–37`). Their return shape against `normalizeRankingRows` is unverified.
8. Direct `profiles` reads of other users (`ProposalsTab.tsx:114`, `ProfilePage.tsx:79`) depend on RLS. The convention prefers SECURITY DEFINER RPCs for public profiles. Confirm the policy.
9. Storage key naming is inconsistent: dotted `bsplic.x.y`, underscored `bsplic_roulette_bet_type_v1`, colon `bsplic:slot-pending:v1:…`, unprefixed `notifications_sound_muted`. Keep names unchanged for compatibility with existing user state, or migrate deliberately.
10. Hand-written types in `database.ts` (for example `Profile`, `Bet`, `SocialFeedItem`) can diverge from generated `Row` types. Decide which source the Expo app uses.
11. `bets-realtime` and `categories-changes` subscribe with no filter, so every subscriber receives all rows that RLS allows. Confirm this is intended for production volume.
