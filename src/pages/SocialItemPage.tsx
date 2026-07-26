import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchComments,
  fetchSocialFeedItem,
} from '@/features/social/api/social';
import { ReactorsDialog } from '@/features/social/components/ReactorsDialog';
import { SocialFeedCard } from '@/features/social/components/SocialFeedCard';
import {
  useFeedInteractions,
  type FeedInteractionsStore,
} from '@/features/social/hooks/useFeedInteractions';
import {
  getSocialItemCommentsTarget,
  isFeedItemType,
} from '@/features/social/routes';
import { usePageTitle } from '@/hooks/usePageTitle';
import type { SocialComment, SocialFeedItem } from '@/types/database';

const EMPTY_COMMENTS: SocialComment[] = [];

export default function SocialItemPage() {
  usePageTitle('Social');
  const { itemType: itemTypeParam, itemId } = useParams();
  const itemType = isFeedItemType(itemTypeParam) ? itemTypeParam : null;
  const { user } = useAuth();
  const [item, setItem] = useState<SocialFeedItem | null>(null);
  const [comments, setComments] = useState<SocialComment[]>(EMPTY_COMMENTS);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [loading, setLoading] = useState(true);

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

  // ── Feed interactions (comments, reactions, coupon copy) ──

  const commentsRef = useRef(comments);
  commentsRef.current = comments;

  const interactionsStore = useMemo<FeedInteractionsStore>(
    () => ({
      updateItem: (targetItemId, targetItemType, updater) => {
        setItem((current) =>
          current &&
          current.id === targetItemId &&
          current.item_type === targetItemType
            ? updater(current)
            : current,
        );
      },
      updateComment: (_targetItemId, commentId, updater) => {
        setComments((current) =>
          current.map((comment) =>
            comment.id === commentId ? updater(comment) : comment,
          ),
        );
      },
      findComment: (commentId) =>
        commentsRef.current.find((entry) => entry.id === commentId),
      reloadComments: () => loadCommentsForItem(),
    }),
    [loadCommentsForItem],
  );

  const {
    copyingCoupons,
    handleCopyCoupon,
    handleAddComment,
    handleToggleReaction,
    handleToggleCommentReaction,
    handleOpenItemReactors,
    handleOpenCommentReactors,
    reactorsDialogProps,
  } = useFeedInteractions(interactionsStore);

  const isAko =
    item?.item_type === 'coupon' && item.legs !== null && item.legs.length > 1;

  return (
    <div className="social-mobile-page h-safe-screen bg-background overflow-hidden flex flex-col">
      <Navbar />
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div
          data-testid="social-item-content"
          className="social-facebook-feed w-full max-w-3xl mx-auto px-0 pt-2 pb-[var(--mobile-bottom-nav-scroll-padding)] sm:px-4 sm:py-4"
        >
          <Link
            to="/social"
            className="mb-3 inline-flex items-center gap-1 px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:mb-4 sm:px-0"
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
            <div className="mx-3 rounded-xl border border-border bg-card p-8 text-center sm:mx-0">
              <p className="text-lg font-semibold">Nie znaleziono wpisu</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Ten wpis mógł zostać usunięty albo nie masz do niego dostępu.
              </p>
            </div>
          )}
        </div>
      </div>
      <ReactorsDialog {...reactorsDialogProps} />
    </div>
  );
}
