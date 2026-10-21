import { MessageCircle, Share2 } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { createStyles } from '@/theme';
import { Text } from '@/ui';
import { totalReactions, type ReactionCounts, type ReactionType } from '../lib/reactions';
import { formatCommentCount } from '../lib/socialFormatters';
import { ReactionBar } from './ReactionBar';
import { ReactionSummaryButton } from './ReactionSummaryButton';
import { social } from './socialColors';

interface MobileEngagementProps {
  reactions: ReactionCounts | null;
  myReaction: ReactionType | null;
  commentCount: number;
  disabled: boolean;
  onOpenReactors: () => void;
  onReact: (emoji: ReactionType) => void;
  onComment: () => void;
  onShare: () => void;
}

/**
 * Web `MobileFacebookEngagement`: the reactions/comments summary row and the
 * three-column action row (Lubię to, Komentarz, Udostępnij).
 */
export function MobileEngagement({
  reactions,
  myReaction,
  commentCount,
  disabled,
  onOpenReactors,
  onReact,
  onComment,
  onShare,
}: MobileEngagementProps) {
  const styles = useStyles();
  const reactionsTotal = totalReactions(reactions);
  const hasSummary = reactionsTotal > 0 || commentCount > 0;

  return (
    <View>
      {hasSummary ? (
        <View style={styles.summary}>
          {reactionsTotal > 0 ? (
            <ReactionSummaryButton reactions={reactions} onOpenReactors={onOpenReactors} disabled={disabled} />
          ) : (
            <View />
          )}
          {commentCount > 0 ? (
            <Text numberOfLines={1} style={styles.commentCount}>
              {commentCount} {formatCommentCount(commentCount)}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.actions} accessibilityRole="toolbar" accessibilityLabel="Reakcje">
        <ReactionBar myReaction={myReaction} onToggle={onReact} disabled={disabled} />
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={onComment}
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed, disabled && styles.disabled]}
        >
          <MessageCircle size={16} color={social.mutedForeground} />
          <Text numberOfLines={1} style={styles.actionLabel}>
            Komentarz
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onShare}
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
        >
          <Share2 size={16} color={social.mutedForeground} />
          <Text numberOfLines={1} style={styles.actionLabel}>
            Udostępnij
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = createStyles(() => ({
  // `.social-mobile-engagement-summary`: min-h 2rem, space-between, gap 0.75rem, 0.8125rem muted.
  summary: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  commentCount: { flexShrink: 0, fontSize: 13, lineHeight: 19.5, color: social.mutedForeground },
  // `.social-mobile-action-row`: three equal columns.
  actions: { flexDirection: 'row' },
  // `.social-mobile-action-button`.
  action: {
    flex: 1,
    minWidth: 0,
    height: 37.6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5.6,
    borderRadius: 6,
  },
  actionPressed: { backgroundColor: social.muted },
  disabled: { opacity: 0.55 },
  actionLabel: { flexShrink: 1, fontSize: 13.44, lineHeight: 17, fontWeight: '700', color: social.mutedForeground },
}));
