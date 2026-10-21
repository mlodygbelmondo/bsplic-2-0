// SCAFFOLD — owner: social compose worker.
// Replace with the full port of the web `CommentThread` (nested replies,
// comment reactions, reply/comment inputs with images and mentions, Eniu).
// Keep the export name and these props (web props; `imageBlob?: Blob` becomes
// `image?: SocialImageAttachment`). The feed card renders it below the action
// row and supplies the comments from `socialCommentsQuery`.
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { createStyles } from '@/theme';
import { Text } from '@/ui';
import type { SocialImageAttachment } from '../images';
import type { ReactionType } from '../lib/reactions';
import type { FlatComment } from '../lib/thread';
import { social } from '../components/socialColors';

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

export function CommentThread({
  comments,
  commentsLoaded = true,
  onFirstExpand,
  defaultExpanded = false,
  expandSignal,
}: CommentThreadProps) {
  const styles = useStyles();
  const [collapsed, setCollapsed] = useState(!defaultExpanded);
  const [lastSignal, setLastSignal] = useState(expandSignal);
  if (expandSignal !== lastSignal) {
    setLastSignal(expandSignal);
    setCollapsed(!collapsed);
  }

  // Comments load the first time the thread opens.
  useEffect(() => {
    if (!collapsed && !commentsLoaded) onFirstExpand?.();
  }, [collapsed, commentsLoaded, onFirstExpand]);

  if (collapsed) return null;

  return (
    <View style={styles.list}>
      {!commentsLoaded ? <Text style={styles.muted}>Ładowanie komentarzy...</Text> : null}
      {comments.map((comment) => (
        <View key={comment.id} style={styles.bubble}>
          <Text style={styles.author}>{comment.username}</Text>
          {comment.content ? <Text style={styles.body}>{comment.content}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const useStyles = createStyles(() => ({
  list: { gap: 8 },
  muted: { fontSize: 12, lineHeight: 16, color: social.mutedForeground },
  bubble: { alignSelf: 'flex-start', maxWidth: '100%', borderRadius: 16, backgroundColor: social.muted, paddingHorizontal: 12, paddingVertical: 8 },
  author: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: social.foreground },
  body: { fontSize: 14, lineHeight: 20, color: social.foreground },
}));
