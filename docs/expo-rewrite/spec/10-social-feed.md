# 10. Social feed (/social and /social/:itemType/:itemId)

Scope: the web feed page, the single-item page, the feed card and its engagement UI, and the data layer behind them. Rebuild target: Expo, rendered at 390px width. Tailwind breakpoints are the defaults (only `2xl` is overridden in `tailwind.config.ts:12`), so `sm:` = 640px and `lg:` = 1024px. Every `sm:`/`lg:` class is inactive at 390px. Desktop changes are listed as one line each in the desktop notes.

Copy is exact Polish. Semantic color tokens (`bg-card`, `text-muted-foreground`, `text-primary`, `text-success`, `text-destructive`, `border-border`, `bg-muted`) come from `src/index.css`; their HSL values were not re-read for this spec.

---

## 1. Files covered

| Path | Lines | Role |
|---|---|---|
| `src/pages/SocialPage.tsx` | 739 | Feed page: state, paging, filter, deep-link, realtime mount, JSX |
| `src/pages/SocialItemPage.tsx` | 211 | `/social/:itemType/:itemId` single-item page |
| `src/features/social/components/SocialFeedCard.tsx` | 624 | Card: header, body variants, engagement |
| `src/features/social/components/SocialContentBlock.tsx` | 190 | Text, mentions, links, image, YouTube/Spotify embeds |
| `src/features/social/components/ReactionBar.tsx` | 225 | Reaction action button, long-press picker |
| `src/features/social/components/ReactionSummaryButton.tsx` | 48 | Emoji stack and total |
| `src/features/social/components/ReactorsDialog.tsx` | 134 | Who-reacted dialog |
| `src/features/social/components/SocialImagePreview.tsx` | 33 | Composer image preview (composer only; mount only here) |
| `src/features/social/hooks/useFeedInteractions.ts` | 260 | Copy coupon, add comment, toggle reaction, open reactors |
| `src/features/social/hooks/useSocialRealtimeFeed.ts` | 199 | Realtime refresh and coalescing (feed page only) |
| `src/features/social/api/social.ts` | 142 | RPC wrappers for feed, item, post, story, comments, reactions |
| `src/features/social/api/reactions.ts` | 27 | `get_reactors_for_target` wrapper |
| `src/features/social/api/eniuBot.ts` | (not counted) | `respond-as-eniu` edge function wrapper |
| `src/features/social/api/socialQueries.ts` | 23 | React Query factories for feed and stories |
| `src/features/social/reactions.ts` | 62 | Reaction types, emoji, labels, totals, sorting |
| `src/features/social/lib/feedReactions.ts` | 28 | Local reaction count update |
| `src/features/social/lib/socialFormatters.ts` | 42 | Polish plural, comment and event counts, relative time |
| `src/features/social/lib/eniuTrigger.ts` | 31 | Fire-and-forget Eniu bot reply after @eniu mention |
| `src/features/social/content.ts` | 38 | Image marker parse and build |
| `src/features/social/copyCoupon.ts` | 76 | Build copyable coupon items from a social coupon |
| `src/features/social/routes.ts` | 21 | Item type guard, item path, comment target |
| `src/features/social/polishDay.ts` | 29 | Europe/Warsaw day string (not used by the feed) |
| `src/features/social/eniuBot.ts` | 5 | `@eniu` mention regex |
| `src/features/social/images.ts` | 177 | Web image compression, upload, public URL |
| `src/lib/scroll-chrome.ts` | (shared) | Scroll-driven chrome hide/show state machine |
| `src/lib/query-client.ts` | (shared) | `PAGE_DATA_QUERY_OPTIONS` (lines 22-25) |
| `src/lib/boot/route-modules.ts` | (shared) | Route chunk loaders for both pages (lines 10, 11, 29, 35) |
| `src/lib/boot/preload.ts` | (shared) | Feed and stories prefetch after boot (lines 14-16, 94-95) |
| `src/App.tsx` | (shared) | Routes at lines 161-164 |
| `src/types/database.ts` | (shared) | `SocialFeedItem`, `CouponLeg` (176-185), `SocialComment`, `SocialStory`, `FeedItemType` |
| `src/index.css` | (shared) | Chrome CSS 973-1030, related 1355-1365, `.press-scale` 670-675 and 1573-1575 |
| `src/features/notifications/format.ts` | (shared) | Imports `getSocialItemPath` (lines 2, 48) |
| `src/features/home/api/bets.ts` | 64 (read 52-64) | `fetchBetsByIds` |
| `supabase/migrations/20260626111524_global_season_reset.sql` | (shared) | `get_social_feed` (line 1105), `get_social_feed_item` (line 1256) |
| `supabase/migrations/20260527020753_enable_social_notifications_realtime.sql` | (shared) | `social_realtime_events` table, RLS, publication |
| `supabase/migrations/20260610231207_supabase_disk_io_optimization.sql` | (shared) | 2-day retention for realtime events (line 455) |

Mount only (specified in their own files, not here): `src/features/social/components/SocialStories.tsx` (654), `src/features/social/components/CommentThread.tsx` (482), `src/features/social/components/PostComposer.tsx` (428), `src/features/social/components/MentionSuggestions.tsx` (44), `src/features/social/hooks/useMentionAutocomplete.ts` (67).

---

## 2. Surfaces

### 2.0 Page order and mobile shell (SocialPage, 390px)

Render order from `SocialPage.tsx` JSX: `Navbar` (530), scroll container (532), feed content (551), h1 (554), filter bar (559), composer (620, mount), stories (630, mount), loading or list (640 or 663), filtered-empty note (699), sentinel (705), load-more row (714), back-to-top (724), `ReactorsDialog` (736).

- Page shell: `social-mobile-page h-safe-screen bg-background overflow-hidden flex flex-col`.
- Navbar: `<Navbar mobileBottomNavHidden={mobileChromeHidden} />`. The bottom nav hides while the chrome is hidden (see 2.2).
- Scroll container: `data-testid="social-scroll-container"`, `flex-1 min-h-0 overflow-y-auto pb-[var(--mobile-bottom-nav-scroll-padding)] lg:pb-0`. Its `onScroll` drives `mobileChromeHidden`, the filter bar's `data-hidden`, the Navbar, and `showBackToTop` (true when `scrollTop > 600`).
- Feed content: `data-testid="social-feed-content"`, `social-facebook-feed w-full max-w-3xl mx-auto px-0 pt-0 pb-3 sm:px-4 sm:py-4`. At 390px there is zero horizontal padding, so cards run edge to edge.
- Heading: `<h1>` "Social", `sr-only sm:not-sr-only sm:text-2xl sm:font-bold sm:mb-4`. Visually hidden on mobile.

Desktop notes:
- sm: heading becomes visible, 24px bold, 16px bottom margin.
- sm: feed content gets 16px horizontal and vertical padding.

### 2.1 Filter bar

- Element: `data-testid="social-filter-bar"`, `data-hidden={mobileChromeHidden}`.
- Classes: `app-subsurface social-edge-filter sticky top-0 z-20 mb-0 grid w-full grid-cols-4 items-center gap-1 overflow-hidden rounded-none border-0 bg-card px-2 py-1`.
- Mobile chrome CSS (`src/index.css:973-1030`, scoped to `.social-mobile-page`):
  - Background `hsl(var(--card))` with `!important`, no border, no shadow, no backdrop blur.
  - Hidden state (`data-hidden="true"`): `transform: translateY(calc(-100% - 0.25rem))`, `opacity: 0`, `pointer-events: none`.
  - Transition: transform 180ms ease, opacity 160ms ease. `will-change: transform`.
  - No visible scrollbar.
- Buttons: `social-filter-button min-w-0 px-2 py-1.5 text-xs font-semibold rounded-md transition-colors sm:shrink-0 sm:px-3`. Mobile CSS overrides: min-height 2.45rem (about 39px), font-size 0.86rem, weight 800, border-radius 0.65rem, padding-inline 0.25rem, `white-space: nowrap`, transparent background.
  - Inactive: `text-muted-foreground hover:text-foreground hover:bg-primary/10`. Mobile hover: `hsl(var(--muted) / 0.72)` background.
  - Active (`data-active="true"`): `bg-primary text-primary-foreground` in the base class. On mobile the active state is transparent background with `text-primary`, plus a 2.88px underline bar: absolute, `left` and `right` 0.35rem, `bottom` 0.15rem, primary color, full radius.
- Labels, in order: `Wszystko` (all), `Kupony` (coupon), `Posty` (post), `Kasyno` (casino).
- Type: `FeedFilter = 'all' | 'coupon' | 'post' | 'casino'`.
- Columns: 4 equal columns at 390px, so each label gets about 85px.

Interaction:
- Tap a label to set the filter. Filtering is client-side only (2.6). The active filter is stored in the URL `?filter=` param (see Data contract).
- The filter bar hides on downward scroll (see 2.12) with the CSS transform above, so it moves up off-screen while still sticky in the layout.

Desktop notes:
- sm: bar becomes `static inline-flex w-auto overflow-x-auto rounded-lg border p-1 mb-4`, not full width.
- sm: buttons are `shrink-0 px-3`. Desktop chrome CSS at `index.css:1361` applies a `background/0.96` tint with `blur(12px)`.

### 2.2 Scroll chrome (mobile)

Driven by `getNextScrollChromeState` in `src/lib/scroll-chrome.ts`. Constants:

| Constant | Value | Effect |
|---|---|---|
| TOP_RESET_PX | 32 | At or above 32px scrollTop, chrome is always shown and travel resets |
| NOISE_PX | 3 | Moves of 3px or less are ignored |
| HIDE_TRAVEL_PX | 56 | Downward travel of 56px hides the chrome |
| SHOW_TRAVEL_PX | 44 | Upward travel of 44px shows the chrome, unless near the bottom |
| BOTTOM_LOCK_PX | 72 | Within 72px of the bottom, downward movement never hides the chrome |

The state machine runs on every scroll event. The filter bar and Navbar both follow `hidden`. It is not persisted.

Motion: the same CSS transitions as 2.1. No framer-motion in the covered files.

### 2.3 Composer and stories (mounts only)

- Composer wrapper (line 620): `mb-0 sm:mb-4`, rendered only when `user` is set. `PostComposer` receives `onSubmit={handleCreatePost}`, `currentUserId`, `currentUsername={profile?.username ?? undefined}`, `currentUserAvatarUrl={profile?.avatar_url}`.
- Stories (line 630): rendered only when `user` is set. Props: `stories`, `profileFallbacks={socialStoryProfiles}` (up to 8 unique users), `currentUsername={profile?.username ?? 'Ty'}`, `currentAvatarUrl={profile?.avatar_url ?? null}`, `onCreateStory`.
- `SocialImagePreview` (composer only): text `Zdjęcie po kompresji: {imageKb} KB` with `ImagePlus` h-3.5 w-3.5; remove button `aria-label="Usuń zdjęcie"` with `X` h-4 w-4; img alt `Podgląd wklejonego zdjęcia`, `max-h-44 rounded-md object-cover border`; container `mt-2 rounded-lg border bg-muted/30 p-2`.
- Success toasts from the page handlers: `Post opublikowany` (create post) and `Relacja opublikowana` (create story).

### 2.4 Loading state

- While `loading` (only on a non-quiet first load or when there is no cached feed): `<SectionLoader label="Wczytywanie aktywności..." />` replaces the list (line 640).
- `SectionLoader` holds the boot splash automatically (boot rule in AGENTS.md). Do not add a second full-page loader.
- On a cache hit (see Data contract), no loader shows. The cached list renders at once and refreshes in the background.

### 2.5 Empty states

Shown when `filteredFeedItems.length === 0 && !hasMore` (line ~643). Wrapper `text-center py-12 text-muted-foreground`.

- Title `<p className="text-lg font-medium">`. Description `<p className="text-sm mt-1">`.
- Unfiltered (`feedItems` empty): title `Brak aktywności`, description `Nikt jeszcze nic nie opublikował.`.
- Filtered-empty (`isFilteredEmpty = feedFilter !== 'all' && feedItems.length > 0 && filteredFeedItems.length === 0`):
  - Title by filter: coupon `Brak kuponów w tej chwili`, post `Brak postów w tej chwili`, casino `Brak aktywności kasyna w tej chwili`.
  - Description `Zmień filtr, aby zobaczyć pozostałe wpisy.`.
  - Button `Pokaż wszystko`: `mt-4 rounded-full border border-border px-4 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted`. Calls `setFeedFilter('all')`.
- Filtered-empty while `hasMore` is still true: no empty block. Shows `text-center py-6 text-xs text-muted-foreground` with `Szukamy kolejnych wpisów...` (line 699). The page keeps loading the next 50 items until the filter matches or paging ends.

Icons: none.

### 2.6 Feed list

- Wrapper: `space-y-2 sm:space-y-3`. At 390px, 8px gap between cards.
- Each item is a `SocialFeedCard` (2.7) with key `${item.item_type}-${item.id}`. Stable ids only, never array index.
- Props per card: `comments={commentsMap[item.id] ?? EMPTY_COMMENTS}`, `commentsLoaded`, `commentsLoading`, `isLoggedIn={!!user}`, `isAko={isAko(item)}`, `highlighted`, `onOpenItem` (navigates to `getSocialItemPath`), `onOpenItemReactors`, `onOpenCommentReactors`, `onFirstExpandComments`.
- `isAko(item)` = `item_type === 'coupon' && legs !== null && legs.length > 1`.

### 2.7 Load more

- Sentinel (line 705, when `hasMore`): `<div id="social-feed-sentinel" className="h-1" aria-hidden />`.
- Web uses an IntersectionObserver (see 2.12). Native target: `FlatList` `onEndReached`, trigger about 1200px before the end.
- Load-more row (line 714, when `loadingMore`): `flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground`. `Loader2` h-3.5 w-3.5 `animate-spin`, text `Ładowanie kolejnych wpisów...`.
- No pull-to-refresh exists in the covered files.

### 2.8 Back to top

- Shown when `showBackToTop` (scrollTop > 600).
- Button: `aria-label="Wróć na górę"`, `press-scale fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-xl transition-colors hover:bg-muted`.
- Icon `ArrowUp` h-5 w-5.
- Action: `scrollTo({ top: 0, behavior: 'smooth' })` on the scroll container.
- `.press-scale`: transition 150ms transform; `:active` scale 0.94 (`index.css:670-675`). Transition removed at `index.css:1573-1575` (media query not re-read).

### 2.9 SocialFeedCard: root and header (all types, 390px)

- Root: `app-surface social-edge-surface social-facebook-card rounded-none overflow-hidden transition-shadow sm:rounded-xl`, `data-testid="social-feed-card"`, id `social-item-{type}-{id}`.
- Highlighted: adds `ring-2 ring-primary/50 shadow-lg`.
- Hidden locally: `isHidden` state set by the mobile X button. Renders `null`. Not persisted, resets on remount.
- Header: `flex px-3 pt-3 pb-2` (mobile).
  - Profile link to `/profile/{user_id}`: `group flex min-w-0 items-center gap-2.5`.
  - Avatar: `h-10 w-10 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors overflow-hidden shrink-0 sm:h-7 sm:w-7`. Image alt `Avatar {username}`, `loading="lazy"`, on error falls back. Fallback initial: `text-sm font-bold text-primary sm:text-[11px]`.
  - Username: `block truncate text-[15px] font-semibold leading-tight group-hover:text-primary transition-colors sm:text-sm`.
  - Time row: `flex items-center gap-1 text-xs leading-tight text-muted-foreground sm:text-[11px]`. Text from `formatSocialTimeAgo(created_at)`. Mobile-only `·` separator and `Globe2` h-3 w-3 (both `sm:hidden`).
- Header right: `flex shrink-0 items-center gap-2`.
  - Copy coupon (coupon only): `aria-label="Skopiuj kupon"`, `social-copy-coupon-button inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-muted disabled:opacity-60 disabled:cursor-not-allowed transition-colors`. Icon `Copy` h-3 w-3, or `Loader2` h-3 w-3 `animate-spin` while copying. Label `Skopiuj kupon` shown only `hidden sm:inline`, so on mobile it is an icon-only button.
  - `MoreHorizontal` h-5 w-5, `aria-label="Więcej opcji"`, `social-post-icon-button sm:hidden`. No handler.
  - `X` h-5 w-5, `aria-label="Ukryj wpis"`, `social-post-icon-button sm:hidden`. Sets `isHidden`.
  - Both icon buttons and the copy button carry `data-prevent-card-navigation`.
- Share action sits in the mobile action row (2.12), not the header.

Desktop notes:
- sm: avatar 28px, username 14px, time row 11px and the `Globe2` and `·` hidden.
- sm: copy button shows its text label `Skopiuj kupon`. The `MoreHorizontal` and `X` icons are hidden.

### 2.10 Card body: post

- Shown only for `item_type === 'post'`.
- Wrapper: `px-3 pb-2 pt-1 sm:px-4`.
- Body: `SocialContentBlock` (2.14) with `imageAlt="Zdjęcie w poście"`.

### 2.11 Card body: coupon

Row (button): `social-coupon-content flex items-center justify-between px-3 py-2 w-full text-sm text-left sm:px-4`. Tapping toggles the legs only when `isAko`. Status values come from `deriveCouponStatus`, `getDisplayedCouponOdds`, and `getDisplayedCouponWin` (`@/features/coupons/display`, not re-read).

Left column:
- AKO (`isAko`): badge `AKO {legs.length}` (`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary`), then `kurs {odds.toFixed(2)}` (`font-medium text-xs text-muted-foreground`), then `ChevronUp` or `ChevronDown` h-3.5 w-3.5 `text-muted-foreground`, depending on the expanded state.
- Single: bold `truncate` line `bet_title || 'Zakład'`, then `{selected_option} • kurs {odds}` (`text-xs text-muted-foreground`).

Right column:
- Stake: bold `{stake.toFixed(2)} zł`.
- Status line (`text-xs font-medium`):
  - won: `text-success`, `+{win.toFixed(2)} zł`
  - lost: `text-destructive`, `Przegrana`
  - refund: `text-primary`, `Zwrot {win.toFixed(2)} zł`
  - pending: `text-muted-foreground`, `W toku`

AKO legs (expanded): `social-coupon-legs border-t border-border px-3 pb-3 pt-2 space-y-1.5 sm:px-4`. One row per leg, `flex items-center justify-between text-xs`:
- Left (`min-w-0 flex-1`): `bet_title || 'Zakład'` (`truncate font-medium`), then `{selected_option} • kurs {odds_at_time.toFixed(2)}` (`text-muted-foreground`).
- Right badge (`ml-2 shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded`):
  - won: `Wygrana`, `bg-success/10 text-success`
  - lost: `Przegrana`, `bg-destructive/10 text-destructive`
  - refund: `Zwrot`, `bg-primary/10 text-primary`
  - pending: `W toku`, `bg-muted-foreground/10 text-muted-foreground`

Coupon detail page (2.16): `expandedCoupons` is preset with the item id, so legs are always open. Toggle is a no-op.

### 2.12 Card body: casino (roulette share)

Row layout: `casino` block, row of badges, bet line, detail line on the left; stake and payout on the right.

Left:
- Badge `Ruletka` (`bg-primary/10 text-primary text-[10px] font-bold`) and `Runda #{casino_round_number}`.
- Bet line: `getRouletteBetTypeLabel(casino_bet_type ?? 'straight')` + `: ` + `formatRouletteBetValue(...)` (`@/features/casino/lib/roulette`, not re-read).
- Detail: `Numer: {N} • Stawka {X.XX} zł`, or `Wynik niedostępny • Stawka {X.XX} zł` when the winning number is missing.

Winning-number circle: `h-10 w-10 border-2 text-base font-black`, with:
- red: `text-red-400 border-red-500/30 bg-red-500/10`
- black: `text-stone-300 border-stone-500/30 bg-stone-500/10`
- green: `text-emerald-400 border-emerald-500/30 bg-emerald-500/10`
- no result: `h-10 min-w-10 px-2 border-border/70 bg-background text-[10px] font-semibold text-muted-foreground`, text `Brak`.

Right column:
- `<p className="font-bold">{(casino_stake ?? 0).toFixed(2)} zł</p>`
- `<p className="text-xs font-medium text-success">+{(casino_payout ?? 0).toFixed(2)} zł</p>`

Casino items are always `status 'won'` in SQL (see 5.4). Do not use `status` to color casino rows.

### 2.13 Engagement row (mobile, 390px)

- Wrapper: `social-card-engagement space-y-2 px-3 pb-3 pt-1 sm:px-4`, `data-prevent-card-navigation`.
- Summary row (`social-mobile-engagement-summary`, `sm:hidden`), shown when reactions total > 0 or comment count > 0:
  - Left: `ReactionSummaryButton` (2.15), or an empty span when there are no reactions.
  - Right: `social-mobile-comment-count` with `{commentCount} {formatCommentCount(commentCount)}`. Example: `1 komentarz`, `2 komentarze`, `5 komentarzy`.
- Action row (`data-testid="social-mobile-action-row"`, `social-mobile-action-row sm:hidden`):
  - `ReactionBar` (2.14) with `showSummary={false}`, `showActionIcon`, `className="social-mobile-reaction-control"`, `actionClassName="social-mobile-action-button"`.
  - `MessageCircle` h-4 w-4 + `Komentarz`: class `social-mobile-action-button`. Opens the comment thread (sets expand signal).
  - `Share2` + `Udostępnij`: share action (see 5.x share rule). Class `social-mobile-action-button`.
- Button classes `social-mobile-action-button`, `social-mobile-engagement`, `social-mobile-reaction-summary`, `social-mobile-reaction-stack`, and `social-mobile-engagement-summary` are defined in `index.css`. Their values were not re-read here.

Desktop notes:
- sm: summary row and action row are hidden. The desktop `ReactionBar` (`social-desktop-reaction-bar hidden sm:block`) renders instead, with the summary button.
- sm: `CommentThread` remains a mount below the engagement block.

### 2.14 ReactionBar and picker

Container: `social-reaction-bar flex items-center gap-1.5 flex-wrap`, `role="group"`, `aria-label="Reakcje"`. Children: optional summary (2.15), then the action wrapper.

Action wrapper: `social-reaction-action-wrap relative inline-flex`, with mouse enter (opens picker) and mouse leave (closes picker after 140ms).

Action button:
- Classes: `social-reaction-action-button inline-flex h-7 items-center justify-center gap-1.5 rounded-full px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-55`. Adds `text-primary` when `myReaction` is set.
- `aria-label` = `REACTION_LABELS[myReaction ?? 'like']`. `aria-pressed = myReaction !== null`. `aria-haspopup="menu"`. `aria-expanded = pickerOpen`.
- Content:
  - No reaction and `showIcon`: `ThumbsUp` h-4 w-4 (aria-hidden).
  - Reacted: emoji span (aria-hidden) in the button. The emoji shows even without `showIcon`.
  - Label span always shows the label text.
- Labels by state: no reaction `Lubię to`; reacted, label is `REACTION_LABELS[myReaction]`.

Gesture rules:
- Mouse pointer: pointer-down is ignored. Hover opens the picker at once. Leave closes it after 140ms (`PICKER_CLOSE_MS`).
- Touch or pen pointer: pointer-down starts a 500ms timer (`LONG_PRESS_MS`). When it fires, the picker opens and the next click is suppressed. Pointer up, cancel, or leave clears the timer.
- Click (not suppressed): `onToggle(myReaction ?? 'like')`. Tapping the button with no reaction gives Lubię to (`like`). Tapping with a reaction toggles that reaction off.
- Disabled (not logged in or pending): click, picker and long-press all do nothing.

Picker (when open):
- Container: `social-reaction-picker`, `role="menu"`, `aria-label="Wybierz reakcję"`. Mouse enter keeps it open, mouse leave closes after 140ms.
- Options: one button per type in `REACTION_TYPES` order (`like, heart, laugh, wow, sad, angry, fire`). Class `social-reaction-picker-option`, plus `is-selected` for the current reaction. `role="menuitem"`. `aria-label` = label, emoji is aria-hidden.
- Tap an option: suppress flag reset, picker closes, `onToggle(reaction)`.

Emoji and labels (`src/features/social/reactions.ts`):

| Type | Emoji | Label |
|---|---|---|
| like | 👍 | Lubię to |
| heart | ❤️ | Super |
| laugh | 😂 | Haha |
| wow | 😮 | Wow |
| sad | 😢 | Przykro mi |
| angry | 😡 | Wściekły |
| fire | 🔥 | Ogień |

Haptics: none in the covered files. Long-press has no vibration.

### 2.15 ReactionSummaryButton

- Hidden entirely when `totalReactions === 0`.
- Visible stack: up to 3 emojis from `sortedReactions` (count > 0, sorted by count descending), inside an aria-hidden stack (`stackClassName`).
- Then the total as a number.
- `aria-label` = `Wyświetl reakcje ({total})`.
- Disabled when `disabled` or when there is no `onOpenReactors`.
- Desktop class: `social-reaction-summary-button inline-flex items-center gap-1 rounded-full text-xs font-medium text-muted-foreground transition-colors hover:text-primary`.

### 2.16 ReactorsDialog

- Opened from the summary button (item reactions) or from a comment's summary (`handleOpenCommentReactors`).
- Shell: dialog content `w-[calc(100%-1rem)] max-w-md max-h-[calc(var(--app-viewport-height,100svh)-4rem)] overflow-hidden`. Title `Reakcje`.
- States:
  - Loading: `Ładowanie...`.
  - Empty: `Brak reakcji`.
  - Loaded: tabs, one per emoji type that has at least one reactor, each labelled `{emoji} {count}`. Active tab: `border-primary/40 bg-primary/10 text-primary`.
- Initial tab: `initialEmoji` if it has reactors; otherwise the first available type.
  - For items: first type in `REACTION_TYPES` order with count > 0 (not sorted by count).
  - For comments: taken from the comment's reaction counts.
- Reactor row: `@{username}` as a link to `/profile/{encodeURIComponent(username)}`. Classes `px-2 py-1.5 text-sm font-medium`, hover `bg-muted`. Tap closes the dialog.
- Data: `fetchReactors({ ...target })` with no emoji, so all reactors load once and tabs filter client-side.
- On fetch failure: the list is set to `[]` and the empty state shows. No toast.

Desktop notes:
- sm: the dialog is centered at `max-w-md`, not full width (already the default shell; the `w-[calc(100%-1rem)]` rule still applies).

### 2.17 Content block (text, links, mentions, image, embeds)

Text: `text-sm whitespace-pre-wrap break-words`.

Tokenizer regex (`SocialContentBlock.tsx`): `/(https?:\/\/[^\s]+)|@([A-Za-z0-9_.-]{2,32})/g`.
- URL token: `<a target="_blank" rel="noreferrer noopener" class="font-semibold text-primary hover:underline">`. The raw matched text is the link text.
- Mention token: `Link` to `/profile/{encodeURIComponent(username)}` with the same class.

Image: `getSocialImageUrl(imagePath)`, class `rounded-lg border border-border max-h-80 object-cover`, `loading="lazy"`. Tapping has no lightbox (none in covered files). Image path comes from the `[[img:...]]` marker (see 4.x content format).

YouTube embed (`getYouTubeEmbed`):
- Host `youtu.be`: video id is the first path segment.
- Host ends with `youtube.com`: id from `/watch?v=`, or the segment after `/shorts/`, `/live/`, or `/embed/`.
- Iframe `src = https://www.youtube-nocookie.com/embed/{encodeURIComponent(id)}`, `title="Osadzony film YouTube"`, class `w-full aspect-video rounded-lg border border-border`.

Spotify embed (`getSpotifyEmbed`):
- Host must be `open.spotify.com`. A leading `intl-*` path segment is stripped.
- Type must be one of `track | album | playlist | episode | show`.
- Iframe `src = https://open.spotify.com/embed/{type}/{encodeURIComponent(id)}`, `title="Osadzony odtwarzacz Spotify"`.
- Height: 152px for `track` and `episode` (class `h-[152px]`), otherwise 352px (`h-[352px]`). Class `w-full rounded-lg border border-border`.

Iframe attributes (both): `allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"`, `referrerPolicy="strict-origin-when-cross-origin"`, `loading="lazy"`, `allowFullScreen`.

Embeds are deduplicated by `src`.

### 2.18 SocialItemPage (`/social/:itemType/:itemId`)

- Route: `App.tsx:164`. Lazy chunk via `loadSocialItemPage`. Not in the boot preload.
- `usePageTitle('Social')`.
- Shell: `social-mobile-page h-safe-screen bg-background overflow-hidden flex flex-col`. Navbar has no `mobileBottomNavHidden`, so the bottom nav always shows.
- Content: `data-testid="social-item-content"`, `social-facebook-feed w-full max-w-3xl mx-auto px-0 pt-2 pb-[var(--mobile-bottom-nav-scroll-padding)] sm:px-4 sm:py-4`.
- Back link: `Link` to `/social`, `ChevronLeft` h-4 w-4 then `Social`. Classes `mb-3 inline-flex items-center gap-1 px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:mb-4 sm:px-0`.
- Loading: `Loader2` h-4 w-4 `animate-spin` with `Ładowanie wpisu...`. Classes `flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground`.
- Not found: card `mx-3 rounded-xl border border-border bg-card p-8 text-center sm:mx-0`. Title `Nie znaleziono wpisu` (`text-lg font-semibold`). Description `Ten wpis mógł zostać usunięty albo nie masz do niego dostępu.` (`mt-1 text-sm text-muted-foreground`).
- Card: a single `SocialFeedCard` with `expandedCoupons = {item.id}` for coupons (legs always open), `onToggleCoupon` no-op, and `defaultCommentsExpanded`. The comment thread (mount) is expanded.
- Data: `get_social_feed_item`, then `get_comments_for_target`. `comment_count` is set to `data.length` from the comments fetch.
- Errors: toast with the error message, or `Nie udało się załadować wpisu`.
- No realtime subscription.

Desktop notes:
- sm: content gets 16px horizontal and vertical padding; back link loses its `px-3` and `mb-3`.

### 2.19 Realtime (feed page only)

- Hook: `useSocialRealtimeFeed`, mounted only on `SocialPage`.
- Channel name `social-feed-realtime`. One `postgres_changes` subscription: event `INSERT`, schema `public`, table `social_realtime_events`.
- Coalescing: pending updates in a Map keyed `${itemType}:${itemId}`. Flushed on a 250ms timer. At most one in-flight read per key.
- Refresh rules:
  - If the item is loaded: refetch it (`refreshFeedItem`). A null result removes the item. Otherwise merge it in place.
  - If `source_table` is `social_posts`, `casino_social_shares`, or `coupons`: insert (`allowInsert`) so the new item is prepended to the feed.
  - If `source_table` is `social_comments` or `social_reactions` and that item's comments are loaded: reload its comments.
- Cleanup: `disposed` flag, `clearTimeout`, `pending.clear()`, `supabase.removeChannel(channel)`.
- Error logging: `console.error('Social realtime refresh failed:', reason)`.

No visible UI. There is no toast and no "new posts" banner in the covered files.

### 2.20 Deep links and highlight

- Route `/social/:itemType/:itemId` renders SocialItemPage (2.18), not the feed.
- A second path exists on SocialPage: reads `?itemType` and `?itemId`, valid types only (`post | coupon | casino`). It sets the filter to `all`, fetches the item, prepends it if missing, sets `highlightedItemKey`, and swallows errors silently. No writer for `?itemType`/`?itemId` was found in `src/` (see Open questions).
- Highlight effect: finds element `social-item-${key}`, calls `scrollIntoView({ behavior: 'smooth', block: 'center' })`, and clears the highlight after 3000ms.

### 2.21 Share action

- Mobile share button `Udostępnij` (2.13). Also reachable on desktop through the desktop action area (not re-read).
- URL: `${origin}${getSocialItemPath(type, id)}`, where `getSocialItemPath` is `/social/{encodeURIComponent(type)}/{encodeURIComponent(id)}`.
- Web: `navigator.share({ title: '{username} w Socialu', url })`. Errors are ignored. Fallback: `navigator.clipboard?.writeText(url)` inside try/catch, silent.
- No toast on success or failure.

### 2.22 Motion and haptics summary

- Animations in covered files: CSS transitions on the filter bar (transform 180ms, opacity 160ms), button colors, `.press-scale` (150ms, `:active` scale 0.94), share and copy spinners (`Loader2 animate-spin`), highlight ring (static, cleared after 3s).
- No framer-motion and no canvas-confetti in covered files.
- No infinite decorative animation. Spinners are functional. No perf-lite (`html.perf-lite`) hooks are needed for the covered surfaces.
- Haptics: none.

---

## 3. Data contract

### 3.1 RPCs (via `callRpc`, `src/features/social/api/social.ts`)

| Function | RPC | Params | Returns and notes |
|---|---|---|---|
| `fetchSocialFeed(limit, offset, userId)` | `get_social_feed` | `p_limit`, `p_offset`, `p_user_id` | `SocialFeedItem[]`, `data ?? []`. App always passes `limit = 50`. RPC default is 30. |
| `fetchSocialFeedItem(type, id, userId)` | `get_social_feed_item` | `p_item_type`, `p_item_id`, `p_user_id` | `SocialFeedItem \| null` |
| `createSocialPost` | `create_social_post` | `p_user_id`, `p_content` | Composer (mount). Called by `handleCreatePost`. |
| `fetchActiveSocialStories` | `get_active_social_stories` | none | `SocialStory[]`, `data ?? []` |
| `createSocialStory` | `create_social_story` | `p_user_id`, `p_content` | Stories (mount). |
| `createCasinoSocialShare` | `create_casino_social_share` | `p_user_id`, `p_roulette_bet_id`, `p_content`, `p_casino_bet_type`, `p_casino_bet_value`, `p_casino_stake`, `p_casino_payout`, `p_casino_round_number`, `p_casino_winning_number`, `p_casino_winning_color` | Not called by the covered feed files. Used by a roulette flow outside this spec. |
| `fetchComments(target)` | `get_comments_for_target` | `p_post_id`, `p_coupon_id`, `p_casino_share_id`, `p_user_id` | `SocialComment[]`, `data ?? []`. Used by comments (mount) and `SocialItemPage`. |
| `addComment` | `add_social_comment` | `p_user_id`, `p_content`, `p_post_id`, `p_coupon_id`, `p_casino_share_id`, `p_parent_id` | Returns the comment id used by the Eniu trigger. |
| `toggleReaction` | `toggle_reaction` | `p_user_id`, `p_emoji`, `p_post_id`, `p_coupon_id`, `p_casino_share_id`, `p_comment_id` | Returns the new emoji or `null`. |
| `fetchReactors` | `get_reactors_for_target` | `p_post_id`, `p_coupon_id`, `p_casino_share_id`, `p_comment_id`, `p_emoji` | `ReactorUser[]` = `{ user_id, username, emoji, created_at }`. Absent values are sent as `null`. Feed sends no `emoji`. |

Target mapping (`routes.ts`): post → `{ postId }`, coupon → `{ couponId }`, casino → `{ casinoShareId }`.

### 3.2 Direct table read

- `supabase.from("bets").select("*").in("id", ids)` via `fetchBetsByIds` (`src/features/home/api/bets.ts:52-64`). Empty input returns `[]`. Errors throw `Error(error.message)`.
- Used only by copy coupon (4.x).

### 3.3 Edge function

- `respondAsEniu(sourceType, sourceId)` invokes `supabase.functions.invoke('respond-as-eniu')` with body `{ sourceType, sourceId }`.
- `retryEniuResponse` adds `retry: true`.
- Called fire-and-forget after a comment or post that contains `@eniu`. On success or failure, comments reload.

### 3.4 Storage

- Bucket `social-images`.
- Upload path: `{userId}/{Date.now()}-{random6}.jpg`, `contentType: image/jpeg`, `upsert: false`, `cacheControl: '31536000'`.
- Public URL: `getPublicUrl(path)` (`getSocialImageUrl`).

### 3.5 Realtime

- Channel: `social-feed-realtime`.
- Subscription: `postgres_changes`, `event: INSERT`, `schema: public`, `table: social_realtime_events`.
- Row fields used: `target_type` (`post | coupon | casino`), `target_id`, `source_table`, `operation`.
- Table: `social_realtime_events`. RLS on, SELECT for `authenticated`, in the `supabase_realtime` publication. Rows older than 2 days are deleted (`delete_old_social_realtime_events`).

### 3.6 React Query

| Key | Factory | Fetch | Options |
|---|---|---|---|
| `['social', 'feed', userId ?? null]` | `socialFeedQuery(userId)` | `fetchSocialFeed(50, 0, userId)` | `PAGE_DATA_QUERY_OPTIONS` |
| `['social', 'stories']` | `socialStoriesQuery()` | `fetchActiveSocialStories()` | `PAGE_DATA_QUERY_OPTIONS` |

- `PAGE_DATA_QUERY_OPTIONS` (`src/lib/query-client.ts:22-25`): `{ gcTime: 60 * 60_000, refetchOnMount: "always" }`. Cached data shows instantly, refreshed in the background.
- Feed page read: `getQueryData(feed key)` seeds initial state.
- Feed page refresh: `fetchQuery({ ...feedQuery, staleTime: 0 })`.
- Write-back: `setQueryData(feed key, feedItems.slice(0, 50))` whenever `feedItems` changes and `loading` is false.
- Stories: seeded from `getQueryData`, refreshed with `fetchQuery({ ...storiesQuery, staleTime: 0 })`.
- Boot preload (`src/lib/boot/preload.ts:94-95`): `prefetchQuery(socialFeedQuery(userId))` and `prefetchQuery(socialStoriesQuery())`. Logged-out users get no preload.
- Comments, reactors, and item page data are local state. No React Query keys.

### 3.7 localStorage

- None in the covered files.

### 3.8 URL state

- Filter: `?filter=coupon|post|casino`. `all` deletes the param. Written with `setSearchParams(..., { replace: true })`. Unknown values parse as `all`.
- Deep-link params: `?itemType`, `?itemId` (see 2.20).

---

## 4. Business rules

### 4.1 Ordering

- Server order: `ORDER BY created_at DESC`, `LIMIT GREATEST(p_limit, 1)`, `OFFSET GREATEST(p_offset, 0)`. No `id` tiebreaker.
- Client does not re-sort. New items from realtime are prepended. Deep-link items missing from the list are prepended.

### 4.2 Feed contents and season filter (SQL, `get_social_feed`)

- Union of posts, coupons, and casino shares.
- Coupons and casino items: `created_at >= private.get_active_season_started_at()`.
- Posts: no season filter. Old posts stay in the feed after a season reset. This asymmetry is intentional-looking but not commented in the SQL.
- Casino items: `status` hardcoded to `'won'` in SQL.
- Coupon legs: `json_agg` of `{ id, bet_id, selected_option, odds_at_time, result, bet_title }`, ordered by `pb.created_at`.
- Reactions: `json_object_agg` of emoji counts. `comment_count` is a count. `my_reaction` is for `p_user_id`.

### 4.3 Paging

- Page size: `SOCIAL_FEED_PAGE_SIZE = 50` (`socialQueries.ts:8`).
- `hasMore` on load: `!cachedFeed || cachedFeed.length === 50`. After a fetch: `data.length === 50`.
- `offset` after load: `data.length`. After each more-load: `prev + data.length`.
- Load more is blocked while `loading`, `loadingMore`, or `!hasMore`.
- Load more appends with no dedupe.

### 4.4 Filter

- Client filter over `feedItems` by `item_type`. No server filter.
- Parser: `coupon | post | casino` valid, anything else `all`.
- Deep-link effect forces `all`.

### 4.5 Reactions

- Not optimistic. The button awaits `toggleReaction`, then applies the server result:
  - `updateReactionCounts(item.reactions, item.my_reaction, next)`:
    - decrements the previous reaction (floored at 0),
    - increments the next reaction,
    - drops zero-count keys,
    - returns `null` when empty.
  - `my_reaction = next` (server returned emoji or `null`).
- Tap with no reaction: sends `like`. Tap with a reaction: sends that reaction. Server returns `null` on untoggle.
- Picker: choosing a type sends that type. Choosing the current reaction sends it again.
- Same pattern for comments through `updateComment`.
- Reactions require a logged-in user. Logged-out: buttons disabled.

### 4.6 Comments on the feed

- `commentsMap`, `commentsLoadedMap`, `commentsLoadingMap` keyed by item id.
- First expand of a card's thread loads comments only if not loaded and not loading.
- Add comment: upload image if any, `buildSocialContent`, `addComment`, then Eniu trigger if `@eniu` is mentioned, then `comment_count + 1`, then reload comments.
- A non-quiet `loadFeed` clears all three comment maps.

### 4.7 Copy coupon

Button shown on coupon cards only. Flow in `handleCopyCoupon`:
1. Collect unique non-empty `bet_id` values from legs. If none: `Ten kupon nie zawiera zdarzeń możliwych do skopiowania`.
2. `fetchBetsByIds(betIds)`.
3. `buildCouponItemsFromSocial({ legs, bets })` returns `{ items, skippedCount }`. Skipped legs:
   - result is not `pending`,
   - no `bet_id`,
   - bet missing,
   - duplicate bet,
   - bet not open (`is_active`, `winning_option` is null, `ends_at > now`),
   - option missing,
   - `odds <= 0`.
4. Zero items: `Wszystkie zdarzenia z tego kuponu są już niedostępne lub rozliczone`.
5. Add items to the slip, set preferred type to `ako` when more than 1 item, else `single`.
6. Toast:
   - with skips: `Skopiowano {formatEventsCount(items)}, pominięto {formatEventsCount(skipped)}`,
   - without: `Skopiowano kupon: {formatEventsCount(items)}`.
7. `navigate('/')`.
8. Error: toast `error.message` or `Nie udało się skopiować kuponu`.
9. `copying` flag cleared in `finally`.

### 4.8 Polish plurals and counts

`polishPlural(count, { one, few, many })`:
- `count === 1` → one.
- `count % 100` in 12..14 → many.
- `count % 10` in 2..4 → few.
- Otherwise → many. Zero is `many`.

Forms:
- Comments: `komentarz` / `komentarze` / `komentarzy`.
- Events: `zdarzenie` / `zdarzenia` / `zdarzeń`. Formatted as `{count} {form}`.

### 4.9 Relative time

`formatSocialTimeAgo(dateStr)`, computed at render, no ticker:
- under 1 min → `przed chwilą`
- under 60 min → `{m} min temu`
- under 24 h → `{h} godz. temu`
- under 7 days → `{d} dn. temu`
- otherwise → `new Date(dateStr).toLocaleDateString('pl-PL')`

### 4.10 Money and odds formatting

- Money: `toFixed(2)` plus ` zł`, with a dot decimal separator (for example `12.50 zł`). Not locale formatted.
- Odds: `toFixed(2)` (for example `kurs 2.35`).
- Win and refund values come from `getDisplayedCouponWin` (external).

### 4.11 Content format

Stored content: text, optionally followed by `\n[[img:{path}]]` (regex `/(?:\n)?\[\[img:([^\]\n]+)\]\]\s*$/`).
- Parse: text is the content before the marker, trimmed at the end. `imagePath` is the marker path.
- Build: text is trimmed. With an image and empty text: `[[img:{path}]]`. With an image and text: `{text}\n[[img:{path}]]`. Without an image: trimmed text.

### 4.12 Eniu mention

- Pattern: `/(^|[^\p{L}\p{N}_-])@eniu(?=$|[^\p{L}\p{N}_-])/iu`. Case-insensitive, Unicode-aware, requires a non-word boundary before and after.
- Triggered by posts and comments containing it. Fire-and-forget. Result is logged to console on failure. Comments reload after the call settles.

### 4.13 Card navigation

- Tap on the card body navigates to the item page (`onOpenItem`), unless the event target is inside an element matching `a, button, input, textarea, select, label, [role="button"], [data-prevent-card-navigation]`.

### 4.14 Visibility of actions

- Copy coupon: coupon items only.
- Composer and stories: only when logged in.
- Reactions and comment actions: disabled when logged out.
- X (hide) and `...` (more): mobile only (`sm:hidden`). `...` has no action.

---

## 5. Edge cases and gotchas

1. **Offset paging and duplicates.** `loadMoreFeed` appends with no dedupe, and the server sorts by `created_at DESC` with no tiebreaker. A new insert between two pages shifts the offset, so an item can appear twice, and two items with the same `created_at` can swap order between pages. Native should dedupe by `${item_type}-${id}` when appending, or move to a keyset cursor `(created_at, id)` (needs a new migration).
2. **Realtime prepends above the viewport.** An insert from `social_posts`, `casino_social_shares`, or `coupons` is prepended even while the user is scrolled down. Native needs scroll anchoring or a "new items" affordance. Not specified on web.
3. **Errors without catch.** `loadFeed` and `loadMoreFeed` have no `catch`. A failed first load with an empty cache shows the empty state (`Brak aktywności`), not an error. A failed load-more leaves `loadingMore` reset by `finally` and shows nothing.
4. **Posts vs coupons/casino season filter.** Posts ignore the season start, so old posts remain in the feed after a season reset while coupons and casino items disappear.
5. **Casino status is hardcoded.** SQL returns `status 'won'` for all casino items. Do not derive a casino status from the data.
6. **Default limit mismatch.** RPC default `p_limit` is 30. The app passes 50. Keep 50 in the native client.
7. **Cache write-back truncates.** Only `feedItems.slice(0, 50)` is written to the cache, so the cache never holds more than one page.
8. **Non-quiet reload clears comments.** A non-quiet `loadFeed` clears all comment maps, so open threads reload.
9. **Relative time is static.** `formatSocialTimeAgo` runs at render only. Labels do not tick while the screen is open. Native can match this or add a timer; note the difference.
10. **Image compression is web-only.** `images.ts` uses canvas: `maxDimension 1280`, `targetBytes 85 * 1024`, `absoluteMaxBytes 90 * 1024`, `minDimension 320`, `maxAttempts 5`, qualities `[0.8, 0.72, 0.64, 0.56, 0.48]`, `scale 0.82` per attempt. Error: `Zdjęcie jest zbyt duże po kompresji. Spróbuj inne zdjęcie.` Native needs an equivalent pipeline (see Open questions).
11. **No localStorage keys** in the covered files.
12. **No haptics and no framer-motion** in covered files.
13. **Deep-link effect swallows errors silently** (catch is a no-op).
14. **Share fallback swallows errors silently.** No toast on failure or success.
15. **Card tap ignores interactive children** via the `closest` selector. Native must stop propagation from reaction, copy, and link controls.
16. **`initialEmoji` ordering.** Reactors dialog picks the first type in `REACTION_TYPES` order with count > 0, not the most common type.
17. **Reactors dialog failure is silent.** Errors reset the list to `[]`, then show `Brak reakcji`. No toast.
18. **Mount-only surfaces.** Composer, stories and comment thread are mounts here. Their internals (validation, mention autocomplete, image input) are specified elsewhere.
19. **Empty filtered view with more pages.** Shows `Szukamy kolejnych wpisów...` and keeps paging. On a slow connection this looks like a stalled spinner.
20. **Back-to-top threshold** is 600px of scroll, a fixed value, not a fraction of the list.
21. **Filter bar is `sticky` while hidden.** It stays in layout (transform only). Native header offset must include the bar height.
22. **Copy coupon navigates home.** On success `navigate('/')` runs, so the user leaves the feed.
23. **Decimal separator.** Money uses `.`; Polish users may expect `,`. Keep the web behavior for 1:1 parity unless the orchestrator decides otherwise.
24. **`@` mention regex** (`[A-Za-z0-9_.-]{2,32}`) excludes Polish letters, so mentions of such usernames do not link.
25. **URL regex** `https?:\/\/[^\s]+` includes trailing punctuation in the link text and href.
26. **Embed host checks.** Only `youtube.com` subdomains and `youtu.be` for YouTube; only `open.spotify.com` for Spotify. Other hosts render as plain links.
27. **Realtime rows expire** after 2 days. A feed that stays open longer than that does not get realtime updates for old events. Not a correctness issue for live items.

---

## 6. Open questions

1. **Dead deep-link code?** `SocialPage.tsx` reads `?itemType` and `?itemId` (lines ~304-342), but no writer for those params was found in `src/`. Confirm whether to port it or drop it.
2. **Share base URL.** Web uses `window.location.origin`. Native needs the canonical public host (the production domain is in the deployment notes). Which URL should share links use?
3. **Paging strategy.** Port the offset paging with dedupe (1:1 parity), or move to a keyset cursor on `(created_at, id)` in a new migration to fix duplicates?
4. **Realtime insert behavior.** Prepend while scrolled (web behavior) or hold a "new posts" affordance? Web does not specify one.
5. **Load-more errors.** Web is silent. Should native show a toast with retry?
6. **Reaction errors.** The reaction handler as summarized has no error toast. Confirm the failure path before porting; if none exists, add a toast and keep the button enabled.
7. **External helpers.** `deriveCouponStatus`, `getDisplayedCouponOdds`, `getDisplayedCouponWin` (`@/features/coupons/display`) and `getRouletteBetTypeLabel`, `formatRouletteBetValue` (`@/features/casino/lib/roulette`) were not re-read. Their output must match before the card can be 1:1.
8. **CSS values.** Classes such as `social-mobile-action-button`, `social-mobile-engagement-summary`, `social-reaction-picker` and `social-reaction-picker-option` are styled in `src/index.css` and were not re-read. Pixel values for native must come from that CSS.
9. **Image compression on native.** The web pipeline is canvas-based. Choose a native library (for example `expo-image-manipulator`) and confirm it can meet the 85 KB target and the same dimension and quality steps.
10. **Haptics.** None on web. Decide whether the long-press picker and reaction toggle should add haptic feedback on native.
11. **Long-press parity.** Native `Pressable` long-press may differ from the web 500ms timer; confirm the threshold and the click suppression behavior.
12. **Lightbox.** No lightbox exists in the covered files. Images are inline only. Confirm this stays the case.
13. **SocialItemPage errors.** Confirm whether item-not-found vs network failure should show different copy. Web shows the same not-found card for both paths if the error is handled as a null item.
14. **Scroll container on SocialItemPage.** The item page shell matches the feed shell, but its scroll container element was not re-read. Verify the scroll owner before porting the bottom padding.
