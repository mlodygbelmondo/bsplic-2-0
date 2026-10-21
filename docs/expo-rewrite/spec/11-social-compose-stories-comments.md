# 11. Social: post composer, stories, comments, item page

Scope: the web behaviour to rebuild 1:1 in Expo at 390px. Desktop (at and above `lg`/1024px) gets one line only: the same components render, the post composer switches to the inline editor from 640px, and the story viewer becomes a centred dialog with chevron buttons. No other desktop layout is specified here.

Copy is verbatim Polish. Class names are Tailwind unless marked as literal values. Line references are to the web source at the repo root.

## Files covered

| File | Lines | Role |
|---|---|---|
| `src/features/social/components/PostComposer.tsx` | 428 | Post composer: compact trigger, bottom sheet, editor |
| `src/features/social/components/SocialStories.tsx` | 654 | Stories strip, story composer sheet, story viewer |
| `src/features/social/components/CommentThread.tsx` | 482 | Comment toggle, comment tree, comment input, replies |
| `src/features/social/components/MentionSuggestions.tsx` | 44 | `@` mention suggestion list |
| `src/features/social/hooks/useMentionAutocomplete.ts` | 67 | Debounced mention search hook |
| `src/features/social/mentions.ts` | 40 | Active mention extraction and replacement |
| `src/features/social/api/mentions.ts` | 23 | `search_mention_users` RPC wrapper |
| `src/features/social/thread.ts` | 60 | Flat comment list to tree, comment count |
| `src/features/social/eniuBot.ts` | 5 | `@eniu` mention regex |
| `src/features/social/api/eniuBot.ts` | 75 | Eniu edge-function wrappers (user path: `respondAsEniu` only) |
| `src/features/social/lib/eniuTrigger.ts` | 31 | Fire-and-forget Eniu trigger after post or comment |
| `src/pages/SocialItemPage.tsx` | 211 | `/social/:itemType/:itemId` page |
| `src/features/social/images.ts` | 177 | Client image compression and upload |
| `src/features/social/api/social.ts` | 142 | Feed, story, comment, reaction RPC wrappers |
| `src/features/social/api/socialQueries.ts` | 23 | React Query factories for feed and stories |
| `src/features/social/routes.ts` | 21 | Item type guard, item path, comment target |
| `src/features/social/content.ts` | 38 | Image marker encode and decode |
| `src/features/social/lib/socialFormatters.ts` | 42 | Polish plural and relative time helpers |
| `src/features/social/hooks/useFeedInteractions.ts` | 260 | Comment add (with image and Eniu), reactions |
| `src/pages/SocialPage.tsx` | 739 | Feed page: composer and stories mount, create handlers |

Referenced, not specified here: `SocialImagePreview`, `SocialContentBlock`, `ReactionBar`, `ReactorsDialog`, `SocialFeedCard` (spec 10), `Navbar`, `useSocialRealtimeFeed`, admin Eniu functions.

## Surfaces

### S1. Post composer (feed header)

- **Entry:** `SocialPage.tsx:620-625` mounts `<PostComposer>` inside `<div className="mb-0 sm:mb-4">`, only when a user is signed in. Props: `onSubmit={handleCreatePost}`, `currentUserId`, `currentUsername={profile?.username ?? undefined}`, `currentUserAvatarUrl={profile?.avatar_url}`.
- **Exit:** a successful submit clears the draft and closes the sheet. There is no navigation. Closing the sheet without submitting keeps the draft (it lives in the parent `PostComposer`).
- **Breakpoint:** `COMPACT_COMPOSER_BREAKPOINT = 640`. Below 640px the compact trigger and bottom sheet render (`sm:hidden` on the sheet). From 640px the inline editor renders.

**390px layout, top to bottom (trigger, closed state):**

1. Trigger button, full width. Class `flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors disabled:opacity-60`. `aria-label="Utwórz post"`. Disabled when `disabled`. Wrapper has `data-testid="post-composer"`.
2. `ComposerAvatar`, 40×40 (`h-10 w-10`). Shows the user's avatar image; falls back to the initial of `username || 'T'` on `bg-primary/10 text-primary`. If the image fails (`onError`), the initial is shown.
3. Pill, `min-w-0 flex-1 rounded-full bg-muted px-4 py-2.5 text-[15px] font-medium leading-none text-muted-foreground`, text `Co nowego?`.
4. Decorative `ImagePlus` icon (lucide, `h-6 w-6`) in a 40×40 box, `flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-primary`. `aria-hidden`, `data-testid="post-composer-media-affordance"`. Tapping it opens the sheet like the rest of the trigger. It does not open a picker.

**Bottom sheet (opened from the trigger):**

- Sheet: `side="bottom"`, class `social-composer-sheet max-h-[calc(var(--app-viewport-height,100svh)-0.75rem)] overflow-hidden rounded-t-[20px] border-border bg-background p-0 shadow-2xl sm:hidden`.
- Sheet header: class `border-b border-border px-4 pb-3 pt-4 text-center`. Title `Utwórz post`, `text-base font-bold`.
- Body is `ComposerEditor variant="sheet" autoFocus`, root class `space-y-3 overflow-y-auto px-4 pb-[calc(1rem+var(--safe-area-bottom))] pt-4`, top to bottom:
  1. Header row `flex items-center gap-3`: avatar `h-10 w-10`; name `truncate text-sm font-semibold text-foreground` showing `currentUsername || 'Ty'`; subtitle `text-xs text-muted-foreground` with `Post w feedzie`.
  2. Textarea, `w-full resize-none placeholder:text-muted-foreground focus:outline-none min-h-[10rem] rounded-2xl border-0 bg-muted px-4 py-3 text-base leading-6 focus:ring-0`. `rows={5}`. `placeholder="Co nowego?"`. `aria-label="Treść posta"`. `maxLength={500}`. Disabled while `submitting || disabled`. Focus on open. Paste handler attaches an image.
  3. Attachment preview (`SocialImagePreview`, out of scope), shown when an image is attached.
  4. `MentionSuggestions` inside `<div className="mt-2">`, shown while a mention is active (see S6).
  5. Footer `flex items-center justify-between pt-1`:
     - Counter `{trimmed.length}/500` on the left. Switches to `text-destructive` when over the limit (unreachable in practice, see gotchas).
     - Submit `Button size="sm"`, class `rounded-full px-4`, `aria-label="Opublikuj post"`, disabled when `!canSubmit`. Icon: `Loader2` (`h-4 w-4 animate-spin mr-1`) while submitting, otherwise `Send` (`h-4 w-4 mr-1`). Text `Opublikuj`.

**Inline editor (640px and up, for reference only):** root `app-surface social-edge-surface overflow-hidden rounded-xl p-4`. No header row. Textarea `rounded-lg border border-border bg-transparent px-3 py-2 text-sm transition-[min-height,padding] duration-200 focus:ring-2 focus:ring-primary/30 sm:p-3`, `rows={3}`. Footer `mt-2`.

- **States:**
  - Empty: submit disabled. Counter `0/500`.
  - Text only: submit enabled when `trimmed.length` is 1 to 500.
  - Image only (empty text): submit enabled.
  - Submitting: textarea disabled, submit shows spinner.
  - Image attached: preview shown, a second image is refused (toast).
- **Interactions:**
  - Tap trigger: sheet opens, textarea focused.
  - Type: counter updates, mention autocomplete runs on caret movement.
  - Paste image: compressed, preview shown, toast (see Business rules).
  - Submit: calls `onSubmit(trimmed)` or `onSubmit(trimmed, blob)`. On success the draft resets and the sheet closes.
- **Motion:** shadcn Sheet open and close animation. Textarea `min-height` transition is inline-only. No custom motion.
- **Sound and haptics:** none.

**Toasts (sonner):**
- Second image: `Możesz dodać maksymalnie jedno zdjęcie do posta`.
- Compression success: `Zdjęcie zostało dodane i skompresowane`.
- Compression failure: the error message, or `Nie udało się dodać zdjęcia`.

### S2. Stories strip

- **Entry:** `SocialPage.tsx:630` mounts `<SocialStories>` only when signed in. Props: `stories`, `profileFallbacks={socialStoryProfiles}`, `currentUsername={profile?.username ?? 'Ty'}`, `currentAvatarUrl={profile?.avatar_url ?? null}`, `onCreateStory={handleCreateStory}`. It renders after the composer.
- **Exit:** tap the create tile (opens S3), tap an active story tile (opens S4), or tap a profile fallback (navigates to `/profile/:userId`).

**Layout:**

- Wrapper `data-testid="social-stories-strip"`, class `social-facebook-stories mb-2 flex gap-2 overflow-x-auto px-2 pb-2`. Horizontal scroll row. Tile sizes come from `index.css` (`.social-story-tile` at line 777, `.social-story-create` at 808, `.social-story-avatar-ring` at 826, `.social-story-label` at 855). Those dimensions were not transcribed here.
- Tile 1, create: class `social-story-tile social-story-create`, `aria-label="Utwórz relację"`, disabled when `disabled`. Background is `StoryImage` for the current user. A `Plus` icon sits in `social-story-create-plus`. Label `social-story-label` with `data-label="Utwórz relację"`, text `Utwórz relację`.
- Tiles 2 to n, one per active story (`key={story.id}`): class `social-story-tile`, `aria-label={`Otwórz relację ${story.username}`}`. Cover is `social-story-image` (`StoryCoverImage`: the story image if it has an image marker, otherwise `StoryImage`). Avatar ring `social-story-avatar-ring`. Label `social-story-label` with `data-label={story.username}`.
- Profile fallbacks, shown only when `activeStories.length === 0`, one per profile (`key={profile.userId}`): a `Link` to `/profile/${userId}`, `aria-label={`Profil ${profile.username}`}`, using the same tile styling.

**States:**
- Signed out: no strip rendered.
- No active stories: create tile plus profile fallbacks.
- Active stories: create tile plus story tiles. Fallbacks hidden.

**Motion:** no animation on the strip itself. The ring and tile styling are static CSS.

**Sound and haptics:** none.

### S3. Story composer sheet

- **Entry:** create tile in S2. Clicking sets `createOpen`.
- **Exit:** submit success closes it. Closing by any route calls `resetDraft` (the draft is discarded).
- **Presentation:** bottom sheet on phones: `social-story-composer-sheet max-h-[calc(var(--app-viewport-height,100svh)-0.75rem)] overflow-hidden rounded-t-[20px] border-border bg-background p-0 shadow-2xl sm:left-1/2 sm:right-auto sm:w-[min(34rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:rounded-t-2xl sm:border` (line 370). At 390px it is the bottom sheet.

**390px layout, top to bottom:**

1. Sheet header: class `border-b border-border px-4 pb-3 pt-4 text-center`, title `Utwórz relację` (`text-base font-bold`).
2. Subtitle, `Relacja zniknie po 24 godz.` (line 389-391).
3. Textarea, `min-h-[9rem] w-full resize-none rounded-2xl border-0 bg-muted px-4 py-3 text-base leading-6`. `placeholder="Napisz coś..."`. `aria-label="Treść relacji"`. `maxLength={500}`. Disabled while `submitting || disabled`. Focus after 150 ms. Paste handler attaches an image.
4. Attachment preview (`SocialImagePreview`) when attached.
5. Photo control: `<label htmlFor="story-image-input">` with `ImagePlus` (`h-5 w-5`) and text `Dodaj zdjęcie`. Class `inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold text-primary`.
   - Hidden `<input id="story-image-input" type="file" accept="image/*" className="sr-only" aria-label="Dodaj zdjęcie do relacji">`. Disabled when an image is attached, or when submitting or disabled.
6. Footer row, `justify-between`:
   - Counter `{trimmed.length}/500`.
   - Submit `Button size="sm" className="rounded-full px-4"`, `aria-label="Opublikuj relację"`, disabled when `!canSubmit`. `Loader2` (`mr-1 h-4 w-4 animate-spin`) while submitting. Text `Opublikuj`.

**Rules:** `canSubmit = (trimmed.length > 0 || !!attachedImage) && trimmed.length <= 500 && !submitting && !disabled`.

**Interactions:**
- Pick image: file input opens the native picker (`accept="image/*"`). The chosen file is compressed with the same pipeline as posts.
- Paste image: same compression path.
- Submit: `handleSubmit` awaits `onCreateStory(trimmed, attachedImage?.blob)`, then resets the draft and closes. On failure it toasts and keeps the draft.

**Toasts:**
- Second image: `Możesz dodać maksymalnie jedno zdjęcie do relacji`.
- Compression failure: error message, or `Nie udało się dodać zdjęcia`.
- Publish failure: error message, or `Nie udało się opublikować relacji`.

**Motion, sound, haptics:** shadcn Sheet animation. None otherwise.

### S4. Story viewer

- **Entry:** tap an active story tile (S2). `openStory(index)` sets the index and opens the viewer. The viewer is a `Dialog` with `open={viewerOpen}`.
- **Exit:**
  - Close button (X), `DialogClose`, `<span className="sr-only">Zamknij relację</span>`.
  - Next on the last story closes the viewer.
  - Dialog default dismissal (Escape, overlay) through `onOpenChange`.
  - Auto-advance on the last story closes the viewer (see timers below).
- **Presentation:** `DialogContent hideCloseButton`, class `social-story-viewer fixed inset-0 ... bg-neutral-950 text-white`. Full screen on phones. From `sm`: `h-[min(88svh,760px)] w-[min(420px,calc(100vw-2rem))] rounded-[1.4rem]`.
- Hidden title `DialogTitle` (sr-only): `Relacja {username}`.

**390px layout, top to bottom (full screen):**

1. **Background:**
   - If the story has an image: `object-cover`, full bleed.
   - Otherwise a gradient: `radial-gradient(hsl(var(--primary)/0.9) …)` layered over `linear-gradient(150deg,#160707_0%,#451010_52%,#09090b_100%)`. The remaining radial stops are not transcribed (see `SocialStories.tsx:508-516`).
2. **Overlay:** gradient `from-black/72 via-black/18 to-black/78`.
3. **Progress row** at the top: `grid gap-1` with `gridTemplateColumns: repeat(storyCount, minmax(0,1fr))`. One bar per story, keyed by index: track `h-1 rounded-full bg-white/35`.
   - Stories before the current one: fill `bg-white w-full`.
   - Current: fill `social-story-progress` (CSS animation, 7 s linear, forwards).
   - Stories after: fill `w-0`.
4. **Header row:**
   - `StoryImage` avatar `h-10 w-10 rounded-full ring-2 ring-primary`.
   - Username, `text-sm font-bold`.
   - Meta line `text-xs text-white/72`: `formatStoryAge(created_at) · formatStoryTimeLeft(expires_at)`.
   - Close button: `X` (lucide, `h-5 w-5`) in a `DialogClose` with class including `bg-black/30`, sr-only label `Zamknij relację`.
5. **Tap zones** (absolute, `inset-y-24`, `w-1/3`):
   - Left: `onClick={onPrevious}`. `aria-label="Poprzednia relacja"` only when `storyIndex > 0`. `onPrevious` clamps at 0.
   - Right: `onClick={onNext}`. `aria-label="Następna relacja"` only when `storyIndex < storyCount - 1`. On the last story it closes the viewer.
6. **Desktop chevrons** (`ChevronLeft`, `ChevronRight`): visible from `sm`, hidden on phones.
7. **Text overlay**, only when the story has text. Class `story-viewer-text mx-auto max-w-[18rem] whitespace-pre-wrap text-center text-2xl font-black leading-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)]`. Text is `parseSocialContent(story.content).text`.

**Labels:**
- `formatStoryAge`: `teraz` (under 1 min), `${m} min` (under 60), `${h} godz.`.
- `formatStoryTimeLeft`: `znika za chwilę` (≤1 min left), `znika za ${m} min` (under 60), `znika za ${h} godz.` (rounded up).

**Timers:**
- Auto-advance: `setTimeout` of 7000 ms (`STORY_VIEW_MS`). Advances while not on the last story. On the last story it closes the viewer. The effect cleans up its timeout.
- Clock: a 30000 ms `setInterval` updates `now`. Ages and time-left labels refresh on this tick.

**Interactions:**
- Tap right third: next story.
- Tap left third: previous story.
- No swipe, no press-and-hold pause, no keyboard handlers.

**Motion:** progress fill animation (7 s linear, forwards). Dialog open and close animation.

**Sound and haptics:** none.

### S5. Comment thread

- **Entry:** `CommentThread` is rendered by `SocialFeedCard` (spec 10) for each feed item, and by `SocialItemPage` (S8). On S8 it is rendered with `defaultExpanded` (`defaultCommentsExpanded`), so the comments open on mount.
- **Exit:** the toggle collapses the thread. There is no navigation from the thread.
- **Props:** `comments`, `initialCount = 0`, `commentsLoaded = true`, `onFirstExpand?`, `onAddComment(content, parentId?, imageBlob?)`, `onToggleReaction(commentId, emoji)`, `onOpenCommentReactors?`, `disabled?`, `maxDepth = 3`, `currentUserId?`, `defaultExpanded = false`, `expandSignal?`, `hideToggleOnMobile = false`.

**Toggle button (collapsed or expanded):**
- Class `flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors`. With `hideToggleOnMobile`, `hidden sm:flex` is added (hidden below 640px).
- Icon `MessageCircle` (`h-3.5 w-3.5`).
- Label: `${totalCount} ${formatCommentCount(totalCount)}` (for example `3 komentarze`), or `Skomentuj` when `totalCount` is 0.
- `totalCount = commentsLoaded ? comments.length : Math.max(comments.length, initialCount)`.
- With `hideToggleOnMobile`, the label is an `aria-hidden` span with class `social-comment-toggle-label` and `data-label`, read by CSS (`index.css:764`) instead of text.
- Chevron `ChevronDown` (collapsed) or `ChevronUp` (expanded), `h-3 w-3`, shown only when `totalCount > 0`.
- `aria-label`: `Pokaż komentarze (${totalCount})` when collapsed, `Ukryj komentarze` when expanded.

**Expanded body:** `space-y-2 pl-0 sm:pl-1`, top to bottom:
1. Root input (`CommentInput`, placeholder `Napisz komentarz...`), shown when `showInput`.
2. If `showInput` is false: text button `Dodaj komentarz`, class `text-xs text-primary`.
3. Comment tree, one `CommentNodeView` per root, in input order.

**Comment node (`CommentNodeView`):**
- Depth above 0: `ml-2 border-l border-border pl-2 sm:ml-4 sm:pl-3`.
- Avatar `h-7 w-7 ... sm:h-6 sm:w-6`, `alt="Avatar ${username}"`.
- Bubble `social-comment-bubble rounded-2xl bg-muted px-3 py-2`.
  - Username `text-xs font-semibold`.
  - Time `text-[10px] text-muted-foreground`, `formatTimeAgo(created_at)`.
  - Body `SocialContentBlock` with `imageAlt="Zdjęcie w komentarzu"`. If `image_path` is set, `\n[[img:<path>]]` is appended to the content before parsing.
- `ReactionBar`, class `social-comment-reaction-bar`.
- Reply button `Odpowiedz` (`text-[11px]`), `aria-label={`Odpowiedz na komentarz ${username}`}`. Shown only when `canReply`, which is `depth < maxDepth` (depths 0, 1 and 2 can be replied to; depth 3 cannot).
- Reply input (`CommentInput`): placeholder `Odpowiedz @${username}...`, with `onCancel`.
- Child nodes render recursively below the bubble.

**Comment input (`CommentInput`):**
- `<input type="text">`, class `flex-1 bg-transparent border border-border rounded-full px-3 py-2 text-base ... sm:rounded-lg sm:py-1.5 sm:text-sm`.
- `maxLength={500}`. Default placeholder `Napisz komentarz...`. `aria-label` equals the placeholder.
- Enter (without Shift) submits.
- Send button: `Button size="icon" variant="ghost" className="h-7 w-7"`, `aria-label="Wyślij komentarz"`, `Send` icon (`h-3.5 w-3.5`).
- Reply mode cancel: `aria-label="Anuluj odpowiedź"`, text `✕`.
- Mention autocomplete attached (see S6).
- Image paste only. No picker.

**States:**
- Collapsed: toggle only.
- Expanded with no comments: `Napisz komentarz...` input (if `showInput`), no tree.
- Comments not loaded: `totalCount` uses `initialCount`. First expand calls `onFirstExpand`.
- Reply mode: reply input replaces the Odpowiedz button for that node until cancel or successful submit.

**Interactions:**
- Tap toggle: collapses or expands. Expanding sets `showInput` true. If `commentsLoaded` is false, `onFirstExpand` runs.
- `expandSignal` prop: when its value changes (and is not undefined), the thread toggles collapsed. Expanding also sets `showInput` and calls `onFirstExpand` if not loaded.
- Submit: `onAddComment(trimmed, parentId?, blob?)`. Empty text with no image is blocked.
- Reply submit: `handleReply` awaits `onAddComment` and then closes the reply input.
- Reaction: `onToggleReaction(commentId, emoji)`. Reactor list via `onOpenCommentReactors`.

**Motion:** chevron swap, `transition-colors` on the toggle. No other motion.

**Sound and haptics:** none.

**Toasts:**
- Second image: `Możesz dodać maksymalnie jedno zdjęcie do komentarza`.
- Compression success: `Zdjęcie zostało dodane i skompresowane`.
- Compression failure: error message, or `Nie udało się dodać zdjęcia`.

### S6. Mention autocomplete

- **Entry:** the caret sits inside a post textarea (S1) or a comment input (S5), after an `@` token. `useMentionAutocomplete` is used by `PostComposer.tsx:208` and `CommentThread.tsx:319`. `MentionSuggestions` is rendered by `PostComposer.tsx:362` and `CommentThread.tsx:459`.
- **Exit:** selecting a suggestion, or the caret leaving the token (the active mention becomes null).

**Layout (`MentionSuggestions`):**
- Loading: `rounded-lg border border-border bg-popover p-2 text-xs text-muted-foreground`. `Loader2` (`h-3.5 w-3.5`, spinning), text `Szukanie użytkowników...`.
- Empty result: renders nothing.
- Results: container `rounded-lg border border-border bg-popover p-1`.
  - Header `text-[11px] text-muted-foreground px-2 py-1`: `Wspomnij użytkownika`.
  - Rows `w-full text-left rounded-md px-2 py-1.5 text-sm hover:bg-muted`, `aria-label="@${username}"`, text `@{username}`.

**Behaviour:**
- Active mention: the text before the caret matches `(?:^|\s)@([A-Za-z0-9_.-]{0,32})$`. Query is the text after `@`.
- Minimum query length: 1. A bare `@` shows no suggestions and clears any pending search.
- Debounce 120 ms. Each change cancels the previous request.
- Search: `search_mention_users` with `p_query`, `p_current_user_id`, `p_limit = 6`. Empty query returns `[]` without calling the RPC.
- On error: suggestions set to `[]`.
- Selecting a row (`applyMention`): replaces the `[start, end)` span (from the `@` to the caret) with `@${username} `. Caret moves to just after the inserted space.

**Motion, sound, haptics:** none.

### S7. Eniu bot triggers

- **Entry:** a successful post (`handleCreatePost`) or comment or reply (`handleAddComment`) whose raw content matches the Eniu pattern.
- **Exit:** none visible. The bot reply appears later as a comment or post, loaded by the reload callback.

**Behaviour:**
- Pattern: `/(^|[^\p{L}\p{N}_-])@eniu(?=$|[^\p{L}\p{N}_-])/iu`. Case-insensitive. Needs a boundary before and after. No `g` flag.
- The UI calls `triggerEniuBotReply(source, sourceId, content, reloadComments)`, which returns immediately if the content does not match.
- Otherwise it fires `respond-as-eniu` with `{sourceType, sourceId}` and does not await it.
- After the response, comments reload whether or not `ok` is true.
- Failures log to the console only: `Eniu failed to respond` plus the error text or `Eniu nie odpowiedział`. No toast and no inline indicator.
- Post path: `loadFeed()` is awaited before the trigger. If the feed reload rejects, Eniu is never triggered.
- Post path passes the trimmed text (without the image marker) as `content`.
- Stories: no Eniu trigger.

**Motion, sound, haptics:** none. There is no pending indicator on web.

### S8. Item page `/social/:itemType/:itemId`

- **Entry:** `getSocialItemPath(itemType, itemId)` builds `/social/${encodeURIComponent(itemType)}/${encodeURIComponent(itemId)}`. `itemType` is `post`, `coupon` or `casino`. Accepted only when `isFeedItemType` returns true (`SocialItemPage.tsx:30`).
- **Exit:** the back link `Link to="/social"`.
- **Page title:** `usePageTitle('Social')`.

**390px layout, top to bottom:**

1. Outer wrapper, class `social-mobile-page h-safe-screen bg-background overflow-hidden flex flex-col`.
2. `Navbar` (out of scope).
3. Scroll container `flex-1 min-h-0 overflow-y-auto`.
4. Content `data-testid="social-item-content"`, class `social-facebook-feed w-full max-w-3xl mx-auto px-0 pt-2 ... sm:px-4 sm:py-4`.
   - Back link to `/social`: `ChevronLeft` icon and text `Social`.
   - Item card: `SocialFeedCard` with `isAko` (derived at `SocialItemPage.tsx:151-152`), `defaultCommentsExpanded` set, reactions and comment reactions via `handleToggleReaction` and `handleToggleCommentReaction`.
5. `ReactorsDialog`, always mounted at the bottom.

**States:**
- Loading: `Loader2` plus `Ładowanie wpisu...`.
- Not found: card `rounded-xl border border-border bg-card p-8 text-center`. Title `Nie znaleziono wpisu` (`text-lg font-semibold`). Body `Ten wpis mógł zostać usunięty albo nie masz do niego dostępu.`
- Loaded: the card with comments expanded.

**Data flow:**
- Local state only: `item`, `comments` (`EMPTY_COMMENTS` initial), `commentsLoaded`, `commentsLoading`, `loading` (true initially).
- Mount: `fetchSocialFeedItem(itemType, itemId, user?.id)`, then `fetchComments(getSocialItemCommentsTarget(itemType, itemId), user?.id)`. Sets `comment_count` on the item.
- Load failure toast: error message, or `Nie udało się załadować wpisu`.
- Comment actions go through `useFeedInteractions(interactionsStore)`. Same behaviour as the feed (S5, S7).
- No React Query cache.

**Motion, sound, haptics:** none beyond spinner and card components.

## Data contract

### RPC and edge calls

| Call | Arguments | Returns | Call site |
|---|---|---|---|
| `create_social_post` | `p_user_id`, `p_content` | `string` (id) | `api/social.ts:43-48` |
| `create_social_story` | `p_user_id`, `p_content` | `string` (id) | `api/social.ts:57-62`, `rpc.ts:42-45` |
| `get_active_social_stories` | none (`args: undefined`) | `SocialStory[] \| null` (mapped to `[]`) | `api/social.ts:52-55` |
| `get_social_feed_item` | `p_item_type`, `p_item_id`, `p_user_id` (nullable) | `SocialFeedItem \| null` | `api/social.ts:27-39`, `rpc.ts:26-33` |
| `get_comments_for_target` | `p_post_id`, `p_coupon_id`, `p_casino_share_id` (exactly one set), `p_user_id` | `SocialComment[]` (mapped to `[]`) | `api/social.ts:92-104`, `rpc.ts:61` |
| `add_social_comment` | `p_user_id`, `p_content`, `p_post_id`, `p_coupon_id`, `p_casino_share_id`, `p_parent_id` | `string` (id) | `api/social.ts:106-122`, `rpc.ts:70` |
| `toggle_reaction` | `p_user_id`, `p_emoji`, `p_post_id` / comment target | `ReactionEmoji \| null` | `api/social.ts:126-142`, `rpc.ts:81` |
| `search_mention_users` | `p_query`, `p_current_user_id` (nullable), `p_limit` (default 6) | `MentionUser[]` (`{id, username}`) | `api/mentions.ts`, `rpc.ts:102-105` |
| Edge `respond-as-eniu` | `{sourceType: 'post' \| 'comment', sourceId}` | `EniuReplyResult` (`ok`, `text?`, `providerDiagnostic?`, `result?`, `error?`) | `api/eniuBot.ts:36-46` |

Client `callRpc` and `invoke` wrappers throw `new Error(error.message)` on error.

Excluded from this surface: `create_casino_social_share` (spec 12a or 10), `retry`/`command-eniu` and `admin_get_social_bot_runs` (admin).

### Storage

- Bucket: `social-images` (`SOCIAL_IMAGES_BUCKET`).
- Path: `${userId}/${Date.now()}-${rand6}.jpg`, where `rand6` is `Math.random().toString(36).slice(2, 8)`.
- Upload options: `contentType: 'image/jpeg'`, `upsert: false`, `cacheControl: '31536000'`.
- Public URL: `getPublicUrl(path)`. No signed URLs.

### Content encoding (`content.ts`)

- `buildSocialContent(text, imagePath?)`:
  - No image: returns `text`, trimmed.
  - Image and empty text: `[[img:<path>]]`.
  - Image and text: `${text}\n[[img:<path>]]`.
- `parseSocialContent(content)` returns `{text, imagePath}`. Marker regex: `/(?:\n)?\[\[img:([^\]\n]+)\]\]\s*$/`. Only a trailing marker is recognised.

### Types

- `SocialStory`: `id`, `user_id`, `username`, `avatar_url?`, `content: string | null`, `created_at`, `expires_at`.
- `SocialComment`: `id`, `user_id`, `username`, `avatar_url?`, `content`, `parent_id`, `created_at`, `reactions`, `my_reaction`. No `image_path` declared.
- `FlatComment` (`thread.ts`): same as `SocialComment` plus `image_path?: string | null`.
- `CommentNode`: `FlatComment` plus `children: CommentNode[]`.
- `ReactionEmoji`: `'like' | 'heart' | 'laugh' | 'wow' | 'sad' | 'angry' | 'fire'`.
- `FeedItemType`: `'post' | 'coupon' | 'casino'`.
- `MentionUser`: `{id, username}`.
- `EniuBotRun` (admin, out of scope).
- `EniuReplyResult`: `ok: boolean`, `text?`, `providerDiagnostic?`, `result?`, `error?`.

### Cache keys and options (`socialQueries.ts`)

- Feed: key `['social','feed', userId ?? null]`, fn `fetchSocialFeed(50, 0, userId)`, spreads `PAGE_DATA_QUERY_OPTIONS`. Page size 50.
- Stories: key `['social','stories']`, fn `fetchActiveSocialStories`, spreads `PAGE_DATA_QUERY_OPTIONS`.
- `SocialPage` reloads both with `queryClient.fetchQuery({...,staleTime: 0})`.
- Comments and the item page use no React Query key.

### Realtime

- None in this scope. Feed realtime (`useSocialRealtimeFeed`, channel `social-feed-realtime`) is mounted only by `SocialPage.tsx:472`, and is out of scope.

### Local storage

- None in these surfaces. Storage is limited to the upload path above.

## Business rules

### Posts
- Text: trimmed, max 500 characters (`MAX_LENGTH = 500`, textarea `maxLength={500}`).
- Submit allowed when text (trimmed) is non-empty or an image is attached, and not submitting, and not disabled.
- One image per post. A second image is refused with a toast.
- Image-only posts are allowed. Stored content is `[[img:<path>]]`.
- Create flow (`SocialPage.handleCreatePost`): upload the image if present, build content with `buildSocialContent`, call `create_social_post`, await `loadFeed`, trigger Eniu on the post, then toast `Post opublikowany`.
- Draft: lives in the parent `PostComposer`. It resets only after a successful submit.

### Stories
- Text: max 500 characters (`STORY_TEXT_MAX_LENGTH = 500`, textarea `maxLength={500}`).
- Submit allowed under the same rule as posts.
- One image per story.
- Create flow (`SocialPage.handleCreateStory`): upload if present, build content, call `create_social_story`, await `loadStories`, toast `Relacja opublikowana`. No Eniu.
- Lifetime: subtitle says 24 hours. The client filters with `new Date(expires_at).getTime() > now`. Expiry is set by the server (see open questions).
- Active list is the stories past expiry filter, sorted as the RPC returns them.
- Draft: discarded on close (`onOpenChange` calls `resetDraft`). Kept on failed submit only while the sheet stays open.

### Story viewer
- Each story shows for 7000 ms, then advances. The last story closes the viewer.
- Clock tick every 30000 ms refreshes age and time-left labels.
- Navigation is tap-only (left third previous, right third next).
- Selected index is clamped if the active list shrinks (`SocialStories.tsx:125-128`).
- Story labels: `teraz` / `${m} min` / `${h} godz.` for age; `znika za chwilę` / `znika za ${m} min` / `znika za ${h} godz.` for time left.

### Comments
- Text max 500 characters (`CommentInput` `maxLength={500}`).
- Submit: enter key submits; empty text with no image is blocked; submit is blocked while submitting.
- One image per comment. Second image refused with a toast.
- Reply depth: replies allowed while `depth < maxDepth` (3), so up to depth 3 (zero-based depth 0, 1, 2 can be replied to; depth 3 shows no Odpowiedz button).
- Tree: built by `buildCommentTree`. A comment whose `parent_id` is truthy and present in the list goes under its parent. Otherwise it becomes a root. Input order is kept.
- Count shown in the toggle: `commentsLoaded ? comments.length : max(comments.length, initialCount)`. `countComments` is recursive and counts every node.
- Relative time (`formatTimeAgo`, in `CommentThread.tsx:472-482`): `teraz`, `${m} min`, `${h} godz.`, `${d} dn.` under 7 days, otherwise `toLocaleDateString('pl-PL')`.

### Mentions
- Active mention: `@` preceded by start or whitespace, followed by up to 32 characters from `A-Za-z0-9_.-`, ending at the caret.
- Minimum query length 1. Debounce 120 ms. Result limit 6.
- Selection replaces the `@query` span with `@${username} ` and places the caret after it.

### Eniu
- Trigger on posts and comments (including replies). Matching uses the raw content, case-insensitive, with boundary rules (see S7).
- Fire-and-forget. Failure is logged to console only. Comments reload afterwards regardless.

### Item page
- Valid item types: `post`, `coupon`, `casino`. Comment target: post maps to `{postId}`, coupon to `{couponId}`, casino to `{casinoShareId}`.
- Item path: `/social/${type}/${id}` with both segments URI-encoded.

### Images (`images.ts`)
- Output always JPEG (`image/jpeg`).
- Max dimension 1280 px on the longer side, aspect ratio kept.
- Target size 85 KiB (`85 * 1024` = 87040 bytes). Qualities tried in order: `[0.8, 0.72, 0.64, 0.56, 0.48]`.
- Per attempt: draw at current size, try each quality. The first blob at or under the target is returned immediately.
- If no quality reaches the target, shrink both dimensions by 0.82 and retry. Each side is floored with `Math.max(minWidth|minHeight, …)` at 320 px, so a side already under 320 px is raised to 320. The shrink runs after every attempt, including the last. Up to 5 attempts.
- After the loop: if the best (smallest) blob is over 90 KiB (`90 * 1024` = 92160 bytes), throw `Zdjęcie jest zbyt duże po kompresji. Spróbuj inne zdjęcie.`
- Load: `createImageBitmap` when available, otherwise a FileReader data URL loaded into an `Image`.
- Errors: `Twoja przeglądarka nie obsługuje kompresji obrazu` (no canvas context), `Nie udało się skompresować obrazu` (toBlob returned null, or no blob at all), `Nie udało się odczytać obrazu`, `Nie udało się wczytać obrazu`.
- Upload: `upsert: false`, so a path collision fails rather than overwrites.

## Edge cases & gotchas

1. **Post submit errors are not handled.** `PostComposer.handleSubmit` has `try/finally` with no catch. `SocialPage.handleCreatePost` has no try at all. A failed create is an unhandled promise rejection with no toast. The draft is kept, because `onSubmitted` is not called. The native rebuild should catch the error and show feedback (`sonner`-style toast, see open questions).
2. **Story submit errors do toast.** Only the story composer catches and toasts (`Nie udało się opublikować relacji` or the error message).
3. **Comment submit errors are not handled.** `CommentThread.handleSubmit` (`335-352`) and `useFeedInteractions.handleAddComment` have no catch. The reply path (`handleReply`) awaits `onAddComment` and only closes the reply box on success.
4. **Orphaned uploads.** Post, story and comment images are uploaded before the create RPC. If the RPC fails, the uploaded object stays in the bucket. There is no cleanup code.
5. **Draft survival differs.** Post draft survives closing the sheet. Story draft is discarded on close (`resetDraft` on `onOpenChange(false)`). Comment reply text is lost when the reply box unmounts.
6. **Counter red state is unreachable.** Textarea and input have `maxLength=500`, so `trimmed.length` cannot exceed 500 in the UI. The `text-destructive` branch and the `trimmed.length <= 500` guard only matter if the limit is removed or counted differently.
7. **Length unit.** Web `maxLength` counts UTF-16 code units, so an emoji counts as 2. The native input should use the same unit, or the limit will differ for emoji-heavy text.
8. **Mention regex is ASCII-only.** `[A-Za-z0-9_.-]` means a query with Polish letters (for example `ą`, `ł`) does not open suggestions. The Eniu regex is Unicode-aware (`\p{L}\p{N}`), so the two rules differ. Whether usernames can contain diacritics is not verified here.
9. **Eniu post path skips on feed reload failure.** `loadFeed()` is awaited before the trigger, so a rejected reload means no Eniu call.
10. **Eniu is case-insensitive and boundary-checked.** `@Eniu`, `@ENIU`, `@eniu!` match. `@eniu2` and `x@eniu` do not.
11. **Eniu failure is invisible.** Only `console.error`. Comments reload anyway, so the user may see no bot reply and no reason.
12. **Reply does not auto-prefix the mention.** The placeholder says `Odpowiedz @${username}...`, but `handleSubmit` sends the typed text as-is. No automatic `@username` insertion was found in the handler.
13. **Comment `image_path` is not in the RPC type.** `FlatComment` declares `image_path?`, `SocialComment` does not. Whether `get_comments_for_target` returns it is not verified. The renderer shows the image only if the field is present.
14. **Image compression return dimensions.** On the final-return path (`images.ts:156`), `width` and `height` are the post-shrink values, not the size of `bestBlob`. They can disagree with the blob. Callers only use `blob`, so this is harmless today.
15. **Bitmap never closed.** `createImageBitmap` result is not `.close()`d (`images.ts:54`). On native, release the decoded image explicitly.
16. **Compression can fail on very large photos.** The 90 KiB ceiling (`absoluteMaxBytes`) applies to the smallest blob found. If even that is larger, the user sees `Zdjęcie jest zbyt duże po kompresji. Spróbuj inne zdjęcie.`
17. **Story timers.** The auto-advance effect restarts when `activeStories.length`, the selected story object, the index, or `viewerOpen` changes. The 30 s clock tick does not restart it. Each story restarts the 7 s bar because the bar is keyed by index.
18. **No pause.** Press-and-hold does not pause the story. Nothing pauses the timer on background or when the app loses focus (not handled on web either).
19. **Time labels can lag up to 30 s.** `now` updates every 30 s, so `znika za 2 min` may read stale for up to half a minute.
20. **Index clamp.** If the active story list shrinks while the viewer is open, the index is clamped to the new last item (`SocialStories.tsx:125-128`). The viewer may then jump to a different story.
21. **Fallbacks vs. active stories.** Profile fallbacks are shown only when there are zero active stories. A user with an active story sees no fallback tiles for anyone else.
22. **Paste-only images for posts and comments.** There is no file picker on the post composer or comment input. Only the story composer has `accept="image/*"` plus paste. Mobile users can only attach through paste on the web build.
23. **Image paste detection.** Paste handler checks `clipboardData.files[0]` first, then the first `image/*` entry in `clipboardData.items` (`PostComposer.tsx:25-31`; same shape in `CommentThread.tsx:23-29` and `SocialStories.tsx:57-63`). A second image while one is attached triggers the "one photo" toast before any compression.
24. **Two time formatters.** `CommentThread.formatTimeAgo` (`teraz`, `min`, `godz.`, `dn.`, then `pl-PL` date) differs from `socialFormatters.formatSocialTimeAgo` (`przed chwilą`, `temu` suffixes). The comment thread uses the first. Do not copy the second for comments.
25. **Story formatters use different copy.** `formatStoryAge` and `formatStoryTimeLeft` are in `SocialStories.tsx`, not in the shared formatter file.
26. **Item page: invalid type.** `itemType` is `null` when the param fails `isFeedItemType`. How the mount effect behaves in that case was not traced (see open questions).
27. **Item page refetches on mount.** No cache. Each visit calls `fetchSocialFeedItem` and `fetchComments`. Back-navigation shows the loading state again.
28. **Comments are not live.** Comments and stories on these surfaces do not subscribe to realtime. New comments appear after a reload or a local submit.
29. **No delete.** No delete action for posts, stories or comments exists in these surfaces.
30. **Desktop chevrons.** Viewer chevrons are `sm:` only. On phones the tap zones are the only navigation.
31. **Perf-lite.** No social component in this scope references `perf-lite` or `usePerfLite`. The progress animation is not infinite, so the perf-lite rule does not require stopping it, but nothing is changed under that mode.
32. **Focus timing.** Story composer focuses the textarea after 150 ms. Post sheet uses `autoFocus` on open.
33. **Dialog and sheet ownership.** Story viewer is a `Dialog`, not a `Sheet`, so it is full screen on phones and centred on desktop.

## Open questions

1. **Native image input.** Web posts and comments are paste-only, and stories have a picker. Native needs a decision: photo library picker only, camera too, or both. The web has no native picker to copy.
2. **Story tile sizes.** Dimensions come from `index.css` (`.social-story-tile` at 777, `.social-story-create` at 808, `.social-story-avatar-ring` at 826, `.social-story-label` at 855). They were not transcribed here. Read those rules before building the strip.
3. **Story expiry.** The 24-hour lifetime is stated in copy. The client only filters by `expires_at`. Confirm that `create_social_story` sets `expires_at` to now plus 24 hours on the server.
4. **Comment `image_path`.** Confirm whether `get_comments_for_target` returns `image_path` for comments. If not, comment images cannot display on the web either.
5. **Invalid item type.** Confirm what `SocialItemPage` shows for `/social/foo/123`. The mount effect (`61-108`) was not fully traced.
6. **Submit failure feedback.** Web shows no feedback for failed post, comment or reply submits (only the story composer toasts). Decide the native behaviour. Recommendation: a toast with the error message and keep the draft.
7. **Orphaned uploads.** Decide whether to delete the uploaded object when the create RPC fails, or accept the orphan.
8. **Eniu feedback.** Web shows nothing while Eniu is thinking and nothing on failure. Decide whether native shows a pending state on the comment or post.
9. **Length unit.** Confirm whether the 500 limit should count UTF-16 units (as web does) or user-perceived characters.
10. **Mention autocomplete for diacritics.** Confirm whether usernames can contain Polish letters. If yes, the mention pattern needs a Unicode-aware class (the web pattern does not).
11. **Reply prefix.** Decide whether replies should auto-insert `@username`. Web does not.
12. **Comment mention selection.** Confirm how `MentionSuggestions` selection in `CommentInput` updates the input value (the same `applyMention` path as posts is assumed).
13. **Story timers on background.** Decide whether the 7 s timer should pause when the app is backgrounded. Web does not handle this.
14. **Story pause on press-and-hold.** Web has no pause. Decide whether native adds it.
15. **Realtime on comments and stories.** Web does not live-update comments or stories on these surfaces. Decide whether native should.
16. **Desktop.** Only one line specified. Confirm whether desktop needs its own pass in a later spec.
