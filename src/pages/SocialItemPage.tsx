import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { useCoupon } from '@/contexts/CouponContext';
import { buildCouponItemsFromSocial } from '@/features/social/copyCoupon';
import { fetchBetsByIds } from '@/features/home/api/bets';
import {
  addComment,
  fetchComments,
  fetchSocialFeedItem,
  toggleReaction,
} from '@/features/social/api/social';
import { respondAsEniu } from '@/features/social/api/eniuBot';
import { mentionsEniu } from '@/features/social/eniuBot';
import { uploadSocialImage } from '@/features/social/images';
import { updateReactionCounts } from '@/features/social/lib/feedReactions';
import { formatEventsCount } from '@/features/social/lib/socialFormatters';
import { ReactorsDialog } from '@/features/social/components/ReactorsDialog';
import { SocialFeedCard } from '@/features/social/components/SocialFeedCard';
import {
  getSocialItemCommentsTarget,
  isFeedItemType,
} from '@/features/social/routes';
import { buildSocialContent } from '@/features/social/content';
import { usePageTitle } from '@/hooks/usePageTitle';
import {
  REACTION_TYPES,
  type ReactionCounts,
  type ReactionType,
} from '@/features/social/reactions';
import type {
  FeedItemType,
  ReactionEmoji,
  SocialComment,
  SocialFeedItem,
} from '@/types/database';

const EMPTY_COMMENTS: SocialComment[] = [];

export default function SocialItemPage() {
  usePageTitle('Social');
  const { itemType: itemTypeParam, itemId } = useParams();
  const itemType = isFeedItemType(itemTypeParam) ? itemTypeParam : null;
  const { user } = useAuth();
  const { addItems, setPreferredCouponType } = useCoupon();
  const navigate = useNavigate();
  const [item, setItem] = useState<SocialFeedItem | null>(null);
  const [comments, setComments] = useState<SocialComment[]>(EMPTY_COMMENTS);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copyingCoupons, setCopyingCoupons] = useState<Set<string>>(new Set());
  const [reactorsOpen, setReactorsOpen] = useState(false);
  const [reactorsEmoji, setReactorsEmoji] = useState<ReactionType | null>(null);
  const [reactorsTarget, setReactorsTarget] = useState<{
    postId?: string;
    couponId?: string;
    casinoShareId?: string;
    commentId?: string;
  } | null>(null);

  const loadCommentsForItem = useCallback(async () => {
    if (!itemType || !itemId) return;
    setCommentsLoading(true);
    try {
      const data = await fetchComments(
        getSocialItemCommentsTarget(itemType, itemId),
        user?.id,
      );
      setComments(data);
      setCommentsLoaded(true);
      setItem((current) =>
        current
          ? {
              ...current,
              comment_count: data.length,
            }
          : current,
      );
    } finally {
      setCommentsLoading(false);
    }
  }, [itemId, itemType, user?.id]);

  useEffect(() => {
    if (!itemType || !itemId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadItem = async () => {
      setLoading(true);
      try {
        const nextItem = await fetchSocialFeedItem(itemType, itemId, user?.id);
        if (cancelled) return;

        setItem(nextItem);
        if (!nextItem) return;

        const nextComments = await fetchComments(
          getSocialItemCommentsTarget(itemType, itemId),
          user?.id,
        );
        if (cancelled) return;

        setComments(nextComments);
        setCommentsLoaded(true);
        setItem({
          ...nextItem,
          comment_count: nextComments.length,
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Nie udało się załadować wpisu';
        toast.error(message);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadItem();

    return () => {
      cancelled = true;
    };
  }, [itemId, itemType, user?.id]);

  const setCouponCopying = (couponId: string, isCopying: boolean) => {
    setCopyingCoupons((prev) => {
      const next = new Set(prev);
      if (isCopying) next.add(couponId);
      else next.delete(couponId);
      return next;
    });
  };

  const handleCopyCoupon = async (selectedItem: SocialFeedItem) => {
    const legs = selectedItem.legs ?? [];
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

    setCouponCopying(selectedItem.id, true);

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
      setCouponCopying(selectedItem.id, false);
    }
  };

  const handleAddComment = useCallback(
    async (
      selectedItemId: string,
      selectedItemType: FeedItemType,
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
        postId: selectedItemType === 'post' ? selectedItemId : undefined,
        couponId: selectedItemType === 'coupon' ? selectedItemId : undefined,
        casinoShareId:
          selectedItemType === 'casino' ? selectedItemId : undefined,
        parentId,
      });

      if (mentionsEniu(content)) {
        void respondAsEniu('comment', commentId)
          .then((result) => {
            if (!result.ok) {
              console.error(
                'Eniu failed to respond',
                result.error || 'Eniu nie odpowiedział',
              );
            }
            return loadCommentsForItem();
          })
          .catch((error) => {
            const message =
              error instanceof Error ? error.message : 'Eniu nie odpowiedział';
            console.error('Eniu failed to respond', message);
          });
      }

      setItem((current) =>
        current
          ? {
              ...current,
              comment_count: (current.comment_count ?? 0) + 1,
            }
          : current,
      );

      await loadCommentsForItem();
    },
    [loadCommentsForItem, user],
  );

  const handleToggleReaction = useCallback(
    async (
      selectedItemId: string,
      selectedItemType: FeedItemType,
      emoji: ReactionType,
    ) => {
      if (!user) return;
      const nextReaction = await toggleReaction({
        userId: user.id,
        emoji: emoji as ReactionEmoji,
        postId: selectedItemType === 'post' ? selectedItemId : undefined,
        couponId: selectedItemType === 'coupon' ? selectedItemId : undefined,
        casinoShareId:
          selectedItemType === 'casino' ? selectedItemId : undefined,
      });

      setItem((current) =>
        current && current.id === selectedItemId
          ? {
              ...current,
              reactions: updateReactionCounts(
                current.reactions,
                current.my_reaction,
                nextReaction as ReactionEmoji | null,
              ),
              my_reaction: nextReaction as ReactionEmoji | null,
            }
          : current,
      );
    },
    [user],
  );

  const handleToggleCommentReaction = useCallback(
    async (
      commentId: string,
      emoji: ReactionType,
      _selectedItemId: string,
      _selectedItemType: FeedItemType,
    ) => {
      if (!user) return;
      const nextReaction = await toggleReaction({
        userId: user.id,
        emoji: emoji as ReactionEmoji,
        commentId,
      });

      setComments((current) =>
        current.map((comment) =>
          comment.id === commentId
            ? {
                ...comment,
                reactions: updateReactionCounts(
                  comment.reactions,
                  comment.my_reaction,
                  nextReaction as ReactionEmoji | null,
                ),
                my_reaction: nextReaction as ReactionEmoji | null,
              }
            : comment,
        ),
      );
    },
    [user],
  );

  const handleOpenItemReactors = useCallback((selectedItem: SocialFeedItem) => {
    const firstReactionType =
      REACTION_TYPES.find(
        (type) => (selectedItem.reactions?.[type] ?? 0) > 0,
      ) ?? null;

    setReactorsTarget(
      getSocialItemCommentsTarget(selectedItem.item_type, selectedItem.id),
    );
    setReactorsEmoji(firstReactionType);
    setReactorsOpen(true);
  }, []);

  const handleOpenCommentReactors = useCallback(
    (commentId: string) => {
      const comment = comments.find((entry) => entry.id === commentId);
      const firstReactionType =
        REACTION_TYPES.find(
          (type) =>
            ((comment?.reactions as ReactionCounts | null)?.[type] ?? 0) > 0,
        ) ?? null;

      setReactorsTarget({ commentId });
      setReactorsEmoji(firstReactionType);
      setReactorsOpen(true);
    },
    [comments],
  );

  const isAko =
    item?.item_type === 'coupon' && item.legs !== null && item.legs.length > 1;

  return (
    <div className="h-safe-screen bg-background overflow-hidden flex flex-col">
      <Navbar />
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-4">
          <Link
            to="/social"
            className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Social
          </Link>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Ładowanie wpisu...
            </div>
          ) : item ? (
            <SocialFeedCard
              item={item}
              expandedCoupons={
                new Set(item.item_type === 'coupon' ? [item.id] : [])
              }
              copyingCoupons={copyingCoupons}
              comments={comments}
              commentsLoaded={commentsLoaded}
              commentsLoading={commentsLoading}
              isLoggedIn={!!user}
              onToggleCoupon={() => undefined}
              onCopyCoupon={handleCopyCoupon}
              onToggleReaction={handleToggleReaction}
              onFirstExpandComments={loadCommentsForItem}
              onAddComment={handleAddComment}
              onToggleCommentReaction={handleToggleCommentReaction}
              isAko={isAko}
              currentUserId={user?.id}
              defaultCommentsExpanded
              onOpenItemReactors={handleOpenItemReactors}
              onOpenCommentReactors={handleOpenCommentReactors}
            />
          ) : (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <p className="text-lg font-semibold">Nie znaleziono wpisu</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Ten wpis mógł zostać usunięty albo nie masz do niego dostępu.
              </p>
            </div>
          )}
        </div>
      </div>
      <ReactorsDialog
        open={reactorsOpen}
        onOpenChange={setReactorsOpen}
        target={reactorsTarget}
        initialEmoji={reactorsEmoji}
      />
    </div>
  );
}
