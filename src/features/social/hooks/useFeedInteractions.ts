import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useAuth } from '@/contexts/AuthContext';
import { useCoupon } from '@/contexts/CouponContext';
import { fetchBetsByIds } from '@/features/home/api/bets';
import { addComment, toggleReaction } from '@/features/social/api/social';
import { buildSocialContent } from '@/features/social/content';
import { buildCouponItemsFromSocial } from '@/features/social/copyCoupon';
import { uploadSocialImage } from '@/features/social/images';
import { updateReactionCounts } from '@/features/social/lib/feedReactions';
import { triggerEniuBotReply } from '@/features/social/lib/eniuTrigger';
import { formatEventsCount } from '@/features/social/lib/socialFormatters';
import {
  REACTION_TYPES,
  type ReactionCounts,
  type ReactionType,
} from '@/features/social/reactions';
import { getSocialItemCommentsTarget } from '@/features/social/routes';
import type {
  FeedItemType,
  ReactionEmoji,
  SocialComment,
  SocialFeedItem,
} from '@/types/database';

export interface ReactorsTarget {
  postId?: string;
  couponId?: string;
  casinoShareId?: string;
  commentId?: string;
}

/**
 * The one seam a page must satisfy to host feed interactions:
 * how items and comments are stored (a list, a map, a single item)
 * stays the page's business; everything else lives behind this hook.
 *
 * Memoize the store (useMemo) so handler identities stay stable.
 */
export interface FeedInteractionsStore {
  updateItem: (
    itemId: string,
    itemType: FeedItemType,
    updater: (item: SocialFeedItem) => SocialFeedItem,
  ) => void;
  updateComment: (
    itemId: string,
    commentId: string,
    updater: (comment: SocialComment) => SocialComment,
  ) => void;
  findComment: (commentId: string) => SocialComment | undefined;
  reloadComments: (itemId: string, itemType: FeedItemType) => Promise<void>;
}

export function useFeedInteractions(store: FeedInteractionsStore) {
  const { user } = useAuth();
  const { addItems, setPreferredCouponType } = useCoupon();
  const navigate = useNavigate();

  const [copyingCoupons, setCopyingCoupons] = useState<Set<string>>(new Set());
  const [reactorsOpen, setReactorsOpen] = useState(false);
  const [reactorsEmoji, setReactorsEmoji] = useState<ReactionType | null>(null);
  const [reactorsTarget, setReactorsTarget] = useState<ReactorsTarget | null>(
    null,
  );

  const setCouponCopying = (couponId: string, isCopying: boolean) => {
    setCopyingCoupons((prev) => {
      const next = new Set(prev);
      if (isCopying) next.add(couponId);
      else next.delete(couponId);
      return next;
    });
  };

  const handleCopyCoupon = useCallback(
    async (item: SocialFeedItem) => {
      const legs = item.legs ?? [];
      const betIds = Array.from(
        new Set(
          legs
            .map((leg) => leg.bet_id)
            .filter((betId): betId is string => Boolean(betId)),
        ),
      );

      if (betIds.length === 0) {
        toast.error('Ten kupon nie zawiera zdarzeń możliwych do skopiowania');
        return;
      }

      setCouponCopying(item.id, true);

      try {
        const bets = await fetchBetsByIds(betIds);
        const { items, skippedCount } = buildCouponItemsFromSocial({
          legs,
          bets,
        });

        if (items.length === 0) {
          toast.error(
            'Wszystkie zdarzenia z tego kuponu są już niedostępne lub rozliczone',
          );
          return;
        }

        addItems(items);
        setPreferredCouponType(items.length > 1 ? 'ako' : 'single');

        if (skippedCount > 0) {
          toast.success(
            `Skopiowano ${formatEventsCount(items.length)}, pominięto ${formatEventsCount(skippedCount)}`,
          );
        } else {
          toast.success(`Skopiowano kupon: ${formatEventsCount(items.length)}`);
        }

        navigate('/');
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Nie udało się skopiować kuponu';
        toast.error(message);
      } finally {
        setCouponCopying(item.id, false);
      }
    },
    [addItems, navigate, setPreferredCouponType],
  );

  const handleAddComment = useCallback(
    async (
      itemId: string,
      itemType: FeedItemType,
      content: string,
      parentId?: string,
      imageBlob?: Blob,
    ) => {
      if (!user) return;
      let imagePath: string | undefined;
      if (imageBlob) {
        imagePath = await uploadSocialImage(user.id, imageBlob);
      }

      const payload = buildSocialContent(content, imagePath);
      const commentId = await addComment({
        userId: user.id,
        content: payload,
        ...getSocialItemCommentsTarget(itemType, itemId),
        parentId,
      });

      triggerEniuBotReply('comment', commentId, content, () =>
        store.reloadComments(itemId, itemType),
      );

      store.updateItem(itemId, itemType, (item) => ({
        ...item,
        comment_count: (item.comment_count ?? 0) + 1,
      }));

      await store.reloadComments(itemId, itemType);
    },
    [store, user],
  );

  const handleToggleReaction = useCallback(
    async (itemId: string, itemType: FeedItemType, emoji: ReactionType) => {
      if (!user) return;
      const nextReaction = await toggleReaction({
        userId: user.id,
        emoji: emoji as ReactionEmoji,
        ...getSocialItemCommentsTarget(itemType, itemId),
      });

      store.updateItem(itemId, itemType, (item) => ({
        ...item,
        reactions: updateReactionCounts(
          item.reactions,
          item.my_reaction,
          nextReaction as ReactionEmoji | null,
        ),
        my_reaction: nextReaction as ReactionEmoji | null,
      }));
    },
    [store, user],
  );

  const handleToggleCommentReaction = useCallback(
    async (
      commentId: string,
      emoji: ReactionType,
      itemId: string,
      _itemType: FeedItemType,
    ) => {
      if (!user) return;
      const nextReaction = await toggleReaction({
        userId: user.id,
        emoji: emoji as ReactionEmoji,
        commentId,
      });

      store.updateComment(itemId, commentId, (comment) => ({
        ...comment,
        reactions: updateReactionCounts(
          comment.reactions,
          comment.my_reaction,
          nextReaction as ReactionEmoji | null,
        ),
        my_reaction: nextReaction as ReactionEmoji | null,
      }));
    },
    [store, user],
  );

  const handleOpenItemReactors = useCallback((item: SocialFeedItem) => {
    const firstReactionType =
      REACTION_TYPES.find((type) => (item.reactions?.[type] ?? 0) > 0) ?? null;

    setReactorsTarget(getSocialItemCommentsTarget(item.item_type, item.id));
    setReactorsEmoji(firstReactionType);
    setReactorsOpen(true);
  }, []);

  const handleOpenCommentReactors = useCallback(
    (commentId: string) => {
      const comment = store.findComment(commentId);
      const firstReactionType =
        REACTION_TYPES.find(
          (type) =>
            ((comment?.reactions as ReactionCounts | null)?.[type] ?? 0) > 0,
        ) ?? null;

      setReactorsTarget({ commentId });
      setReactorsEmoji(firstReactionType);
      setReactorsOpen(true);
    },
    [store],
  );

  return {
    copyingCoupons,
    handleCopyCoupon,
    handleAddComment,
    handleToggleReaction,
    handleToggleCommentReaction,
    handleOpenItemReactors,
    handleOpenCommentReactors,
    reactorsDialogProps: {
      open: reactorsOpen,
      onOpenChange: setReactorsOpen,
      target: reactorsTarget,
      initialEmoji: reactorsEmoji,
    },
  };
}
