import { memo, useState, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Globe2,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Share2,
  ThumbsUp,
  X,
} from 'lucide-react';

import {
  deriveCouponStatus,
  getDisplayedCouponOdds,
  getDisplayedCouponWin,
} from '@/features/coupons/display';
import {
  formatRouletteBetValue,
  getRouletteBetTypeLabel,
} from '@/features/casino/lib/roulette';
import { cn } from '@/lib/utils';
import type { FeedItemType, SocialComment, SocialFeedItem } from '@/types/database';
import { parseSocialContent } from '@/features/social/content';
import {
  sortedReactions,
  totalReactions,
  type ReactionCounts,
  type ReactionType,
} from '@/features/social/reactions';
import { formatSocialTimeAgo } from '@/features/social/lib/socialFormatters';
import { getSocialItemPath } from '@/features/social/routes';
import type { FlatComment } from '@/features/social/thread';
import { CommentThread } from './CommentThread';
import { ReactionBar } from './ReactionBar';
import { SocialContentBlock } from './SocialContentBlock';

interface SocialFeedCardProps {
  item: SocialFeedItem;
  expandedCoupons: Set<string>;
  copyingCoupons: Set<string>;
  comments: SocialComment[];
  commentsLoaded: boolean;
  commentsLoading: boolean;
  isLoggedIn: boolean;
  onToggleCoupon: (id: string) => void;
  onCopyCoupon: (item: SocialFeedItem) => void;
  onToggleReaction: (
    itemId: string,
    itemType: FeedItemType,
    emoji: ReactionType,
  ) => void | Promise<void>;
  onFirstExpandComments: (
    itemId: string,
    itemType: FeedItemType,
  ) => void | Promise<void>;
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
  currentUserId?: string;
  highlighted?: boolean;
  defaultCommentsExpanded?: boolean;
  onOpenItem?: (item: SocialFeedItem) => void;
  onOpenItemReactors: (item: SocialFeedItem) => void;
  onOpenCommentReactors: (commentId: string) => void;
}

export const SocialFeedCard = memo(function SocialFeedCard({
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
  currentUserId,
  highlighted = false,
  defaultCommentsExpanded = false,
  onOpenItem,
  onOpenItemReactors,
  onOpenCommentReactors,
}: SocialFeedCardProps) {
  const expanded = expandedCoupons.has(item.id);
  const isCopying = copyingCoupons.has(item.id);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [commentsExpandSignal, setCommentsExpandSignal] = useState(0);
  const [isHidden, setIsHidden] = useState(false);
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

  const handleOpenItem = (event: MouseEvent<HTMLDivElement>) => {
    if (!onOpenItem) return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (
      target.closest(
        'a, button, input, textarea, select, label, [role="button"], [data-prevent-card-navigation]',
      )
    ) {
      return;
    }

    onOpenItem(item);
  };

  const handleMobileCommentClick = () => {
    setCommentsExpandSignal((current) => current + 1);
  };

  const handleShareItem = async () => {
    if (typeof window === 'undefined') return;

    const url = `${window.location.origin}${getSocialItemPath(
      item.item_type,
      item.id,
    )}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${item.username} w Socialu`,
          url,
        });
        return;
      } catch {
        return;
      }
    }

    try {
      await navigator.clipboard?.writeText(url);
    } catch {
      // The share button is still useful where native sharing is available.
    }
  };

  if (isHidden) {
    return null;
  }

  return (
    <div
      data-testid="social-feed-card"
      id={`social-item-${item.item_type}-${item.id}`}
      onClick={handleOpenItem}
      className={cn(
        'app-surface social-edge-surface social-facebook-card rounded-none overflow-hidden transition-shadow sm:rounded-xl',
        onOpenItem && 'cursor-pointer hover:shadow-lg',
        highlighted && 'ring-2 ring-primary/50 shadow-lg',
      )}
    >
      <div className="flex items-start justify-between gap-3 px-3 pt-3 pb-2 sm:px-4">
        <Link
          to={`/profile/${item.user_id}`}
          className="group flex min-w-0 items-center gap-2.5"
        >
          <div className="h-10 w-10 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors overflow-hidden shrink-0 sm:h-7 sm:w-7">
            {hasAvatar ? (
              <img
                src={item.avatar_url ?? undefined}
                alt={`Avatar ${item.username}`}
                className="h-full w-full object-cover"
                loading="lazy"
                onError={() => setAvatarFailed(true)}
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-sm font-bold text-primary sm:text-[11px]">
                {item.username.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-semibold leading-tight group-hover:text-primary transition-colors sm:text-sm">
              {item.username}
            </span>
            <span className="flex items-center gap-1 text-xs leading-tight text-muted-foreground sm:text-[11px]">
              <span>{formatSocialTimeAgo(item.created_at)}</span>
              <span className="sm:hidden" aria-hidden="true">
                ·
              </span>
              <Globe2 className="h-3 w-3 sm:hidden" aria-hidden="true" />
            </span>
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          {item.item_type === 'coupon' && (
            <button
              type="button"
              onClick={() => void onCopyCoupon(item)}
              disabled={isCopying}
              className="social-copy-coupon-button inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-muted disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              aria-label="Skopiuj kupon"
            >
              {isCopying ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              <span className="hidden sm:inline">Skopiuj kupon</span>
            </button>
          )}
          <button
            type="button"
            className="social-post-icon-button sm:hidden"
            aria-label="Więcej opcji"
            data-prevent-card-navigation
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="social-post-icon-button sm:hidden"
            aria-label="Ukryj wpis"
            onClick={() => setIsHidden(true)}
            data-prevent-card-navigation
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {item.item_type === 'post' && (
        <div className="px-3 pb-2 pt-1 sm:px-4">
          <SocialContentBlock
            content={item.content}
            imageAlt="Zdjęcie w poście"
          />
        </div>
      )}
      {item.item_type === 'coupon' && (
        <CouponContent
          item={item}
          ako={ako}
          expanded={expanded}
          onToggle={() => onToggleCoupon(item.id)}
        />
      )}
      {item.item_type === 'casino' && <CasinoContent item={item} />}

      <div
        className="social-card-engagement space-y-2 px-3 pb-3 pt-1 sm:px-4"
        data-prevent-card-navigation
      >
        <MobileFacebookEngagement
          reactions={item.reactions as ReactionCounts | null}
          myReaction={item.my_reaction as ReactionType | null}
          commentCount={item.comment_count ?? comments.length}
          disabled={!isLoggedIn}
          onOpenReactors={() => onOpenItemReactors(item)}
          onLike={() => {
            void onToggleReaction(item.id, item.item_type, 'like');
          }}
          onComment={handleMobileCommentClick}
          onShare={() => {
            void handleShareItem();
          }}
        />
        <div className="social-desktop-reaction-bar hidden sm:block">
          <ReactionBar
            reactions={item.reactions as ReactionCounts | null}
            myReaction={item.my_reaction as ReactionType | null}
            onToggle={(emoji) => {
              void onToggleReaction(item.id, item.item_type, emoji);
            }}
            onOpenReactors={() => onOpenItemReactors(item)}
            disabled={!isLoggedIn}
          />
        </div>
        <CommentThread
          comments={parsedComments}
          initialCount={item.comment_count ?? 0}
          commentsLoaded={commentsLoaded}
          defaultExpanded={defaultCommentsExpanded}
          expandSignal={commentsExpandSignal}
          hideToggleOnMobile
          onFirstExpand={() => {
            if (commentsLoaded || commentsLoading) return;
            void onFirstExpandComments(item.id, item.item_type);
          }}
          onAddComment={(content, parentId, imageBlob) =>
            onAddComment(item.id, item.item_type, content, parentId, imageBlob)
          }
          onToggleReaction={(commentId, emoji) => {
            void onToggleCommentReaction(
              commentId,
              emoji,
              item.id,
              item.item_type,
            );
          }}
          onOpenCommentReactors={onOpenCommentReactors}
          disabled={!isLoggedIn}
          currentUserId={currentUserId}
        />
      </div>
    </div>
  );
});

interface MobileFacebookEngagementProps {
  reactions: ReactionCounts | null;
  myReaction: ReactionType | null;
  commentCount: number;
  disabled: boolean;
  onOpenReactors: () => void;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
}

function MobileFacebookEngagement({
  reactions,
  myReaction,
  commentCount,
  disabled,
  onOpenReactors,
  onLike,
  onComment,
  onShare,
}: MobileFacebookEngagementProps) {
  const sorted = sortedReactions(reactions);
  const reactionsTotal = totalReactions(reactions);
  const visibleReactions = sorted.slice(0, 3);
  const hasSummary = reactionsTotal > 0 || commentCount > 0;

  return (
    <div className="social-mobile-engagement sm:hidden">
      {hasSummary && (
        <div className="social-mobile-engagement-summary">
          {reactionsTotal > 0 ? (
            <button
              type="button"
              className="social-mobile-reaction-summary"
              onClick={onOpenReactors}
              disabled={disabled}
              aria-label={`Wyświetl reakcje (${reactionsTotal})`}
            >
              <span className="social-mobile-reaction-stack" aria-hidden="true">
                {visibleReactions.map(({ type, emoji }) => (
                  <span key={type}>{emoji}</span>
                ))}
              </span>
              <span>{reactionsTotal}</span>
            </button>
          ) : (
            <span />
          )}
          {commentCount > 0 && (
            <span className="social-mobile-comment-count">
              {commentCount} {formatFeedCommentCount(commentCount)}
            </span>
          )}
        </div>
      )}

      <div
        data-testid="social-mobile-action-row"
        className="social-mobile-action-row sm:hidden"
      >
        <button
          type="button"
          className={cn(
            'social-mobile-action-button',
            myReaction === 'like' && 'text-primary',
          )}
          onClick={onLike}
          disabled={disabled}
          aria-pressed={myReaction === 'like'}
        >
          <ThumbsUp
            className="h-4 w-4"
            fill={myReaction === 'like' ? 'currentColor' : 'none'}
          />
          <span>Lubię to</span>
        </button>
        <button
          type="button"
          className="social-mobile-action-button"
          onClick={onComment}
          disabled={disabled}
        >
          <MessageCircle className="h-4 w-4" />
          <span>Komentarz</span>
        </button>
        <button
          type="button"
          className="social-mobile-action-button"
          onClick={onShare}
        >
          <Share2 className="h-4 w-4" />
          <span>Udostępnij</span>
        </button>
      </div>
    </div>
  );
}

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
    <div className="px-3 py-2 sm:px-4">
      <div className="app-subsurface social-casino-content flex items-center justify-between gap-3 rounded-lg p-2.5 text-sm sm:p-3">
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
            {formatRouletteBetValue(
              item.casino_bet_type ?? 'straight',
              item.casino_bet_value ?? '',
            )}
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

interface CouponContentProps {
  item: SocialFeedItem;
  ako: boolean;
  expanded: boolean;
  onToggle: () => void;
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
    legs: (item.legs ?? []).map((leg) => ({
      legPayout: Number(leg.leg_payout ?? 0),
    })),
  });

  return (
    <>
      <button
        type="button"
        className="social-coupon-content flex items-center justify-between px-3 py-2 w-full text-sm text-left sm:px-4"
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
                {item.legs?.[0]?.selected_option} • kurs{' '}
                {displayedOdds.toFixed(2)}
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

      {ako && expanded && (
        <div className="social-coupon-legs border-t border-border px-3 pb-3 pt-2 space-y-1.5 sm:px-4">
          {item.legs!.map((leg) => (
            <div
              key={leg.id}
              className="flex items-center justify-between text-xs"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {leg.bet_title || 'Zakład'}
                </p>
                <p className="text-muted-foreground">
                  {leg.selected_option} • kurs{' '}
                  {Number(leg.odds_at_time).toFixed(2)}
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

function formatFeedCommentCount(count: number): string {
  if (count === 1) return 'komentarz';
  const lastTwo = count % 100;
  if (lastTwo >= 12 && lastTwo <= 14) return 'komentarzy';
  const lastDigit = count % 10;
  if (lastDigit >= 2 && lastDigit <= 4) return 'komentarze';
  return 'komentarzy';
}
