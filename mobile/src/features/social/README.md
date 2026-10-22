# Social feature

Port of the web Social page (`src/pages/SocialPage.tsx`, `src/features/social`). The feed worker owns `api/`, `lib/`, `hooks/`, `components/` and `images.ts`. The social compose worker owns `compose/`, `stories/`, `comments/`, `mentions/`, `eniu/` and `item/`.

## Query keys (`api/keys.ts`, factories in `api/queries.ts`)

| Key | Factory | Data |
|---|---|---|
| `['social', 'feed', userId ?? null]` | `socialFeedQuery(userId)` | `InfiniteData<SocialFeedItem[], offset>`: pages of 50. `select` flattens it to a deduplicated `SocialFeedItem[]`. |
| `['social', 'stories']` | `socialStoriesQuery()` | `SocialStory[]` |
| `['social', 'item', type, id, userId ?? null]` | `socialItemQuery(type, id, userId)` | `SocialFeedItem \| null` (null means not found or hidden) |
| `['social', 'comments', type, id, userId ?? null]` | `socialCommentsQuery(type, id, userId)` | `SocialComment[]`. A successful read also writes `comment_count` everywhere. |
| `['social', 'reactors', postId, couponId, casinoShareId, commentId]` | `reactorsQuery(target)` | `ReactorUser[]` (every emoji at once) |

All factories use `PAGE_DATA_QUERY_OPTIONS`. Use `socialKeys.itemAnyViewer(type, id)` and `socialKeys.commentsAnyViewer(type, id)` as prefixes when matching every viewer.

## Cache helpers (`api/cache.ts`)

- `updateFeedItemEverywhere(type, id, updater)` updates one item in the feed pages and the item queries. If `updater` returns `null`, the item is removed.
- `removeFeedItem(type, id)`.
- `mergeFeedItem(userId, item, allowInsert)` replaces an item in place, or prepends it when `allowInsert` is true.
- `getCachedFeedItem(userId, type, id)` and `isFeedItemLoaded(userId, type, id)`.
- `seedSocialItem(item, userId)` seeds the item query from the feed. The feed card calls it on press-in, so the item page renders immediately.
- `trimFeedCache(userId)` keeps only the first page (the web caches 50 items).
- `refreshFeedFirstPage(userId)` merges a fresh first page into the loaded pages after a realtime gap (one request) and resolves with the number of new items.
- `updateCommentEverywhere(commentId, updater)` and `findCachedComment(commentId)`.
- `areCommentsShown(type, id)` and `reloadComments(type, id)` (refetches the active comment queries).

## Writes (`api/actions.ts`)

These functions read the viewer from the auth store and keep every cached copy in sync:

- `toggleItemReaction(type, id, emoji)` and `toggleCommentReaction(commentId, emoji)` are optimistic. They roll back on failure and show the web error toast.
- `copyCouponToSlip(item)` shows the web toasts and resolves `true` when something was copied. The caller then navigates to `/`.
- `addSocialComment(type, id, content, parentId?, image?)` uploads the image, posts the comment, triggers Eniu, bumps the count and reloads the thread. It throws on failure.
- `publishPost(content, image?)` shows `Post opublikowany` and `publishStory(content, image?)` shows `Relacja opublikowana`. Both throw on failure.
- `triggerEniuBotReply(source, id, content, onSettled)`.

Every write goes through the RPCs: `create_social_post`, `add_social_comment`, `toggle_reaction`, `create_social_story` and `create_casino_social_share`. Images go to storage first. Direct table writes are revoked on the server.

## Images (`images.ts`)

- `compressSocialImage(uri, width, height)` runs the web pipeline (1280 px max, about 85 KB, 90 KB hard limit) with `expo-image-manipulator` and returns a `SocialImageAttachment` (`{ uri, width, height, sizeBytes }`). This replaces the web `Blob`.
- `uploadSocialImage(userId, image)` returns the storage path. `getSocialImageUrl(path)` returns the public URL.

## Pure logic (`lib/`)

- `content.ts`: `parseSocialContent`, `buildSocialContent` (the `[[img:path]]` marker).
- `contentTokens.ts`: tokenizes links and mentions, builds YouTube/Spotify embeds.
- `thread.ts`: `buildCommentTree`, `countComments`, `FlatComment`.
- `reactions.ts`: emoji, labels, totals and sorting.
- `feedReactions.ts`: count updates.
- `socialFormatters.ts`: Polish plurals and relative time.
- `routes.ts`: item path, comment target, `getInitialReactorsEmoji`, `getReactorsRouteParams` / `parseReactorsRouteParams`.
- `share.ts`: `shareSocialItem`, which shares `${env.webUrl}/social/<type>/<id>`.
- `copyCoupon.ts`, `eniu.ts`, `polishDay.ts`.

## Components for reuse

- `components/SocialFeedCard` takes `{ item, currentUserId, detail?, spaced? }`. Set `detail` on the item page: coupon legs stay open, the thread starts expanded and the card does not navigate. The card loads its comments with `socialCommentsQuery` and renders `CommentThread`.
- `components/SocialContentBlock` takes `{ content, imageAlt, itemKey, width? }` and renders text, links, mentions, the image (it opens `/sheets/image-viewer?uri=`) and embeds.
- Profile links prefetch on press-in with `prefetchPublicProfile(userId)` from `@/features/profile/api/profileQueries` (skipped for the viewer's own id). Comment authors in `CommentThread` should do the same. Mentions only carry a username, so they are not prefetched.
- Sheets: `/sheets/reactors` takes `postId | couponId | casinoShareId | commentId` and `initial` (see `getReactorsRouteParams`). `/sheets/image-viewer` takes `uri`.

## Compose, stories, comments and the item page

- `compose/PostComposer.tsx` is the compact "Co nowego?" trigger; `/sheets/compose-post` (`PostComposerSheet`) is the full composer. The draft lives in `postDraftStore` and survives closing the sheet.
- `stories/SocialStories.tsx` is the strip; `/sheets/compose-story` and `/sheets/story-viewer?index=` are the composer and the viewer.
- `comments/CommentThread.tsx` renders nested replies, comment reactions and the comment and reply inputs (images, mentions, Eniu through `addSocialComment`).
- `mentions/` holds the `search_mention_users` wrapper, the debounced autocomplete hook and the suggestion list.
- `item/SocialItemScreen.tsx` is `/social/:itemType/:itemId`: `SocialFeedCard` with `detail`, seeded from the feed.
