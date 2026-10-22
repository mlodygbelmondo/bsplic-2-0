import { onlineManager } from '@tanstack/react-query';

import { useAuthStore } from '@/features/auth/auth-store';
import { couponActions } from '@/features/coupon/coupon-store';
import { OFFLINE_WRITE_MESSAGE } from '@/lib/connectivity';
import { getErrorMessage } from '@/lib/errors';
import { queryClient } from '@/lib/query-client';
import { toast } from '@/lib/toast';
import type { FeedItemType, ReactionEmoji, SocialFeedItem } from '@/types/database';
import { buildSocialContent } from '../lib/content';
import { buildCouponItemsFromSocial, getCopyableBetIds } from '../lib/copyCoupon';
import { mentionsEniu } from '../lib/eniu';
import { applyReaction, predictToggledReaction } from '../lib/feedReactions';
import { getSocialItemCommentsTarget } from '../lib/routes';
import { formatEventsCount } from '../lib/socialFormatters';
import { uploadSocialImage, type SocialImageAttachment } from '../images';
import {
  findCachedComment,
  getCachedFeedItem,
  reloadComments,
  trimFeedCache,
  updateCommentEverywhere,
  updateFeedItemEverywhere,
} from './cache';
import { socialKeys } from './keys';
import {
  addComment,
  createPost,
  createSocialStory,
  fetchBetsByIds,
  respondAsEniu,
  toggleReaction,
} from './social';

/**
 * Social writes shared by the feed, the item page, the comment thread and the
 * composers (web `useFeedInteractions` + `SocialPage` handlers). They read the
 * viewer from the auth store and update every cached copy.
 */

const viewerId = () => useAuthStore.getState().user?.id ?? null;

function assertOnline() {
  if (!onlineManager.isOnline()) throw new Error(OFFLINE_WRITE_MESSAGE);
}

// ── Reactions ─────────────────────────────────────────────────

const pendingReactions = new Set<string>();

/**
 * Optimistic reaction toggle on a feed item: the counts move at once, the
 * server answer reconciles them, an error rolls them back. Taps are ignored
 * while the previous toggle for the same target is in flight.
 */
export async function toggleItemReaction(itemType: FeedItemType, itemId: string, emoji: ReactionEmoji) {
  const userId = viewerId();
  if (!userId) return;
  if (!onlineManager.isOnline()) {
    toast.error(OFFLINE_WRITE_MESSAGE);
    return;
  }
  const key = `item:${itemType}:${itemId}`;
  if (pendingReactions.has(key)) return;
  pendingReactions.add(key);

  const snapshot = getCachedFeedItem(userId, itemType, itemId);
  const optimistic = predictToggledReaction(snapshot?.my_reaction ?? null, emoji);
  const original = snapshot?.my_reaction ?? null;
  const moveFrom = (from: ReactionEmoji | null, to: ReactionEmoji | null) =>
    updateFeedItemEverywhere(itemType, itemId, (item) =>
      item.my_reaction === from && from !== to ? applyReaction(item, to) : item,
    );

  moveFrom(original, optimistic);
  const target = getSocialItemCommentsTarget(itemType, itemId);
  try {
    const next = await toggleReaction({ userId, emoji, ...target });
    moveFrom(optimistic, next);
    // The cached "who reacted" list no longer matches.
    queryClient.removeQueries({ queryKey: socialKeys.reactors(target) });
  } catch (error) {
    moveFrom(optimistic, original);
    toast.error(getErrorMessage(error, 'Nie udało się zapisać reakcji'));
  } finally {
    pendingReactions.delete(key);
  }
}

/** Same as `toggleItemReaction`, for a comment in any cached comment list. */
export async function toggleCommentReaction(commentId: string, emoji: ReactionEmoji) {
  const userId = viewerId();
  if (!userId) return;
  if (!onlineManager.isOnline()) {
    toast.error(OFFLINE_WRITE_MESSAGE);
    return;
  }
  const key = `comment:${commentId}`;
  if (pendingReactions.has(key)) return;
  pendingReactions.add(key);

  const original = findCachedComment(commentId)?.my_reaction ?? null;
  const optimistic = predictToggledReaction(original, emoji);
  const moveFrom = (from: ReactionEmoji | null, to: ReactionEmoji | null) =>
    updateCommentEverywhere(commentId, (comment) =>
      comment.my_reaction === from && from !== to ? applyReaction(comment, to) : comment,
    );

  moveFrom(original, optimistic);
  try {
    const next = await toggleReaction({ userId, emoji, commentId });
    moveFrom(optimistic, next);
    queryClient.removeQueries({ queryKey: socialKeys.reactors({ commentId }) });
  } catch (error) {
    moveFrom(optimistic, original);
    toast.error(getErrorMessage(error, 'Nie udało się zapisać reakcji'));
  } finally {
    pendingReactions.delete(key);
  }
}

// ── Coupon copy ───────────────────────────────────────────────

/**
 * Copies a shared coupon's open legs into the slip (web `handleCopyCoupon`).
 * Resolves true when something was copied; the caller then opens the home tab.
 */
export async function copyCouponToSlip(item: SocialFeedItem): Promise<boolean> {
  const legs = item.legs ?? [];
  const betIds = getCopyableBetIds(legs);
  if (betIds.length === 0) {
    toast.error('Ten kupon nie zawiera zdarzeń możliwych do skopiowania');
    return false;
  }

  try {
    const bets = await fetchBetsByIds(betIds);
    const { items, skippedCount } = buildCouponItemsFromSocial({ legs, bets });
    if (items.length === 0) {
      toast.error('Wszystkie zdarzenia z tego kuponu są już niedostępne lub rozliczone');
      return false;
    }

    couponActions.addItems(items);
    couponActions.setPreferredCouponType(items.length > 1 ? 'ako' : 'single');
    if (skippedCount > 0) {
      toast.success(`Skopiowano ${formatEventsCount(items.length)}, pominięto ${formatEventsCount(skippedCount)}`);
    } else {
      toast.success(`Skopiowano kupon: ${formatEventsCount(items.length)}`);
    }
    return true;
  } catch (error) {
    toast.error(getErrorMessage(error, 'Nie udało się skopiować kuponu'));
    return false;
  }
}

// ── Eniu ──────────────────────────────────────────────────────

/** Fire-and-forget Eniu reply when the content mentions him (web `lib/eniuTrigger.ts`). */
export function triggerEniuBotReply(
  source: 'post' | 'comment',
  sourceId: string,
  content: string,
  onSettled: () => Promise<unknown>,
) {
  if (!mentionsEniu(content)) return;

  void respondAsEniu(source, sourceId)
    .then((result) => {
      if (!result.ok) console.error('Eniu failed to respond', result.error || 'Eniu nie odpowiedział');
      return onSettled();
    })
    .catch((error: unknown) => {
      console.error('Eniu failed to respond', error instanceof Error ? error.message : 'Eniu nie odpowiedział');
    });
}

// ── Comments, posts, stories ──────────────────────────────────

/**
 * Adds a comment or reply (web `handleAddComment`): uploads the image, posts
 * the comment, triggers Eniu, bumps the count and reloads the thread. Throws
 * on failure so the input keeps its draft.
 */
export async function addSocialComment(
  itemType: FeedItemType,
  itemId: string,
  content: string,
  parentId?: string,
  image?: SocialImageAttachment,
) {
  const userId = viewerId();
  if (!userId) return;
  assertOnline();
  const imagePath = image ? await uploadSocialImage(userId, image) : undefined;
  const commentId = await addComment({
    userId,
    content: buildSocialContent(content, imagePath),
    ...getSocialItemCommentsTarget(itemType, itemId),
    parentId,
  });

  triggerEniuBotReply('comment', commentId, content, () => reloadComments(itemType, itemId));
  updateFeedItemEverywhere(itemType, itemId, (item) => ({ ...item, comment_count: (item.comment_count ?? 0) + 1 }));
  await reloadComments(itemType, itemId);
}

/**
 * Publishes a post (web `handleCreatePost`): upload, create, reload the feed
 * from its first page, trigger Eniu, toast. Throws on failure.
 */
export async function publishPost(content: string, image?: SocialImageAttachment) {
  const userId = viewerId();
  if (!userId) return;
  assertOnline();
  const imagePath = image ? await uploadSocialImage(userId, image) : undefined;
  const postId = await createPost(userId, buildSocialContent(content, imagePath));
  trimFeedCache(userId);
  await queryClient.refetchQueries({ queryKey: socialKeys.feed(userId) });
  triggerEniuBotReply('post', postId, content, () => reloadComments('post', postId));
  toast.success('Post opublikowany');
}

/** Publishes a story (web `handleCreateStory`): upload, create, reload stories, toast. Throws on failure. */
export async function publishStory(content: string, image?: SocialImageAttachment) {
  const userId = viewerId();
  if (!userId) return;
  assertOnline();
  const imagePath = image ? await uploadSocialImage(userId, image) : undefined;
  await createSocialStory(userId, buildSocialContent(content, imagePath));
  await queryClient.refetchQueries({ queryKey: socialKeys.stories });
  toast.success('Relacja opublikowana');
}
