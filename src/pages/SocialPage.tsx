import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { SocialFeedItem, SocialComment, ReactionEmoji, CouponLeg } from '@/types/database';
import { cn } from '@/lib/utils';
import { Link, useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronDown, ChevronUp, Copy, Loader2 } from 'lucide-react';
import { getDisplayedCouponOdds } from '@/features/coupons/display';
import { useCoupon } from '@/contexts/CouponContext';
import { buildCouponItemsFromSocial } from '@/features/social/copyCoupon';
import { fetchBetsByIds } from '@/features/home/api/bets';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { PostComposer } from '@/features/social/components/PostComposer';
import { ReactionBar } from '@/features/social/components/ReactionBar';
import { CommentThread } from '@/features/social/components/CommentThread';
import {
  fetchSocialFeed,
  createPost,
  fetchComments,
  addComment,
  toggleReaction,
} from '@/features/social/api/social';
import type { ReactionType, ReactionCounts } from '@/features/social/reactions';
import type { FlatComment } from '@/features/social/thread';

const SOCIAL_FEED_PAGE_SIZE = 50;
const SOCIAL_FEED_PREFETCH_ROOT_MARGIN = '1200px 0px';
const EMPTY_COMMENTS: SocialComment[] = [];

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
  const [feedFilter, setFeedFilter] = useState<'all' | 'coupon' | 'post'>('all');
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
  const { user } = useAuth();

  const filteredFeedItems = useMemo(() => {
    if (feedFilter === 'all') return feedItems;
    return feedItems.filter((item) => item.item_type === feedFilter);
  }, [feedItems, feedFilter]);

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

  const handleCreatePost = async (content: string) => {
    if (!user) return;
    await createPost(user.id, content);
    await loadFeed();
    toast.success('Post opublikowany');
  };

  // ── Comments ───────────────────────────────────────────────

  const loadComments = useCallback(
    async (itemId: string, itemType: 'post' | 'coupon') => {
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
      itemType: 'post' | 'coupon',
      content: string,
      parentId?: string,
    ) => {
      if (!user) return;
      await addComment({
        userId: user.id,
        content,
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
      itemType: 'post' | 'coupon',
      emoji: ReactionType,
    ) => {
      if (!user) return;
      const nextReaction = await toggleReaction({
        userId: user.id,
        emoji: emoji as ReactionEmoji,
        postId: itemType === 'post' ? itemId : undefined,
        couponId: itemType === 'coupon' ? itemId : undefined,
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
      _itemType: 'post' | 'coupon',
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

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
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
        </div>

        {/* Post composer for logged-in users */}
        {user && (
          <div className="mb-4">
            <PostComposer onSubmit={handleCreatePost} />
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
  onToggleReaction: (itemId: string, itemType: 'post' | 'coupon', emoji: ReactionType) => void | Promise<void>;
  onFirstExpandComments: (itemId: string, itemType: 'post' | 'coupon') => void | Promise<void>;
  onAddComment: (
    itemId: string,
    itemType: 'post' | 'coupon',
    content: string,
    parentId?: string,
  ) => Promise<void>;
  onToggleCommentReaction: (
    commentId: string,
    emoji: ReactionType,
    itemId: string,
    itemType: 'post' | 'coupon',
  ) => void | Promise<void>;
  isAko: boolean;
  formatTimeAgo: (dateStr: string) => string;
  formatEventsCount: (count: number) => string;
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
}: FeedCardProps) {
  const expanded = expandedCoupons.has(item.id);
  const isCopying = copyingCoupons.has(item.id);

  const commentsAsFlatComments: FlatComment[] = comments.map((c) => ({
    id: c.id,
    user_id: c.user_id,
    username: c.username,
    content: c.content,
    parent_id: c.parent_id,
    created_at: c.created_at,
    reactions: c.reactions as Record<string, number> | null,
    my_reaction: c.my_reaction,
  }));

  return (
    <div className="bg-card rounded-xl card-shadow overflow-hidden">
      {/* User header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <Link
          to={`/profile/${item.user_id}`}
          className="flex items-center gap-2 group"
        >
          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary group-hover:bg-primary/20 transition-colors">
            {item.username.charAt(0).toUpperCase()}
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
      {item.item_type === 'post' ? (
        <div className="px-4 py-2">
          <p className="text-sm whitespace-pre-wrap">{item.content}</p>
        </div>
      ) : (
        <CouponContent
          item={item}
          ako={ako}
          expanded={expanded}
          onToggle={() => onToggleCoupon(item.id)}
          formatEventsCount={formatEventsCount}
        />
      )}

      {/* Reactions + Comments */}
      <div className="px-4 pb-3 space-y-2">
        <ReactionBar
          reactions={item.reactions as ReactionCounts | null}
          myReaction={item.my_reaction as ReactionType | null}
          onToggle={(emoji) => {
            void onToggleReaction(item.id, item.item_type, emoji);
          }}
          disabled={!isLoggedIn}
        />
        <CommentThread
          comments={commentsAsFlatComments}
          initialCount={item.comment_count ?? 0}
          commentsLoaded={commentsLoaded}
          onFirstExpand={() => {
            if (commentsLoaded || commentsLoading) return;
            void onFirstExpandComments(item.id, item.item_type);
          }}
          onAddComment={(content, parentId) => onAddComment(item.id, item.item_type, content, parentId)}
          onToggleReaction={(commentId, emoji) => {
            void onToggleCommentReaction(commentId, emoji, item.id, item.item_type);
          }}
          disabled={!isLoggedIn}
        />
      </div>
    </div>
  );
});

// ── Coupon content ──────────────────────────────────────────

interface CouponContentProps {
  item: SocialFeedItem;
  ako: boolean;
  expanded: boolean;
  onToggle: () => void;
  formatEventsCount: (count: number) => string;
}

function CouponContent({ item, ako, expanded, onToggle }: CouponContentProps) {
  const displayedOdds = getDisplayedCouponOdds({
    totalOdds: Number(item.total_odds),
    legs: (item.legs ?? []).map((leg) => ({
      oddsAtTime: Number(leg.odds_at_time),
    })),
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
              item.status === 'won'
                ? 'text-success'
                : item.status === 'lost'
                  ? 'text-destructive'
                  : 'text-muted-foreground',
            )}
          >
            {item.status === 'won'
              ? `+${Number(item.payout).toFixed(2)} zł`
              : item.status === 'lost'
                ? 'Przegrana'
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
                      : 'bg-muted-foreground/10 text-muted-foreground',
                )}
              >
                {leg.result === 'won'
                  ? 'Wygrana'
                  : leg.result === 'lost'
                    ? 'Przegrana'
                    : 'W toku'}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
