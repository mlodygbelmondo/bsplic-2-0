import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { SocialFeedItem, SocialComment, ReactionEmoji, CouponLeg, FeedItemType } from '@/types/database';
import { cn } from '@/lib/utils';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronDown, ChevronUp, Copy, Loader2 } from 'lucide-react';
import { deriveCouponStatus, getDisplayedCouponOdds, getDisplayedCouponWin } from '@/features/coupons/display';
import { useCoupon } from '@/contexts/CouponContext';
import { buildCouponItemsFromSocial } from '@/features/social/copyCoupon';
import { fetchBetsByIds } from '@/features/home/api/bets';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { PostComposer } from '@/features/social/components/PostComposer';
import { ReactionBar } from '@/features/social/components/ReactionBar';
import { CommentThread } from '@/features/social/components/CommentThread';
import { buildSocialContent, parseSocialContent } from '@/features/social/content';
import { uploadSocialImage } from '@/features/social/images';
import { SocialContentBlock } from '@/features/social/components/SocialContentBlock';
import { ReactorsDialog } from '@/features/social/components/ReactorsDialog';
import {
  fetchSocialFeed,
  fetchSocialFeedItem,
  createPost,
  fetchComments,
  addComment,
  toggleReaction,
} from '@/features/social/api/social';
import {
  getLocalCasinoShares,
} from '@/features/social/casinoShares';
import {
  formatRouletteBetValue,
  getRouletteBetTypeLabel,
  getRouletteColor,
} from '@/features/casino/lib/roulette';
import type { ReactionType, ReactionCounts } from '@/features/social/reactions';
import type { FlatComment } from '@/features/social/thread';

const SOCIAL_FEED_PAGE_SIZE = 50;
const SOCIAL_FEED_PREFETCH_ROOT_MARGIN = '1200px 0px';
const EMPTY_COMMENTS: SocialComment[] = [];
const REACTION_TYPES: ReactionType[] = ['like', 'heart', 'laugh', 'wow', 'sad', 'angry', 'fire'];

function updateReactionCounts(
  reactions: Partial<Record<ReactionEmoji, number>> | null,
  previousReaction: ReactionEmoji | null,
  nextReaction: ReactionEmoji | null,
): Partial<Record<ReactionEmoji, number>> | null {
  const counts: Partial<Record<ReactionEmoji, number>> = { ...(reactions ?? {}) };

  if (previousReaction) {
    counts[previousReaction] = Math.max((counts[previousReaction] ?? 0) - 1, 0);
  }

  if (nextReaction) {
    counts[nextReaction] = (counts[nextReaction] ?? 0) + 1;
  }

  const normalized = (Object.entries(counts) as Array<[ReactionEmoji, number]>)
    .filter(([, value]) => value > 0)
    .reduce<Partial<Record<ReactionEmoji, number>>>((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});

  return Object.keys(normalized).length > 0 ? normalized : null;
}

function formatEventsCount(count: number) {
  if (count === 1) return `${count} zdarzenie`;
  const lastTwoDigits = count % 100;
  if (lastTwoDigits >= 12 && lastTwoDigits <= 14) return `${count} zdarzeń`;
  const lastDigit = count % 10;
  if (lastDigit >= 2 && lastDigit <= 4) return `${count} zdarzenia`;
  return `${count} zdarzeń`;
}

function formatTimeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'przed chwilą';
  if (minutes < 60) return `${minutes} min temu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} godz. temu`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} dn. temu`;
  return new Date(dateStr).toLocaleDateString('pl-PL');
}

export default function SocialPage() {
  const [feedItems, setFeedItems] = useState<SocialFeedItem[]>([]);
  const [feedFilter, setFeedFilter] = useState<'all' | 'coupon' | 'post' | 'casino'>('all');
  const [localCasinoItems, setLocalCasinoItems] = useState<SocialFeedItem[]>(() => getLocalCasinoShares());
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [expandedCoupons, setExpandedCoupons] = useState<Set<string>>(new Set());
  const [copyingCoupons, setCopyingCoupons] = useState<Set<string>>(new Set());
  const [commentsMap, setCommentsMap] = useState<Record<string, SocialComment[]>>({});
  const [commentsLoadedMap, setCommentsLoadedMap] = useState<Record<string, boolean>>({});
  const [commentsLoadingMap, setCommentsLoadingMap] = useState<Record<string, boolean>>({});
  const { addItems, setPreferredCouponType } = useCoupon();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile } = useAuth();
  const [highlightedItemKey, setHighlightedItemKey] = useState<string | null>(null);
  const [reactorsOpen, setReactorsOpen] = useState(false);
  const [reactorsEmoji, setReactorsEmoji] = useState<ReactionType | null>(null);
  const [reactorsTarget, setReactorsTarget] = useState<{
    postId?: string;
    couponId?: string;
    commentId?: string;
  } | null>(null);

  const targetItemTypeParam = searchParams.get('itemType');
  const targetItemIdParam = searchParams.get('itemId');
  const targetItemType =
    targetItemTypeParam === 'post' || targetItemTypeParam === 'coupon'
      ? targetItemTypeParam
      : null;
  const targetItemId = targetItemIdParam && targetItemIdParam.length > 0 ? targetItemIdParam : null;

  const mergedFeedItems = useMemo(() => {
    // Merge local casino shares on top so they appear first
    const casinoOnly = localCasinoItems
      .map((item) => item.user_id === user?.id ? {
        ...item,
        username: item.username === 'Ty' ? profile?.username ?? item.username : item.username,
        avatar_url: item.avatar_url ?? profile?.avatar_url ?? null,
      } : item)
      .filter(
        (c) => !feedItems.some((f) => f.id === c.id && f.item_type === c.item_type),
      );
    return [...casinoOnly, ...feedItems];
  }, [feedItems, localCasinoItems, profile?.avatar_url, profile?.username, user?.id]);

  const filteredFeedItems = useMemo(() => {
    if (feedFilter === 'all') return mergedFeedItems;
    return mergedFeedItems.filter((item) => item.item_type === feedFilter);
  }, [mergedFeedItems, feedFilter]);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    setOffset(0);
    setHasMore(true);
    try {
      const data = await fetchSocialFeed(SOCIAL_FEED_PAGE_SIZE, 0, user?.id);
      setFeedItems(data);
      setHasMore(data.length === SOCIAL_FEED_PAGE_SIZE);
      setOffset(data.length);
      setCommentsMap({});
      setCommentsLoadedMap({});
      setCommentsLoadingMap({});
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const loadMoreFeed = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      const data = await fetchSocialFeed(SOCIAL_FEED_PAGE_SIZE, offset, user?.id);
      setFeedItems((prev) => [...prev, ...data]);
      setOffset((prev) => prev + data.length);
      setHasMore(data.length === SOCIAL_FEED_PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loading, loadingMore, offset, user?.id]);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    if (!targetItemType || !targetItemId) return;

    let cancelled = false;

    const ensureTargetItemVisible = async () => {
      setFeedFilter('all');

      try {
        const item = await fetchSocialFeedItem(targetItemType, targetItemId, user?.id);
        if (!item || cancelled) return;

        setFeedItems((prev) => {
          const exists = prev.some(
            (feedItem) => feedItem.id === item.id && feedItem.item_type === item.item_type,
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
  }, [targetItemId, targetItemType, user?.id]);

  useEffect(() => {
    if (!highlightedItemKey) return;

    const element = document.getElementById(`social-item-${highlightedItemKey}`);
    if (!element) return;

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const timeout = window.setTimeout(() => {
      setHighlightedItemKey((current) => (current === highlightedItemKey ? null : current));
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
      const { items, skippedCount } = buildCouponItemsFromSocial({ legs, bets });

      if (items.length === 0) {
        toast.error('Wszystkie zdarzenia z tego kuponu są już niedostępne lub rozliczone');
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
        error instanceof Error ? error.message : 'Nie udało się skopiować kuponu';
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
    await createPost(user.id, payload);
    await loadFeed();
    toast.success('Post opublikowany');
  };

  // ── Comments ───────────────────────────────────────────────

  const loadComments = useCallback(
    async (itemId: string, itemType: FeedItemType) => {
      setCommentsLoadingMap((prev) => ({ ...prev, [itemId]: true }));
      try {
        const target =
          itemType === 'post' ? { postId: itemId } : { couponId: itemId };
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
      await addComment({
        userId: user.id,
        content: payload,
        postId: itemType === 'post' ? itemId : undefined,
        couponId: itemType === 'coupon' ? itemId : undefined,
        parentId,
      });

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
    async (
      itemId: string,
      itemType: FeedItemType,
      emoji: ReactionType,
    ) => {
      if (!user) return;
      if (itemType === 'casino') return; // local only, no server reaction
      const nextReaction = await toggleReaction({
        userId: user.id,
        emoji: emoji as ReactionEmoji,
        postId: itemType === 'post' ? itemId : undefined,
        couponId: itemType === 'coupon' ? itemId : undefined,
        // casino items don't have dedicated reaction target yet; skip server call
      });

      setFeedItems((prev) =>
        prev.map((item) => {
          if (item.id !== itemId || item.item_type !== itemType) return item;
          return {
            ...item,
            reactions: updateReactionCounts(item.reactions, item.my_reaction, nextReaction as ReactionEmoji | null),
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
    if (item.item_type === 'casino') return;
    const firstReactionType = REACTION_TYPES.find((type) => (item.reactions?.[type] ?? 0) > 0) ?? null;

    setReactorsTarget(
      item.item_type === 'post'
        ? { postId: item.id }
        : { couponId: item.id },
    );
    setReactorsEmoji(firstReactionType);
    setReactorsOpen(true);
  }, []);

  const handleOpenCommentReactors = useCallback((commentId: string) => {
    const comment = Object.values(commentsMap)
      .flat()
      .find((entry) => entry.id === commentId);
    const firstReactionType = REACTION_TYPES.find((type) => ((comment?.reactions as ReactionCounts | null)?.[type] ?? 0) > 0) ?? null;

    setReactorsTarget({ commentId });
    setReactorsEmoji(firstReactionType);
    setReactorsOpen(true);
  }, [commentsMap]);

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="h-safe-screen bg-background overflow-hidden flex flex-col">
      <Navbar />
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-4">
          <h1 className="text-2xl font-bold mb-4">Social</h1>

        <div className="mb-4 inline-flex items-center gap-1 rounded-lg border border-border bg-card p-1">
          <button
            type="button"
            className={cn(
              'px-3 py-1.5 text-xs font-semibold rounded-md transition-colors',
              feedFilter === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
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
                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
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
                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
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
                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
            )}
            onClick={() => setFeedFilter('casino')}
          >
            Kasyno
          </button>
        </div>

          {/* Post composer for logged-in users */}
          {user && (
            <div className="mb-4">
              <PostComposer onSubmit={handleCreatePost} currentUserId={user.id} />
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFeedItems.length === 0 && !hasMore ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-lg font-medium">Brak aktywności</p>
                  <p className="text-sm mt-1">Nikt jeszcze nic nie opublikował.</p>
                </div>
              ) : (
                filteredFeedItems.map((item) => (
                  <FeedCard
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
                    formatTimeAgo={formatTimeAgo}
                    formatEventsCount={formatEventsCount}
                    currentUserId={user?.id}
                    highlighted={highlightedItemKey === `${item.item_type}-${item.id}`}
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
                <div id="social-feed-sentinel" className="h-1" aria-hidden="true" />
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
      <ReactorsDialog
        open={reactorsOpen}
        onOpenChange={setReactorsOpen}
        target={reactorsTarget}
        initialEmoji={reactorsEmoji}
      />
    </div>
  );
}

// ── Feed card ─────────────────────────────────────────────────

interface FeedCardProps {
  item: SocialFeedItem;
  expandedCoupons: Set<string>;
  copyingCoupons: Set<string>;
  comments: SocialComment[];
  commentsLoaded: boolean;
  commentsLoading: boolean;
  isLoggedIn: boolean;
  onToggleCoupon: (id: string) => void;
  onCopyCoupon: (item: SocialFeedItem) => void;
  onToggleReaction: (itemId: string, itemType: FeedItemType, emoji: ReactionType) => void | Promise<void>;
  onFirstExpandComments: (itemId: string, itemType: FeedItemType) => void | Promise<void>;
  onAddComment: (
    itemId: string,
    itemType: FeedItemType,
    content: string,
    parentId?: string,
    imageBlob?: Blob,
  ) => Promise<void>;
  onToggleCommentReaction: (
    commentId: string,
    emoji: ReactionType,
    itemId: string,
    itemType: FeedItemType,
  ) => void | Promise<void>;
  isAko: boolean;
  formatTimeAgo: (dateStr: string) => string;
  formatEventsCount: (count: number) => string;
  currentUserId?: string;
  highlighted?: boolean;
  onOpenItemReactors: (item: SocialFeedItem) => void;
  onOpenCommentReactors: (commentId: string) => void;
}

const FeedCard = memo(function FeedCard({
  item,
  expandedCoupons,
  copyingCoupons,
  comments,
  commentsLoaded,
  commentsLoading,
  isLoggedIn,
  onToggleCoupon,
  onCopyCoupon,
  onToggleReaction,
  onFirstExpandComments,
  onAddComment,
  onToggleCommentReaction,
  isAko: ako,
  formatTimeAgo,
  formatEventsCount,
  currentUserId,
  highlighted = false,
  onOpenItemReactors,
  onOpenCommentReactors,
}: FeedCardProps) {
  const expanded = expandedCoupons.has(item.id);
  const isCopying = copyingCoupons.has(item.id);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const hasAvatar = Boolean(item.avatar_url) && !avatarFailed;

  const commentsAsFlatComments: FlatComment[] = comments.map((c) => ({
    id: c.id,
    user_id: c.user_id,
    username: c.username,
    avatar_url: c.avatar_url,
    content: c.content,
    parent_id: c.parent_id,
    created_at: c.created_at,
    reactions: c.reactions as Record<string, number> | null,
    my_reaction: c.my_reaction,
  }));

  const parsedComments = commentsAsFlatComments.map((comment) => {
    const parsed = parseSocialContent(comment.content);
    return {
      ...comment,
      content: parsed.text,
      image_path: parsed.imagePath,
    };
  });

  return (
    <div
      id={`social-item-${item.item_type}-${item.id}`}
      className={cn(
        'bg-card rounded-xl card-shadow overflow-hidden transition-shadow',
        highlighted && 'ring-2 ring-primary/50 shadow-lg',
      )}
    >
      {/* User header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <Link
          to={`/profile/${item.user_id}`}
          className="flex items-center gap-2 group"
        >
          <div className="h-7 w-7 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors overflow-hidden shrink-0">
            {hasAvatar ? (
              <img
                src={item.avatar_url ?? undefined}
                alt={`Avatar ${item.username}`}
                className="h-full w-full object-cover"
                loading="lazy"
                onError={() => setAvatarFailed(true)}
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-[11px] font-bold text-primary">
                {item.username.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <span className="text-sm font-semibold group-hover:text-primary transition-colors">
            {item.username}
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">
            {formatTimeAgo(item.created_at)}
          </span>
          {item.item_type === 'coupon' && (
            <button
              type="button"
              onClick={() => void onCopyCoupon(item)}
              disabled={isCopying}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-muted disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              aria-label="Skopiuj kupon"
            >
              {isCopying ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              Skopiuj kupon
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {item.item_type === 'post' && (
        <div className="px-4 py-2">
          <SocialContentBlock content={item.content} imageAlt="Zdjęcie w poście" />
        </div>
      )}
      {item.item_type === 'coupon' && (
        <CouponContent
          item={item}
          ako={ako}
          expanded={expanded}
          onToggle={() => onToggleCoupon(item.id)}
          formatEventsCount={formatEventsCount}
        />
      )}
      {item.item_type === 'casino' && (
        <CasinoContent item={item} />
      )}

      {/* Reactions + Comments */}
      <div className="px-4 pb-3 space-y-2">
        <ReactionBar
          reactions={item.reactions as ReactionCounts | null}
          myReaction={item.my_reaction as ReactionType | null}
          onToggle={(emoji) => {
            void onToggleReaction(item.id, item.item_type, emoji);
          }}
          onOpenReactors={() => onOpenItemReactors(item)}
          disabled={!isLoggedIn}
        />
        <CommentThread
          comments={parsedComments}
          initialCount={item.comment_count ?? 0}
          commentsLoaded={commentsLoaded}
          onFirstExpand={() => {
            if (commentsLoaded || commentsLoading) return;
            void onFirstExpandComments(item.id, item.item_type);
          }}
          onAddComment={(content, parentId, imageBlob) => onAddComment(item.id, item.item_type, content, parentId, imageBlob)}
          onToggleReaction={(commentId, emoji) => {
            void onToggleCommentReaction(commentId, emoji, item.id, item.item_type);
          }}
          onOpenCommentReactors={onOpenCommentReactors}
          disabled={!isLoggedIn}
          currentUserId={currentUserId}
        />
      </div>
    </div>
  );
});

// ── Casino content ──────────────────────────────────────────

interface CasinoContentProps {
  item: SocialFeedItem;
}

function CasinoContent({ item }: CasinoContentProps) {
  const hasWinningNumber = typeof item.casino_winning_number === 'number';
  const color = item.casino_winning_color ?? 'green';
  const colorClass =
    color === 'red'
      ? 'text-red-400 border-red-500/30 bg-red-500/10'
      : color === 'black'
        ? 'text-stone-300 border-stone-500/30 bg-stone-500/10'
        : 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';

  return (
    <div className="px-4 py-2">
      <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/70 p-3 text-sm">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
              Ruletka
            </span>
            {item.casino_round_number && (
              <span className="text-xs font-medium text-muted-foreground">
                Runda #{item.casino_round_number}
              </span>
            )}
          </div>
          <p className="mt-1 font-medium truncate">
            {getRouletteBetTypeLabel(item.casino_bet_type ?? 'straight')}:{' '}
            {formatRouletteBetValue(item.casino_bet_type ?? 'straight', item.casino_bet_value ?? '')}
          </p>
          <p className="text-xs text-muted-foreground">
            {hasWinningNumber
              ? `Numer: ${item.casino_winning_number} • Stawka ${(item.casino_stake ?? 0).toFixed(2)} zł`
              : `Wynik niedostępny • Stawka ${(item.casino_stake ?? 0).toFixed(2)} zł`}
          </p>
        </div>
        {hasWinningNumber ? (
          <div
            className={cn(
              'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 text-base font-black',
              colorClass,
            )}
          >
            {item.casino_winning_number}
          </div>
        ) : (
          <div className="flex h-10 min-w-10 flex-shrink-0 items-center justify-center rounded-full border-2 border-border/70 bg-background px-2 text-[10px] font-semibold text-muted-foreground">
            Brak
          </div>
        )}
        <div className="shrink-0 text-right">
          <p className="font-bold">{(item.casino_stake ?? 0).toFixed(2)} zł</p>
          <p className="text-xs font-medium text-success">
            +{(item.casino_payout ?? 0).toFixed(2)} zł
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Coupon content ──────────────────────────────────────────

interface CouponContentProps {
  item: SocialFeedItem;
  ako: boolean;
  expanded: boolean;
  onToggle: () => void;
  formatEventsCount: (count: number) => string;
}

function CouponContent({ item, ako, expanded, onToggle }: CouponContentProps) {
  const derivedStatus = deriveCouponStatus({
    status: item.status as 'pending' | 'won' | 'lost' | 'refund' | null,
    legs: (item.legs ?? []).map((leg) => ({ result: leg.result })),
  });

  const displayedOdds = getDisplayedCouponOdds({
    totalOdds: Number(item.total_odds),
    legs: (item.legs ?? []).map((leg) => ({
      oddsAtTime: Number(leg.odds_at_time),
      result: leg.result,
    })),
  });
  const displayedWin = getDisplayedCouponWin({
    status: derivedStatus,
    isAko: ako,
    stake: Number(item.stake),
    displayedOdds,
    couponPayout: Number(item.payout),
    legs: (item.legs ?? []).map((leg) => ({ legPayout: Number(leg.leg_payout ?? 0) })),
  });

  return (
    <>
      <button
        type="button"
        className="flex items-center justify-between px-4 py-2 w-full text-sm text-left"
        onClick={() => ako && onToggle()}
      >
        <div className="min-w-0 flex-1">
          {ako ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary">
                AKO {item.legs!.length}
              </span>
              <span className="font-medium text-xs text-muted-foreground">
                kurs {displayedOdds.toFixed(2)}
              </span>
              {expanded ? (
                <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </div>
          ) : (
            <>
              <p className="font-medium truncate">
                {item.legs?.[0]?.bet_title || 'Zakład'}
              </p>
              <p className="text-xs text-muted-foreground">
                {item.legs?.[0]?.selected_option} • kurs {displayedOdds.toFixed(2)}
              </p>
            </>
          )}
        </div>
        <div className="text-right ml-3 shrink-0">
          <p className="font-bold">{Number(item.stake).toFixed(2)} zł</p>
          <p
            className={cn(
              'text-xs font-medium',
              derivedStatus === 'won'
                ? 'text-success'
                : derivedStatus === 'lost'
                  ? 'text-destructive'
                  : derivedStatus === 'refund'
                    ? 'text-primary'
                  : 'text-muted-foreground',
            )}
          >
            {derivedStatus === 'won'
              ? `+${displayedWin.toFixed(2)} zł`
              : derivedStatus === 'lost'
                ? 'Przegrana'
                : derivedStatus === 'refund'
                  ? `Zwrot ${displayedWin.toFixed(2)} zł`
                : 'W toku'}
          </p>
        </div>
      </button>

      {/* AKO legs */}
      {ako && expanded && (
        <div className="border-t border-border px-4 pb-3 pt-2 space-y-1.5">
          {item.legs!.map((leg) => (
            <div key={leg.id} className="flex items-center justify-between text-xs">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{leg.bet_title || 'Zakład'}</p>
                <p className="text-muted-foreground">
                  {leg.selected_option} • kurs {Number(leg.odds_at_time).toFixed(2)}
                </p>
              </div>
              <span
                className={cn(
                  'ml-2 shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded',
                  leg.result === 'won'
                    ? 'bg-success/10 text-success'
                    : leg.result === 'lost'
                      ? 'bg-destructive/10 text-destructive'
                      : leg.result === 'refund'
                        ? 'bg-primary/10 text-primary'
                      : 'bg-muted-foreground/10 text-muted-foreground',
                )}
              >
                {leg.result === 'won'
                  ? 'Wygrana'
                  : leg.result === 'lost'
                    ? 'Przegrana'
                    : leg.result === 'refund'
                      ? 'Zwrot'
                    : 'W toku'}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
