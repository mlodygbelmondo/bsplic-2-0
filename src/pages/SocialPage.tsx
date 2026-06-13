import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import {
  SocialFeedItem,
  SocialComment,
  ReactionEmoji,
  FeedItemType,
} from '@/types/database';
import { cn } from '@/lib/utils';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SectionLoader } from '@/components/SectionLoader';
import { ArrowUp, Loader2 } from 'lucide-react';
import { useCoupon } from '@/contexts/CouponContext';
import { buildCouponItemsFromSocial } from '@/features/social/copyCoupon';
import { fetchBetsByIds } from '@/features/home/api/bets';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { PostComposer } from '@/features/social/components/PostComposer';
import { SocialFeedCard } from '@/features/social/components/SocialFeedCard';
import { buildSocialContent } from '@/features/social/content';
import { respondAsEniu } from '@/features/social/api/eniuBot';
import { mentionsEniu } from '@/features/social/eniuBot';
import { uploadSocialImage } from '@/features/social/images';
import { ReactorsDialog } from '@/features/social/components/ReactorsDialog';
import {
  fetchSocialFeed,
  fetchSocialFeedItem,
  createPost,
  fetchComments,
  addComment,
  toggleReaction,
} from '@/features/social/api/social';
import { useSocialRealtimeFeed } from '@/features/social/hooks/useSocialRealtimeFeed';
import { updateReactionCounts } from '@/features/social/lib/feedReactions';
import { formatEventsCount } from '@/features/social/lib/socialFormatters';
import { REACTION_TYPES } from '@/features/social/reactions';
import { getSocialItemPath } from '@/features/social/routes';
import { usePageTitle } from '@/hooks/usePageTitle';
import type { ReactionType, ReactionCounts } from '@/features/social/reactions';

const SOCIAL_FEED_PAGE_SIZE = 50;
const SOCIAL_FEED_PREFETCH_ROOT_MARGIN = '1200px 0px';
const EMPTY_COMMENTS: SocialComment[] = [];

type FeedFilter = 'all' | 'coupon' | 'post' | 'casino';

const FILTER_EMPTY_TITLES: Record<Exclude<FeedFilter, 'all'>, string> = {
  coupon: 'Brak kuponów w tej chwili',
  post: 'Brak postów w tej chwili',
  casino: 'Brak aktywności kasyna w tej chwili',
};

function parseFeedFilter(value: string | null): FeedFilter {
  return value === 'coupon' || value === 'post' || value === 'casino'
    ? value
    : 'all';
}
function mergeFeedItem(
  items: SocialFeedItem[],
  nextItem: SocialFeedItem,
  allowInsert: boolean,
): SocialFeedItem[] {
  const existingIndex = items.findIndex(
    (item) =>
      item.id === nextItem.id && item.item_type === nextItem.item_type,
  );

  if (existingIndex === -1) {
    return allowInsert ? [nextItem, ...items] : items;
  }

  return items.map((item, index) =>
    index === existingIndex ? nextItem : item,
  );
}

export default function SocialPage() {
  usePageTitle('Social');
  const [feedItems, setFeedItems] = useState<SocialFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [expandedCoupons, setExpandedCoupons] = useState<Set<string>>(
    new Set(),
  );
  const [copyingCoupons, setCopyingCoupons] = useState<Set<string>>(new Set());
  const [commentsMap, setCommentsMap] = useState<
    Record<string, SocialComment[]>
  >({});
  const [commentsLoadedMap, setCommentsLoadedMap] = useState<
    Record<string, boolean>
  >({});
  const [commentsLoadingMap, setCommentsLoadingMap] = useState<
    Record<string, boolean>
  >({});
  const { addItems, setPreferredCouponType } = useCoupon();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);

  const feedFilter = parseFeedFilter(searchParams.get('filter'));
  const setFeedFilter = useCallback(
    (filter: FeedFilter) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          if (filter === 'all') {
            next.delete('filter');
          } else {
            next.set('filter', filter);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );
  const [highlightedItemKey, setHighlightedItemKey] = useState<string | null>(
    null,
  );
  const [reactorsOpen, setReactorsOpen] = useState(false);
  const [reactorsEmoji, setReactorsEmoji] = useState<ReactionType | null>(null);
  const [reactorsTarget, setReactorsTarget] = useState<{
    postId?: string;
    couponId?: string;
    casinoShareId?: string;
    commentId?: string;
  } | null>(null);

  const targetItemTypeParam = searchParams.get('itemType');
  const targetItemIdParam = searchParams.get('itemId');
  const targetItemType =
    targetItemTypeParam === 'post' ||
    targetItemTypeParam === 'coupon' ||
    targetItemTypeParam === 'casino'
      ? targetItemTypeParam
      : null;
  const targetItemId =
    targetItemIdParam && targetItemIdParam.length > 0
      ? targetItemIdParam
      : null;

  const filteredFeedItems = useMemo(() => {
    if (feedFilter === 'all') return feedItems;
    return feedItems.filter((item) => item.item_type === feedFilter);
  }, [feedItems, feedFilter]);
  const isFilteredEmpty =
    feedFilter !== 'all' && feedItems.length > 0 && filteredFeedItems.length === 0;
  const emptyStateTitle = isFilteredEmpty
    ? FILTER_EMPTY_TITLES[feedFilter]
    : 'Brak aktywności';
  const emptyStateDescription = isFilteredEmpty
    ? 'Zmień filtr, aby zobaczyć pozostałe wpisy.'
    : 'Nikt jeszcze nic nie opublikował.';

  const loadFeed = useCallback(async () => {
    setLoading(true);
    setOffset(0);
    setHasMore(true);
    try {
      const data = await fetchSocialFeed(SOCIAL_FEED_PAGE_SIZE, 0, user?.id);
      setFeedItems((currentItems) => {
        if (!targetItemType || !targetItemId) return data;

        const targetItem = currentItems.find(
          (item) =>
            item.item_type === targetItemType && item.id === targetItemId,
        );
        if (!targetItem) return data;

        const feedContainsTarget = data.some(
          (item) =>
            item.item_type === targetItemType && item.id === targetItemId,
        );
        return feedContainsTarget ? data : [targetItem, ...data];
      });
      setHasMore(data.length === SOCIAL_FEED_PAGE_SIZE);
      setOffset(data.length);
      setCommentsMap({});
      setCommentsLoadedMap({});
      setCommentsLoadingMap({});
    } finally {
      setLoading(false);
    }
  }, [targetItemId, targetItemType, user?.id]);

  const loadMoreFeed = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      const data = await fetchSocialFeed(
        SOCIAL_FEED_PAGE_SIZE,
        offset,
        user?.id,
      );
      setFeedItems((prev) => [...prev, ...data]);
      setOffset((prev) => prev + data.length);
      setHasMore(data.length === SOCIAL_FEED_PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loading, loadingMore, offset, user?.id]);

  const refreshFeedItem = useCallback(
    async (
      itemType: FeedItemType,
      itemId: string,
      options: { allowInsert?: boolean } = {},
    ) => {
      const item = await fetchSocialFeedItem(itemType, itemId, user?.id);
      if (!item) {
        setFeedItems((prev) =>
          prev.filter(
            (feedItem) =>
              feedItem.id !== itemId || feedItem.item_type !== itemType,
          ),
        );
        return;
      }
      setFeedItems((prev) =>
        mergeFeedItem(prev, item, options.allowInsert === true),
      );
    },
    [user?.id],
  );

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    if (!targetItemType || !targetItemId) return;

    let cancelled = false;

    const ensureTargetItemVisible = async () => {
      setFeedFilter('all');

      try {
        const item = await fetchSocialFeedItem(
          targetItemType,
          targetItemId,
          user?.id,
        );
        if (!item || cancelled) return;

        setFeedItems((prev) => {
          const exists = prev.some(
            (feedItem) =>
              feedItem.id === item.id && feedItem.item_type === item.item_type,
          );
          if (exists) return prev;
          return [item, ...prev];
        });

        setHighlightedItemKey(`${item.item_type}-${item.id}`);
      } catch {
        // no-op, social feed still works without deep-link preload
      }
    };

    void ensureTargetItemVisible();

    return () => {
      cancelled = true;
    };
  }, [setFeedFilter, targetItemId, targetItemType, user?.id]);

  useEffect(() => {
    if (!highlightedItemKey) return;

    const element = document.getElementById(
      `social-item-${highlightedItemKey}`,
    );
    if (!element) return;

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const timeout = window.setTimeout(() => {
      setHighlightedItemKey((current) =>
        current === highlightedItemKey ? null : current,
      );
    }, 3000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [highlightedItemKey, filteredFeedItems.length]);

  useEffect(() => {
    if (loading || !hasMore || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const sentinel = document.getElementById('social-feed-sentinel');
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const isVisible = entries.some((entry) => entry.isIntersecting);
        if (isVisible) {
          void loadMoreFeed();
        }
      },
      {
        root: null,
        rootMargin: SOCIAL_FEED_PREFETCH_ROOT_MARGIN,
        threshold: 0,
      },
    );

    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [hasMore, loading, loadMoreFeed, filteredFeedItems.length]);

  // ── Coupon helpers ─────────────────────────────────────────

  const toggleCoupon = (couponId: string) => {
    setExpandedCoupons((prev) => {
      const next = new Set(prev);
      if (next.has(couponId)) next.delete(couponId);
      else next.add(couponId);
      return next;
    });
  };

  const isAko = (item: SocialFeedItem) =>
    item.item_type === 'coupon' && item.legs !== null && item.legs.length > 1;

  const setCouponCopying = (couponId: string, isCopying: boolean) => {
    setCopyingCoupons((prev) => {
      const next = new Set(prev);
      if (isCopying) next.add(couponId);
      else next.delete(couponId);
      return next;
    });
  };

  const handleCopyCoupon = async (item: SocialFeedItem) => {
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
  };

  // ── Post creation ──────────────────────────────────────────

  const handleCreatePost = async (content: string, imageBlob?: Blob) => {
    if (!user) return;
    let imagePath: string | undefined;
    if (imageBlob) {
      imagePath = await uploadSocialImage(user.id, imageBlob);
    }

    const payload = buildSocialContent(content, imagePath);
    const postId = await createPost(user.id, payload);
    await loadFeed();
    if (mentionsEniu(content)) {
      void respondAsEniu('post', postId)
        .then((result) => {
          if (!result.ok) {
            console.error(
              'Eniu failed to respond',
              result.error || 'Eniu nie odpowiedział',
            );
          }
          return loadComments(postId, 'post');
        })
        .catch((error) => {
          const message =
            error instanceof Error ? error.message : 'Eniu nie odpowiedział';
          console.error('Eniu failed to respond', message);
        });
    }
    toast.success('Post opublikowany');
  };

  // ── Comments ───────────────────────────────────────────────

  const loadComments = useCallback(
    async (itemId: string, itemType: FeedItemType) => {
      setCommentsLoadingMap((prev) => ({ ...prev, [itemId]: true }));
      try {
        const target =
          itemType === 'post'
            ? { postId: itemId }
            : itemType === 'coupon'
              ? { couponId: itemId }
              : { casinoShareId: itemId };
        const data = await fetchComments(target, user?.id);
        setCommentsMap((prev) => ({ ...prev, [itemId]: data }));
        setCommentsLoadedMap((prev) => ({ ...prev, [itemId]: true }));

        setFeedItems((prev) =>
          prev.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  comment_count: data.length,
                }
              : item,
          ),
        );
      } finally {
        setCommentsLoadingMap((prev) => ({ ...prev, [itemId]: false }));
      }
    },
    [user?.id],
  );

  useSocialRealtimeFeed({
    feedItems,
    commentsLoadedMap,
    refreshFeedItem,
    loadComments,
  });

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
        postId: itemType === 'post' ? itemId : undefined,
        couponId: itemType === 'coupon' ? itemId : undefined,
        casinoShareId: itemType === 'casino' ? itemId : undefined,
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
            return loadComments(itemId, itemType);
          })
          .catch((error) => {
            const message =
              error instanceof Error ? error.message : 'Eniu nie odpowiedział';
            console.error('Eniu failed to respond', message);
          });
      }

      setFeedItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? {
                ...item,
                comment_count: (item.comment_count ?? 0) + 1,
              }
            : item,
        ),
      );

      await loadComments(itemId, itemType);
    },
    [user, loadComments],
  );

  // ── Reactions ──────────────────────────────────────────────

  const handleToggleReaction = useCallback(
    async (itemId: string, itemType: FeedItemType, emoji: ReactionType) => {
      if (!user) return;
      const nextReaction = await toggleReaction({
        userId: user.id,
        emoji: emoji as ReactionEmoji,
        postId: itemType === 'post' ? itemId : undefined,
        couponId: itemType === 'coupon' ? itemId : undefined,
        casinoShareId: itemType === 'casino' ? itemId : undefined,
      });

      setFeedItems((prev) =>
        prev.map((item) => {
          if (item.id !== itemId || item.item_type !== itemType) return item;
          return {
            ...item,
            reactions: updateReactionCounts(
              item.reactions,
              item.my_reaction,
              nextReaction as ReactionEmoji | null,
            ),
            my_reaction: nextReaction as ReactionEmoji | null,
          };
        }),
      );
    },
    [user],
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

      setCommentsMap((prev) => {
        const current = prev[itemId] ?? [];
        return {
          ...prev,
          [itemId]: current.map((comment) =>
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
        };
      });
    },
    [user],
  );

  const handleOpenItemReactors = useCallback((item: SocialFeedItem) => {
    const firstReactionType =
      REACTION_TYPES.find((type) => (item.reactions?.[type] ?? 0) > 0) ?? null;

    setReactorsTarget(
      item.item_type === 'post'
        ? { postId: item.id }
        : item.item_type === 'coupon'
          ? { couponId: item.id }
          : { casinoShareId: item.id },
    );
    setReactorsEmoji(firstReactionType);
    setReactorsOpen(true);
  }, []);

  const handleOpenCommentReactors = useCallback(
    (commentId: string) => {
      const comment = Object.values(commentsMap)
        .flat()
        .find((entry) => entry.id === commentId);
      const firstReactionType =
        REACTION_TYPES.find(
          (type) =>
            ((comment?.reactions as ReactionCounts | null)?.[type] ?? 0) > 0,
        ) ?? null;

      setReactorsTarget({ commentId });
      setReactorsEmoji(firstReactionType);
      setReactorsOpen(true);
    },
    [commentsMap],
  );

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="h-safe-screen bg-background overflow-hidden flex flex-col">
      <Navbar />
      <div
        ref={scrollContainerRef}
        onScroll={() => {
          const element = scrollContainerRef.current;
          if (!element) return;
          setShowBackToTop(element.scrollTop > 600);
        }}
        className="flex-1 min-h-0 overflow-y-auto"
      >
        <div className="max-w-3xl mx-auto p-4">
          <h1 className="text-2xl font-bold mb-4">Social</h1>

          <div className="app-subsurface mb-4 inline-flex items-center gap-1 rounded-lg p-1">
            <button
              type="button"
              className={cn(
                'px-3 py-1.5 text-xs font-semibold rounded-md transition-colors',
                feedFilter === 'all'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-primary/10',
              )}
              onClick={() => setFeedFilter('all')}
            >
              Wszystko
            </button>
            <button
              type="button"
              className={cn(
                'px-3 py-1.5 text-xs font-semibold rounded-md transition-colors',
                feedFilter === 'coupon'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-primary/10',
              )}
              onClick={() => setFeedFilter('coupon')}
            >
              Kupony
            </button>
            <button
              type="button"
              className={cn(
                'px-3 py-1.5 text-xs font-semibold rounded-md transition-colors',
                feedFilter === 'post'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-primary/10',
              )}
              onClick={() => setFeedFilter('post')}
            >
              Posty
            </button>
            <button
              type="button"
              className={cn(
                'px-3 py-1.5 text-xs font-semibold rounded-md transition-colors',
                feedFilter === 'casino'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-primary/10',
              )}
              onClick={() => setFeedFilter('casino')}
            >
              Kasyno
            </button>
          </div>

          {/* Post composer for logged-in users */}
          {user && (
            <div className="mb-4">
              <PostComposer
                onSubmit={handleCreatePost}
                currentUserId={user.id}
              />
            </div>
          )}

          {loading ? (
            <SectionLoader label="Wczytywanie aktywności..." />
          ) : (
            <div className="space-y-3">
              {filteredFeedItems.length === 0 && !hasMore ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-lg font-medium">
                    {emptyStateTitle}
                  </p>
                  <p className="text-sm mt-1">
                    {emptyStateDescription}
                  </p>
                  {isFilteredEmpty && (
                    <button
                      type="button"
                      onClick={() => setFeedFilter('all')}
                      className="mt-4 rounded-full border border-border px-4 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                    >
                      Pokaż wszystko
                    </button>
                  )}
                </div>
              ) : (
                filteredFeedItems.map((item) => (
                  <SocialFeedCard
                    key={`${item.item_type}-${item.id}`}
                    item={item}
                    expandedCoupons={expandedCoupons}
                    copyingCoupons={copyingCoupons}
                    comments={commentsMap[item.id] ?? EMPTY_COMMENTS}
                    commentsLoaded={!!commentsLoadedMap[item.id]}
                    commentsLoading={!!commentsLoadingMap[item.id]}
                    isLoggedIn={!!user}
                    onToggleCoupon={toggleCoupon}
                    onCopyCoupon={handleCopyCoupon}
                    onToggleReaction={handleToggleReaction}
                    onFirstExpandComments={loadComments}
                    onAddComment={handleAddComment}
                    onToggleCommentReaction={handleToggleCommentReaction}
                    isAko={isAko(item)}
                    currentUserId={user?.id}
                    highlighted={
                      highlightedItemKey === `${item.item_type}-${item.id}`
                    }
                    onOpenItem={(selectedItem) =>
                      navigate(
                        getSocialItemPath(
                          selectedItem.item_type,
                          selectedItem.id,
                        ),
                      )
                    }
                    onOpenItemReactors={handleOpenItemReactors}
                    onOpenCommentReactors={handleOpenCommentReactors}
                  />
                ))
              )}

              {filteredFeedItems.length === 0 && hasMore && (
                <div className="text-center py-6 text-xs text-muted-foreground">
                  Szukamy kolejnych wpisów...
                </div>
              )}

              {hasMore && (
                <div
                  id="social-feed-sentinel"
                  className="h-1"
                  aria-hidden="true"
                />
              )}

              {loadingMore && (
                <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Ładowanie kolejnych wpisów...
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {showBackToTop && (
        <button
          type="button"
          aria-label="Wróć na górę"
          onClick={() =>
            scrollContainerRef.current?.scrollTo({
              top: 0,
              behavior: 'smooth',
            })
          }
          className="press-scale fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-xl transition-colors hover:bg-muted"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      )}
      <ReactorsDialog
        open={reactorsOpen}
        onOpenChange={setReactorsOpen}
        target={reactorsTarget}
        initialEmoji={reactorsEmoji}
      />
    </div>
  );
}
