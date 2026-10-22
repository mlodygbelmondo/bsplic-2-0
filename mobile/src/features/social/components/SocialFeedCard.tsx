import { useRecyclingState } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Copy, Globe2, MoreHorizontal, X } from 'lucide-react-native';
import { memo, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { PREFETCH_PRESS_DELAY_MS, prefetchPublicProfile } from '@/features/profile/api/profileQueries';
import { haptics } from '@/lib/haptics';
import { useMinuteNow } from '@/lib/minute-clock';
import { createStyles } from '@/theme';
import type { SocialComment, SocialFeedItem } from '@/types/database';
import { Avatar, Text } from '@/ui';
import { addSocialComment, copyCouponToSlip, toggleCommentReaction, toggleItemReaction } from '../api/actions';
import { seedSocialItem } from '../api/cache';
import { socialCommentsQuery } from '../api/queries';
import { CommentThread } from '../comments/CommentThread';
import { parseSocialContent } from '../lib/content';
import { isAkoItem } from '../lib/feedList';
import type { ReactionType } from '../lib/reactions';
import {
  getFeedItemKey,
  getInitialReactorsEmoji,
  getReactorsRouteParams,
  getSocialItemCommentsTarget,
  type ReactorsTarget,
} from '../lib/routes';
import { shareSocialItem } from '../lib/share';
import { formatSocialTimeAgo } from '../lib/socialFormatters';
import type { FlatComment } from '../lib/thread';
import { CasinoContent } from './CasinoContent';
import { CouponContent } from './CouponContent';
import { setFeedCardFlag, useFeedCardFlag } from './feedCardState';
import { MobileEngagement } from './MobileEngagement';
import { SocialContentBlock } from './SocialContentBlock';
import { social } from './socialColors';
import { Spinner } from './Spinner';

export interface SocialFeedCardProps {
  item: SocialFeedItem;
  /** Signed-in viewer; reactions and comments are disabled without one. */
  currentUserId: string | null;
  /**
   * Item page (`/social/:itemType/:itemId`): coupon legs stay open, the
   * comment thread starts expanded and the card does not navigate.
   */
  detail?: boolean;
  /** Feed `space-y-2`: 8 pt above every card but the first. Part of the card so a hidden card leaves no gap. */
  spaced?: boolean;
}

const EMPTY_COMMENTS: SocialComment[] = [];

function openReactors(target: ReactorsTarget, initial: ReactionType | null) {
  router.push({ pathname: '/sheets/reactors', params: { ...getReactorsRouteParams(target, initial) } });
}

function toFlatComments(comments: SocialComment[]): FlatComment[] {
  return comments.map((comment) => {
    const parsed = parseSocialContent(comment.content);
    return {
      ...comment,
      content: parsed.text,
      image_path: parsed.imagePath,
      reactions: comment.reactions as Record<string, number> | null,
    };
  });
}

/**
 * Web `SocialFeedCard` at phone size: header, post/coupon/casino body, the
 * reactions/comment/share engagement and the comment thread. Hidden,
 * expanded and open-thread flags live in `feedCardState` so they survive
 * recycling; transient state lives in `useRecyclingState`.
 */
export const SocialFeedCard = memo(function SocialFeedCard({
  item,
  currentUserId,
  detail = false,
  spaced = false,
}: SocialFeedCardProps) {
  const styles = useStyles();
  const now = useMinuteNow();
  const itemKey = getFeedItemKey(item);
  // The item page always shows its card, even one hidden in the feed.
  const hidden = useFeedCardFlag('hidden', itemKey) && !detail;
  const couponExpanded = useFeedCardFlag('couponExpanded', itemKey);
  const threadOpen = useFeedCardFlag('threadOpen', itemKey);
  const [copying, setCopying] = useRecyclingState(false, [itemKey]);
  const [expandSignal, setExpandSignal] = useRecyclingState(0, [itemKey]);
  const [commentsRequested, setCommentsRequested] = useRecyclingState(detail, [itemKey]);
  const commentsQuery = useQuery({
    ...socialCommentsQuery(item.item_type, item.id, currentUserId),
    enabled: commentsRequested,
  });

  if (hidden) return null;

  const loggedIn = currentUserId !== null;
  const comments = commentsQuery.data ?? EMPTY_COMMENTS;
  // Cached comments alone do not count: the first expand enables the query, which refreshes them.
  const commentsLoaded = commentsRequested && commentsQuery.isSuccess;
  const ako = isAkoItem(item);

  const handleCopy = () => {
    if (copying) return;
    setCopying(true);
    void copyCouponToSlip(item)
      .then((copied) => {
        if (!copied) return;
        haptics.success();
        // From the item page, pop back to the tabs instead of pushing a second copy.
        if (detail) router.dismissTo('/');
        else router.navigate('/');
      })
      .finally(() => setCopying(false));
  };

  const handleReact = (emoji: ReactionType) => {
    void toggleItemReaction(item.item_type, item.id, emoji);
  };

  const handleOpenCommentReactors = (commentId: string) => {
    const comment = comments.find((entry) => entry.id === commentId);
    openReactors({ commentId }, getInitialReactorsEmoji(comment?.reactions));
  };

  const body = (
    <>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Profil ${item.username}`}
          unstable_pressDelay={PREFETCH_PRESS_DELAY_MS}
          onPressIn={() => {
            if (item.user_id !== currentUserId) prefetchPublicProfile(item.user_id);
          }}
          onPress={() => router.push({ pathname: '/profile/[userId]', params: { userId: item.user_id } })}
          style={styles.author}
        >
          <Avatar
            uri={item.avatar_url}
            name={item.username}
            size={40}
            recyclingKey={itemKey}
            style={styles.avatar}
            fallbackStyle={styles.avatar}
            fallbackTextStyle={styles.avatarText}
          />
          <View style={styles.authorText}>
            <Text numberOfLines={1} style={styles.username}>
              {item.username}
            </Text>
            <View style={styles.timeRow}>
              <Text style={styles.time}>{formatSocialTimeAgo(item.created_at, now)}</Text>
              <Text style={styles.time} importantForAccessibility="no" accessibilityElementsHidden>
                ·
              </Text>
              <Globe2 size={12} color={social.mutedForeground} />
            </View>
          </View>
        </Pressable>
        <View style={styles.headerActions}>
          {item.item_type === 'coupon' ? (
            <IconButton label="Skopiuj kupon" disabled={copying} onPress={() => void handleCopy()}>
              {copying ? (
                <Spinner size={18.4} color={social.mutedForeground} />
              ) : (
                <Copy size={18.4} color={social.mutedForeground} />
              )}
            </IconButton>
          ) : null}
          <IconButton label="Więcej opcji">
            <MoreHorizontal size={20} color={social.mutedForeground} />
          </IconButton>
          <IconButton label="Ukryj wpis" onPress={() => setFeedCardFlag('hidden', itemKey, true)}>
            <X size={20} color={social.mutedForeground} />
          </IconButton>
        </View>
      </View>

      {item.item_type === 'post' ? (
        <View style={styles.postBody}>
          <SocialContentBlock content={item.content} imageAlt="Zdjęcie w poście" itemKey={itemKey} />
        </View>
      ) : null}
      {item.item_type === 'coupon' ? (
        <CouponContent
          item={item}
          ako={ako}
          expanded={detail || couponExpanded}
          onToggle={() => {
            if (!detail) setFeedCardFlag('couponExpanded', itemKey, !couponExpanded);
          }}
        />
      ) : null}
      {item.item_type === 'casino' ? <CasinoContent item={item} /> : null}
    </>
  );

  return (
    <View style={[styles.card, spaced && styles.spaced]}>
      {detail ? (
        body
      ) : (
        // Not an accessibility element itself, so VoiceOver still reaches the buttons and links inside.
        <Pressable
          accessible={false}
          unstable_pressDelay={PREFETCH_PRESS_DELAY_MS}
          onPressIn={() => seedSocialItem(item, currentUserId)}
          onPress={() =>
            router.push({ pathname: '/social/[itemType]/[itemId]', params: { itemType: item.item_type, itemId: item.id } })
          }
        >
          {body}
        </Pressable>
      )}

      <View style={styles.engagement}>
        <MobileEngagement
          reactions={item.reactions}
          myReaction={item.my_reaction}
          commentCount={item.comment_count ?? comments.length}
          disabled={!loggedIn}
          onOpenReactors={() => openReactors(getSocialItemCommentsTarget(item.item_type, item.id), getInitialReactorsEmoji(item.reactions))}
          onReact={handleReact}
          onComment={() => setExpandSignal((current) => current + 1)}
          onShare={() => void shareSocialItem(item)}
        />
        <View style={styles.thread}>
          <CommentThread
            key={itemKey}
            comments={toFlatComments(comments)}
            initialCount={item.comment_count ?? 0}
            commentsLoaded={commentsLoaded}
            defaultExpanded={detail || threadOpen}
            expandSignal={expandSignal}
            onExpandedChange={(open) => {
              if (!detail) setFeedCardFlag('threadOpen', itemKey, open);
            }}
            hideToggleOnMobile
            onFirstExpand={() => {
              if (!commentsLoaded && !commentsQuery.isFetching) setCommentsRequested(true);
            }}
            onAddComment={(content, parentId, image) => addSocialComment(item.item_type, item.id, content, parentId, image)}
            onToggleReaction={(commentId, emoji) => void toggleCommentReaction(commentId, emoji)}
            onOpenCommentReactors={handleOpenCommentReactors}
            disabled={!loggedIn}
            currentUserId={currentUserId ?? undefined}
          />
        </View>
      </View>
    </View>
  );
});

/** `.social-post-icon-button` / phone `.social-copy-coupon-button`: 2rem round, muted icon. */
function IconButton({
  label,
  disabled,
  onPress,
  children,
}: {
  label: string;
  disabled?: boolean;
  onPress?: () => void;
  children: ReactNode;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed, disabled && styles.iconButtonDisabled]}
    >
      {children}
    </Pressable>
  );
}

const useStyles = createStyles(() => ({
  // `.social-facebook-card` on phones: card background, no border, radius or shadow.
  card: { overflow: 'hidden', backgroundColor: social.card },
  spaced: { marginTop: 8 },
  // `flex items-start justify-between gap-3 px-3 pt-3 pb-2`.
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  // `group flex min-w-0 items-center gap-2.5`.
  author: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0, flexShrink: 1 },
  // `h-10 w-10 rounded-full bg-primary/10`; fallback `text-sm font-bold text-primary`.
  avatar: { backgroundColor: social.primarySoft },
  avatarText: { fontSize: 14, color: social.primary },
  authorText: { minWidth: 0, flexShrink: 1 },
  // `text-[15px] font-semibold leading-tight`.
  username: { fontSize: 15, lineHeight: 18.75, fontWeight: '600', color: social.foreground },
  // `flex items-center gap-1 text-xs leading-tight text-muted-foreground`.
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  time: { fontSize: 12, lineHeight: 15, color: social.mutedForeground },
  // `flex shrink-0 items-center gap-2`.
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  iconButton: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  iconButtonPressed: { backgroundColor: social.muted },
  iconButtonDisabled: { opacity: 0.6 },
  // `px-3 pb-2 pt-1`.
  postBody: { paddingHorizontal: 12, paddingBottom: 8, paddingTop: 4 },
  // `.social-card-engagement space-y-2 px-3 pb-3 pt-1`.
  engagement: { paddingHorizontal: 12, paddingBottom: 12, paddingTop: 4 },
  // The thread is the third `space-y-2` child (after the hidden desktop bar), so it sits 8 px lower.
  thread: { marginTop: 8 },
}));
