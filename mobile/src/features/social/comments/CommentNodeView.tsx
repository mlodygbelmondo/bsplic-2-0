import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { PREFETCH_PRESS_DELAY_MS, prefetchPublicProfile } from '@/features/profile/api/profileQueries';
import { useMinuteNow } from '@/lib/minute-clock';
import { createStyles } from '@/theme';
import { Avatar, Text } from '@/ui';
import { SocialContentBlock } from '../components/SocialContentBlock';
import { social } from '../components/socialColors';
import type { SocialImageAttachment } from '../images';
import type { ReactionCounts, ReactionType } from '../lib/reactions';
import type { CommentNode } from '../lib/thread';
import { CommentInput } from './CommentInput';
import { CommentReactionBar } from './CommentReactionBar';
import { formatCommentTime, withCommentImage } from './commentTime';

/** Each nesting level: `ml-2 border-l pl-2`. */
export const COMMENT_INDENT = 17;

export interface CommentNodeViewProps {
  node: CommentNode;
  depth: number;
  maxDepth: number;
  /** Content width of a root comment's bubble; replies subtract `COMMENT_INDENT` per level. */
  contentWidth: number;
  onAddComment: (content: string, parentId?: string, image?: SocialImageAttachment) => Promise<void>;
  onToggleReaction: (commentId: string, emoji: ReactionType) => void;
  onOpenCommentReactors?: (commentId: string) => void;
  disabled?: boolean;
  currentUserId?: string;
}

/** Web `CommentNodeView`: avatar, bubble, reactions, reply input and nested replies. */
export function CommentNodeView({
  node,
  depth,
  maxDepth,
  contentWidth,
  onAddComment,
  onToggleReaction,
  onOpenCommentReactors,
  disabled,
  currentUserId,
}: CommentNodeViewProps) {
  const styles = useStyles();
  const now = useMinuteNow();
  const [replying, setReplying] = useState(false);
  const canReply = depth < maxDepth;

  const prefetchAuthor = () => {
    if (node.user_id !== currentUserId) prefetchPublicProfile(node.user_id);
  };
  const openAuthor = () => router.push({ pathname: '/profile/[userId]', params: { userId: node.user_id } });

  const handleReply = async (content: string, image?: SocialImageAttachment) => {
    await onAddComment(content, node.id, image);
    setReplying(false);
  };

  return (
    <View style={[styles.node, depth > 0 && styles.nested]}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Profil ${node.username}`}
          hitSlop={8}
          unstable_pressDelay={PREFETCH_PRESS_DELAY_MS}
          onPressIn={prefetchAuthor}
          onPress={openAuthor}
          style={styles.avatarPress}
        >
          <Avatar
            uri={node.avatar_url}
            name={node.username}
            size={28}
            recyclingKey={node.id}
            style={styles.avatar}
            fallbackStyle={styles.avatar}
            fallbackTextStyle={styles.avatarText}
          />
        </Pressable>
        <View style={styles.main}>
          <View style={styles.bubble}>
            <View style={styles.meta}>
              <Text
                accessibilityRole="link"
                numberOfLines={1}
                onPress={openAuthor}
                style={styles.username}
              >
                {node.username}
              </Text>
              <Text style={styles.time}>{formatCommentTime(node.created_at, now)}</Text>
            </View>
            <View style={styles.body}>
              <SocialContentBlock
                content={withCommentImage(node.content, node.image_path)}
                imageAlt="Zdjęcie w komentarzu"
                itemKey={`comment-${node.id}`}
                width={contentWidth - depth * COMMENT_INDENT}
              />
            </View>
          </View>

          <View style={styles.actions}>
            <CommentReactionBar
              reactions={node.reactions as ReactionCounts | null}
              myReaction={node.my_reaction as ReactionType | null}
              onToggle={(emoji) => onToggleReaction(node.id, emoji)}
              onOpenReactors={onOpenCommentReactors ? () => onOpenCommentReactors(node.id) : undefined}
              disabled={disabled}
            />
            {canReply ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Odpowiedz na komentarz ${node.username}`}
                hitSlop={10}
                onPress={() => setReplying((current) => !current)}
              >
                {({ pressed }) => <Text style={[styles.reply, pressed && styles.replyPressed]}>Odpowiedz</Text>}
              </Pressable>
            ) : null}
          </View>

          {replying ? (
            <View style={styles.replyInput}>
              <CommentInput
                onSubmit={handleReply}
                disabled={disabled}
                placeholder={`Odpowiedz @${node.username}...`}
                onCancel={() => setReplying(false)}
                currentUserId={currentUserId}
                autoFocus
              />
            </View>
          ) : null}
        </View>
      </View>

      {node.children.map((child) => (
        <CommentNodeView
          key={child.id}
          node={child}
          depth={depth + 1}
          maxDepth={maxDepth}
          contentWidth={contentWidth}
          onAddComment={onAddComment}
          onToggleReaction={onToggleReaction}
          onOpenCommentReactors={onOpenCommentReactors}
          disabled={disabled}
          currentUserId={currentUserId}
        />
      ))}
    </View>
  );
}

const useStyles = createStyles(() => ({
  // `space-y-1`.
  node: { gap: 4 },
  // `ml-2 border-l border-border pl-2`.
  nested: { marginLeft: 8, borderLeftWidth: 1, borderLeftColor: social.border, paddingLeft: 8 },
  // `flex items-start gap-2`.
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  // `mt-0.5`.
  avatarPress: { marginTop: 2 },
  // `h-7 w-7 rounded-full bg-primary/10`; fallback `text-[10px] font-bold text-primary`.
  avatar: { backgroundColor: social.primarySoft },
  avatarText: { fontSize: 10, fontWeight: '700', color: social.primary },
  main: { flex: 1, minWidth: 0 },
  // `.social-comment-bubble rounded-2xl bg-muted px-3 py-2`.
  bubble: { borderRadius: 16, borderCurve: 'continuous', backgroundColor: social.muted, paddingHorizontal: 12, paddingVertical: 8 },
  // `flex items-baseline gap-2`.
  meta: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  username: { flexShrink: 1, fontSize: 12, lineHeight: 16, fontWeight: '600', color: social.foreground },
  time: { fontSize: 10, lineHeight: 14, color: social.mutedForeground },
  body: { marginTop: 2 },
  // `flex flex-wrap items-center gap-3 mt-1`.
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 4 },
  reply: { fontSize: 11, lineHeight: 16, color: social.mutedForeground },
  replyPressed: { color: social.primary },
  replyInput: { marginTop: 8 },
}));
