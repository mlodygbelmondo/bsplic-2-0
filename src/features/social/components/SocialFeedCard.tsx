import { memo, useState, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp, Copy, Loader2 } from 'lucide-react';

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
import type { ReactionCounts, ReactionType } from '@/features/social/reactions';
import { formatSocialTimeAgo } from '@/features/social/lib/socialFormatters';
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

  return (
    <div
      id={`social-item-${item.item_type}-${item.id}`}
      onClick={handleOpenItem}
      className={cn(
        'bg-card rounded-xl card-shadow overflow-hidden transition-shadow',
        onOpenItem && 'cursor-pointer hover:shadow-lg',
        highlighted && 'ring-2 ring-primary/50 shadow-lg',
      )}
    >
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
            {formatSocialTimeAgo(item.created_at)}
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

      {item.item_type === 'post' && (
        <div className="px-4 py-2">
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

      <div className="px-4 pb-3 space-y-2" data-prevent-card-navigation>
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
          defaultExpanded={defaultCommentsExpanded}
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
        <div className="border-t border-border px-4 pb-3 pt-2 space-y-1.5">
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
