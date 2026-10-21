import { ChevronDown, ChevronUp, MessageCircle } from 'lucide-react-native';
import { useEffect, useEffectEvent, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';

import { OFFLINE_WRITE_MESSAGE, useIsOffline } from '@/lib/connectivity';
import { createStyles } from '@/theme';
import { Text } from '@/ui';
import { social } from '../components/socialColors';
import type { SocialImageAttachment } from '../images';
import type { ReactionType } from '../lib/reactions';
import { formatCommentCount } from '../lib/socialFormatters';
import { buildCommentTree, type FlatComment } from '../lib/thread';
import { CommentInput } from './CommentInput';
import { CommentNodeView } from './CommentNodeView';

/** Card `px-3` (24) + avatar (28) + gap (8) + bubble `px-3` (24). */
const ROOT_CONTENT_INSET = 84;

export interface CommentThreadProps {
  /** Parsed comments: `content` is the text, `image_path` the attached image. */
  comments: FlatComment[];
  initialCount?: number;
  commentsLoaded?: boolean;
  onFirstExpand?: () => void;
  onAddComment: (content: string, parentId?: string, image?: SocialImageAttachment) => Promise<void>;
  onToggleReaction: (commentId: string, emoji: ReactionType) => void;
  onOpenCommentReactors?: (commentId: string) => void;
  disabled?: boolean;
  maxDepth?: number;
  currentUserId?: string;
  defaultExpanded?: boolean;
  /** Bumped by the card's "Komentarz" button: toggles the thread like the web. */
  expandSignal?: number;
  hideToggleOnMobile?: boolean;
}

/**
 * Web `CommentThread`: toggle (hidden on phones when the card's Komentarz
 * button drives it), the comment tree with replies up to `maxDepth`, and the
 * root comment input. Writes are disabled offline.
 */
export function CommentThread({
  comments,
  initialCount = 0,
  commentsLoaded = true,
  onFirstExpand,
  onAddComment,
  onToggleReaction,
  onOpenCommentReactors,
  disabled,
  maxDepth = 3,
  currentUserId,
  defaultExpanded = false,
  expandSignal,
  hideToggleOnMobile = false,
}: CommentThreadProps) {
  const styles = useStyles();
  const offline = useIsOffline();
  const windowWidth = useWindowDimensions().width;
  const [collapsed, setCollapsed] = useState(!defaultExpanded);
  const [showInput, setShowInput] = useState(defaultExpanded);
  const [lastSignal, setLastSignal] = useState(expandSignal);

  // The card's Komentarz button toggles the thread; opening also shows the input.
  if (expandSignal !== undefined && expandSignal !== lastSignal) {
    setLastSignal(expandSignal);
    if (collapsed) setShowInput(true);
    setCollapsed(!collapsed);
  }

  // Comments load the first time the thread opens.
  const requestComments = useEffectEvent(() => onFirstExpand?.());
  useEffect(() => {
    if (!collapsed && !commentsLoaded) requestComments();
  }, [collapsed, commentsLoaded]);

  const writesDisabled = Boolean(disabled) || offline;
  const totalCount = commentsLoaded ? comments.length : Math.max(comments.length, initialCount);
  const toggleLabel = totalCount > 0 ? `${totalCount} ${formatCommentCount(totalCount)}` : 'Skomentuj';
  const tree = collapsed ? [] : buildCommentTree(comments);

  const toggle = () => {
    if (collapsed) setShowInput(true);
    setCollapsed(!collapsed);
  };

  return (
    <View style={styles.root}>
      {hideToggleOnMobile ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={collapsed ? `Pokaż komentarze (${totalCount})` : 'Ukryj komentarze'}
          accessibilityState={{ expanded: !collapsed }}
          hitSlop={10}
          onPress={toggle}
          style={styles.toggle}
        >
          {({ pressed }) => {
            const color = pressed ? social.foreground : social.mutedForeground;
            return (
              <>
                <MessageCircle size={14} color={color} />
                <Text style={[styles.toggleText, { color }]}>{toggleLabel}</Text>
                {totalCount > 0 ? collapsed ? <ChevronDown size={12} color={color} /> : <ChevronUp size={12} color={color} /> : null}
              </>
            );
          }}
        </Pressable>
      )}

      {collapsed ? null : (
        <View style={styles.body}>
          {tree.map((node) => (
            <CommentNodeView
              key={node.id}
              node={node}
              depth={0}
              maxDepth={maxDepth}
              contentWidth={windowWidth - ROOT_CONTENT_INSET}
              onAddComment={onAddComment}
              onToggleReaction={onToggleReaction}
              onOpenCommentReactors={onOpenCommentReactors}
              disabled={writesDisabled}
              currentUserId={currentUserId}
            />
          ))}

          {showInput ? (
            <CommentInput
              onSubmit={(content, image) => onAddComment(content, undefined, image)}
              disabled={writesDisabled}
              placeholder="Napisz komentarz..."
              currentUserId={currentUserId}
            />
          ) : (
            <Pressable accessibilityRole="button" hitSlop={10} onPress={() => setShowInput(true)} style={styles.addButton}>
              <Text style={styles.addText}>Dodaj komentarz</Text>
            </Pressable>
          )}

          {offline && !disabled ? <Text style={styles.offline}>{OFFLINE_WRITE_MESSAGE}</Text> : null}
        </View>
      )}
    </View>
  );
}

const useStyles = createStyles(() => ({
  // `space-y-2`; the hidden phone toggle leaves no gap.
  root: { gap: 8 },
  // `flex items-center gap-1 text-xs text-muted-foreground`.
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  toggleText: { fontSize: 12, lineHeight: 16 },
  // `space-y-2 pl-0`.
  body: { gap: 8 },
  addButton: { alignSelf: 'flex-start' },
  addText: { fontSize: 12, lineHeight: 16, color: social.primary },
  offline: { fontSize: 12, lineHeight: 16, color: social.mutedForeground },
}));
