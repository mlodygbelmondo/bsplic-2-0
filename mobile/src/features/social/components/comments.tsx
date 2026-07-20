import { useState } from 'react';
import { MessageCircle, Reply } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppAvatar } from '@/components/ui/AppAvatar';
import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/hooks/use-app-theme';
import type { FeedItemType, ReactionEmoji, SocialComment } from '@/types/database';

import { formatSocialTimeAgo } from '../lib/socialFormatters';
import { buildCommentTree, type CommentNode } from '../lib/thread';
import { SocialContent } from './social-content';
import { ReactionBar, type ReactionTarget } from './reactions';

interface CommentThreadProps {
  itemId: string;
  itemType: FeedItemType;
  comments: SocialComment[];
  loading: boolean;
  loaded: boolean;
  disabled: boolean;
  onLoad(): void;
  onCompose(parentId?: string, initialText?: string): void;
  onReact(commentId: string, emoji: ReactionEmoji): void;
  onOpenReactors(target: ReactionTarget): void;
}

export function CommentThread({ comments, loading, loaded, disabled, onLoad, onCompose, onReact, onOpenReactors }: CommentThreadProps) {
  const { tokens } = useAppTheme();
  const tree = buildCommentTree(comments);
  if (!loaded) {
    return (
      <Pressable accessibilityRole="button" disabled={loading} onPress={onLoad} style={styles.load}>
        {loading ? <ActivityIndicator color={tokens.colors.primary} /> : <MessageCircle size={17} color={tokens.colors.mutedForeground} />}
        <AppText variant="caption" tone="muted">{loading ? 'Wczytywanie komentarzy…' : 'Pokaż komentarze'}</AppText>
      </Pressable>
    );
  }
  return (
    <View style={styles.thread}>
      {tree.map((node) => <CommentView key={node.id} node={node} depth={0} disabled={disabled} onCompose={onCompose} onReact={onReact} onOpenReactors={onOpenReactors} />)}
      {tree.length === 0 ? <AppText variant="caption" tone="muted">Brak komentarzy. Rozpocznij rozmowę.</AppText> : null}
      <Pressable accessibilityRole="button" disabled={disabled} onPress={() => onCompose()} style={[styles.add, { borderColor: tokens.colors.border }]}>
        <MessageCircle size={17} color={tokens.colors.primary} />
        <AppText variant="label" tone="primary">Napisz komentarz</AppText>
      </Pressable>
    </View>
  );
}

function CommentView({ node, depth, disabled, onCompose, onReact, onOpenReactors }: { node: CommentNode; depth: number; disabled: boolean; onCompose(parentId?: string, initialText?: string): void; onReact(id: string, emoji: ReactionEmoji): void; onOpenReactors(target: ReactionTarget): void }) {
  const { tokens } = useAppTheme();
  return (
    <View style={[styles.node, depth > 0 && { marginLeft: Math.min(depth, 3) * 12, borderLeftColor: tokens.colors.border, borderLeftWidth: StyleSheet.hairlineWidth, paddingLeft: 10 }]}>
      <View style={styles.commentRow}>
        <AppAvatar name={node.username} source={node.avatar_url ? { uri: node.avatar_url } : undefined} size={30} />
        <View style={styles.commentBody}>
          <View style={[styles.bubble, { backgroundColor: tokens.colors.muted }]}>
            <View style={styles.header}>
              <AppText variant="label">{node.username}</AppText>
              <AppText variant="caption" tone="muted">{formatSocialTimeAgo(node.created_at)}</AppText>
            </View>
            <SocialContent content={node.content} imageLabel="Zdjęcie w komentarzu" />
          </View>
          <ReactionBar compact reactions={node.reactions} myReaction={node.my_reaction} disabled={disabled} onToggle={(emoji) => onReact(node.id, emoji)} onOpenReactors={() => onOpenReactors({ commentId: node.id })} />
          {depth < 3 ? (
            <Pressable accessibilityRole="button" disabled={disabled} onPress={() => onCompose(node.id, `@${node.username} `)} style={styles.reply}>
              <Reply size={14} color={tokens.colors.mutedForeground} />
              <AppText variant="caption" tone="muted">Odpowiedz</AppText>
            </Pressable>
          ) : null}
        </View>
      </View>
      {node.children.map((child) => <CommentView key={child.id} node={child} depth={depth + 1} disabled={disabled} onCompose={onCompose} onReact={onReact} onOpenReactors={onOpenReactors} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  thread: { gap: 12 },
  load: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  node: { gap: 10 },
  commentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  commentBody: { flex: 1, gap: 4 },
  bubble: { borderRadius: 16, padding: 10, gap: 5 },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 8 },
  reply: { minHeight: 32, flexDirection: 'row', gap: 5, alignItems: 'center' },
  add: { minHeight: 44, borderWidth: StyleSheet.hairlineWidth, borderRadius: 22, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
});
